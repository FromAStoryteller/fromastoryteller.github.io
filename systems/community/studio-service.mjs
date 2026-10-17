import { loadProfileAccount } from '../../account/settings-controller.mjs';
import { isPublicId } from './profiles.mjs';

export const STORY_FIELDS = 'id,slug,title,summary,body,genre,tags,content_warning,cover_asset_id,status,updated_at,published_at';
const text = (value, name, max, required = false) => {
  if (typeof value !== 'string' || [...value].length > max || (required && !value.trim())) throw new Error(`${name}: ${required ? 'enter text, up to' : 'use up to'} ${max.toLocaleString()} characters.`);
  return value;
};
export function validateStory(input) {
  if (!input || Object.keys(input).some(key => !['slug','title','summary','body','genre','tags','content_warning','cover_asset_id'].includes(key))) throw new Error('Only story text, metadata and cover can be edited.');
  const slug = text(input.slug, 'Story address', 120, true);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error('Use lowercase letters, numbers and single hyphens for the story address.');
  const tags = typeof input.tags === 'string' ? input.tags.split(',').map(tag => tag.trim()).filter(Boolean) : input.tags;
  if (!Array.isArray(tags) || tags.length > 12 || tags.some(tag => typeof tag !== 'string' || !tag.trim() || [...tag].length > 40)) throw new Error('Use up to 12 tags, each up to 40 characters, separated by commas.');
  const cover = input.cover_asset_id || null;
  if (cover !== null && !isPublicId(cover)) throw new Error('Choose a cover from this story’s images.');
  return { slug, title: text(input.title,'Title',200,true).trim(), summary: text(input.summary,'Description',1000), body: text(input.body,'Story',200000), genre: text(input.genre,'Genre',80), tags: [...new Set(tags.map(tag=>tag.trim()))], content_warning: text(input.content_warning,'Content warning',1000), cover_asset_id: cover };
}
export function storySlug(title) {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100).replace(/-$/,'') || 'untitled-story';
}
export class StudioAccessError extends Error {}
export class StudioConflictError extends Error {}

export function createStudioService(client, { ownerId, checkAccount = loadProfileAccount } = {}) {
  if (!isPublicId(ownerId)) throw new Error('A verified account is required.');
  async function authorize() {
    let account;
    try { account = await checkAccount(client); } catch { throw new Error('Your account could not be verified. Check your connection and try again. Your unsaved text is still here.'); }
    if (account.user.id !== ownerId || account.state !== 'active' || !account.contributor) throw new StudioAccessError('Your contributor access or account has changed. Your saved work remains in your account download.');
  }
  function failure(error) {
    if (error?.code === '23505') throw new Error('That story address is already in use. Choose another.');
    throw new Error('Your story could not be saved. Check your connection and current account agreements, then try again. Your unsaved text is still here.');
  }
  return {
    authorize,
    async list(offset = 0) {
      await authorize();
      const {data,error} = await client.from('stories').select('id,title,slug,status,updated_at').eq('author_id',ownerId).order('updated_at',{ascending:false}).order('id').range(offset,offset+19);
      if (error) throw new Error('Your stories could not be loaded. Please try again.');
      return data;
    },
    async read(id) {
      if (!isPublicId(id)) throw new Error('Story unavailable.');
      await authorize();
      const {data,error} = await client.from('stories').select(STORY_FIELDS).eq('author_id',ownerId).eq('id',id).single();
      if (error || !data) throw new StudioConflictError('This story is unavailable. Reopen it from your stories.');
      const assets = await client.from('story_assets').select('id,alt_text,approved_at').eq('story_id',id).order('created_at');
      if (assets.error) throw new Error('The story’s cover choices could not be loaded. Try opening it again.');
      return {story:data,assets:assets.data};
    },
    async save(input, previous, status = previous?.status ?? 'draft') {
      const changes = validateStory(input);
      if (!['draft','published'].includes(status)) throw new Error('This story is locked for moderation.');
      if (status === 'published' && !changes.body.trim()) throw new Error('Add your story text before publishing.');
      await authorize();
      let query;
      if (previous) {
        if (!isPublicId(previous.id) || !previous.updated_at) throw new Error('Reopen your story before saving.');
        query = client.from('stories').update({...changes,status}).eq('author_id',ownerId).eq('id',previous.id).eq('updated_at',previous.updated_at);
      } else {
        if (status !== 'draft' || changes.cover_asset_id) throw new Error('Save a draft before publishing or choosing a cover.');
        const {cover_asset_id,...draft} = changes;
        query = client.from('stories').insert({...draft,author_id:ownerId});
      }
      const {data,error} = await query.select(STORY_FIELDS).maybeSingle();
      if (error) failure(error);
      if (!data) throw new StudioConflictError('This story changed elsewhere or is locked. Download your unsaved text, then reopen the story before saving again.');
      return data;
    },
  };
}
