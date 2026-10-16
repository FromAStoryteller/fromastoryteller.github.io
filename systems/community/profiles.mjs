// The account integration supplies its shared, authenticated Supabase client.
// Never construct a privileged client or accept an editable author ID here.
const fields = 'display_name,bio,welcome_line,public_id';
const length = value => Array.from(value).length;

export function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['display_name', 'bio', 'welcome_line'].includes(key))) {
    throw new Error('Only your profile text can be edited here.');
  }
  if (typeof input.display_name !== 'string' || typeof input.bio !== 'string') {
    throw new Error('Enter a display name and about me as text.');
  }
  const display_name = input.display_name.trim();
  const bio = input.bio.trim();
  if (length(display_name) < 1 || length(display_name) > 80) {
    throw new Error('Use a display name between 1 and 80 characters.');
  }
  if (length(bio) > 1000) throw new Error('Keep about me to 1,000 characters.');
  const welcome_line = input.welcome_line ?? '';
  if (typeof welcome_line !== 'string' || length(welcome_line.trim()) > 160) throw new Error('Keep your welcome line to 160 characters.');
  return { display_name, bio, welcome_line: welcome_line.trim() };
}

function publicFields(row) {
  return { display_name: row.display_name, bio: row.bio, welcome_line: row.welcome_line ?? '', public_id: row.public_id ?? null };
}

export function createProfileService(client) {
  let ownerId;
  async function currentUser() {
    if (client.auth.refreshSession) {
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error || !refreshed.data?.session) throw new Error('Sign in to manage your profile.');
    }
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user || data.user.is_anonymous) throw new Error('Sign in to manage your profile.');
    if (ownerId && ownerId !== data.user.id) throw new Error('Your account changed. Reopen your profile before saving.');
    ownerId = data.user.id;
    return data.user.id;
  }
  return {
    async readOwn() {
      const id = await currentUser();
      const { data, error } = await client.from('profiles').select(fields).eq('id', id).single();
      if (error || !data) throw new Error('Your profile could not be loaded. Please try again.');
      return publicFields(data);
    },
    async saveOwn(input) {
      const changes = validateProfile(input);
      const id = await currentUser();
      const { data, error } = await client.from('profiles').update(changes)
        .eq('id', id).select(fields).single();
      // RLS can return no rows: never report success without the saved record.
      if (error || !data) throw new Error('Your profile could not be saved. Please try again.');
      return publicFields(data);
    },
    async readPublishedAuthor(storySlug) {
      // The public RPC enforces publication even for authors and administrators.
      const { data, error } = await client.rpc('fas_public_story', { story_slug: storySlug });
      if (error) throw new Error('The author could not be loaded.');
      return data?.author ? { display_name: data.author.display_name, public_id: data.author.public_id } : null;
    },
    async readPublic(publicId, offset = 0) {
      if (!isPublicId(publicId)) return null;
      const { data, error } = await client.rpc('fas_public_profile', { profile_key: publicId, page_offset: offset });
      if (error) throw new Error('This storyteller page could not be loaded. Please try again.');
      return data;
    },
    async readStory(slug) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug ?? '') || slug.length > 120) return null;
      const { data, error } = await client.rpc('fas_public_story', { story_slug: slug });
      if (error) throw new Error('This story could not be loaded. Please try again.');
      return data;
    }
  };
}

export function isPublicId(value) {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

export function publicProfileUrl(publicId) {
  return isPublicId(publicId) ? `/storytellers/?author=${encodeURIComponent(publicId)}` : null;
}

export function renderAuthorAttribution(element, profile) {
  // Profile text is untrusted. Do not use innerHTML or fall back to an email.
  element.textContent = profile?.display_name ? `By ${profile.display_name}` : 'Author unavailable';
}
