import {watchViewerChanges,publishViewerChanges} from './viewer-sync.mjs';
import { loadLocalAuthClient } from "../../account/local-auth-client.mjs";
import { restoreSession } from "../../account/session-controller.mjs";
import { watchSessionEnd } from "../../account/session-events.mjs";
import { signInHref } from "../../account/return-path.mjs";
const viewerLabels = (type) => ({ saved: ["game", "tool"].includes(type) ? ["Add to favourites", "Favourited"] : ["Save for later", "Saved for later"], experienced: { game: ["I’ve played this", "Played"], tool: ["I’ve used this", "Used"], video: ["Mark as watched", "Watched"], audio: ["Mark as listened", "Listened"] }[type] ?? ["Mark as read", "Read"], loved: ["Loved it", "Loved it"] });
async function connectViewerAccount() {
  const local = await loadLocalAuthClient();
  if (!local) throw Error("Account services are unavailable.");
  const session = await restoreSession(local.client.auth, local.hadSession, () => local.storage.clear());
  if (session.state === "session-unavailable") throw Error("Your account could not be checked. Try again.");
  if (session.state !== "signed-in") return null;
  const identity = await local.client.auth.getUser();
  if (identity.error || !identity.data?.user?.id) throw Error("Your account could not be checked. Try again.");
  const owner = identity.data.user.id;
  return { client: local.client, imageBase: local.publicImageBase, subscribe(end) {
    let ended = false;
    const stop = () => {
      if (!ended) {
        ended = true;
        end();
      }
    };
    const watch = watchSessionEnd(local, stop);
    const sub = local.client.auth.onAuthStateChange((_event, next) => {
      if (next?.user?.id && next.user.id !== owner) stop();
    }).data.subscription;
    return () => {
      watch();
      sub.unsubscribe();
    };
  } };
}
function initViewerActions({ document: d = document, window: w = window, connect = connectViewerAccount } = {}) {
  if (w.location.pathname.startsWith("/tests/") || w.location.pathname.startsWith("/account/studio/")) return;
  if (d.documentElement.dataset.viewerActionsMounted) return;
  d.documentElement.dataset.viewerActionsMounted = "true";
  const writes = /* @__PURE__ */ new Map();
  const states = /* @__PURE__ */ new Map(), pending = /* @__PURE__ */ new Set(), requested = /* @__PURE__ */ new Set(), hosts = /* @__PURE__ */ new Set();
  let account, ready = false, ended = false, epoch = 0, loading, error = "", scheduled = false, stop, stopSync, refreshing = false, refreshQueued = false, readSequence = 0;
  const reads = new Map();
  const node = (tag, text) => {
    const el = d.createElement(tag);
    el.textContent = text;
    return el;
  };
  function status(host, text) {
    const label = host.querySelector("[data-viewer-status]");
    label.textContent = text;
    label.classList.toggle("visually-hidden", text === "Saved." || text === "Saving…" || host.classList.contains("viewer-card-actions") && !host.dataset.viewerInteracted);
  }
  function paint(host) {
    const key = host.dataset.viewerKey, s = states.get(key), labels = viewerLabels(host.dataset.viewerType);
    for (const b of host.querySelectorAll("[data-viewer-action]")) {
      const action = b.dataset.viewerAction, on = s?.[action] === true;
      b.setAttribute("aria-pressed", String(on));
      b.disabled = ended || pending.has(key) || !ready;
      const icon = d.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("aria-hidden", "true");
      icon.setAttribute("focusable", "false");
      icon.dataset.viewerIcon = action;
      icon.setAttribute("fill", on && action !== "experienced" ? "currentColor" : "none");
      icon.setAttribute("stroke", "currentColor");
      icon.setAttribute("stroke-width", "1.7");
      icon.setAttribute("stroke-linecap", "round");
      icon.setAttribute("stroke-linejoin", "round");
      const path = d.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", action === "experienced" ? "m5 12 4 4L19 6" : action === "loved" ? "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" : ["game", "tool"].includes(host.dataset.viewerType) ? "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" : "M6 3h12v18l-6-4-6 4Z");
      icon.append(path);
      b.replaceChildren(icon, node("span", labels[action][on ? 1 : 0]));
      if (host.classList.contains("viewer-card-actions")) {
        const label = labels[action][on ? 1 : 0];
        b.setAttribute("aria-label", label + " — " + (host.closest("article")?.querySelector("h2,h3")?.textContent ?? "content"));
        b.title = label;
      }
    }
    const badge = host.querySelector("[data-viewer-experienced]");
    if (badge) {
      badge.replaceChildren();
      if (s?.experienced) {
        const icon = node("i", "");
        icon.className = "fa-solid fa-check";
        icon.setAttribute("aria-hidden", "true");
        const label = node("span", labels.experienced[1]);
        label.className = "visually-hidden";
        badge.append(icon, label);
        badge.title = labels.experienced[1];
      }
      badge.hidden = !s?.experienced;
    }
  }
  function mount(parent, key, type, actions, card = false) {
    const host = node("div", "");
    host.className = card ? "viewer-card-actions" : "viewer-content-actions";
    host.dataset.viewerKey = key;
    host.dataset.viewerType = type;
    for (const action of actions) {
      const b = node("button", "");
      b.type = "button";
      b.className = "viewer-action";
      b.dataset.viewerAction = action;
      host.append(b);
    }
    if (card) {
      const badge = node("span", "");
      badge.dataset.viewerExperienced = "";
      badge.className = "viewer-experienced";
      badge.hidden = true;
      host.append(badge);
    }
    const text = node("span", "");
    text.dataset.viewerStatus = "";
    text.className = "viewer-action-status";
    text.setAttribute("role", "status");
    host.append(text);
    parent.append(host);
    hosts.add(host);
    paint(host);
    return host;
  }
  function scan() {
    scheduled = false;
    for (const host of hosts) if (!host.isConnected) hosts.delete(host);
    for (const card of d.querySelectorAll(".content-grid-card[data-viewer-content],.content-featured-card[data-viewer-content]")) if (!card.querySelector(".viewer-card-actions")) mount(card, card.dataset.viewerContent, card.dataset.viewerContentType, ["saved"], true);
    if (!w.location.pathname.startsWith("/account/") && !w.location.pathname.startsWith("/tests/")) {
      const hero = d.querySelector("main .story-header,main .game-hero,main .tool-hero,main .video-hero");
      if (hero && !hero.dataset.viewerSaveMounted) {
        const article = hero.closest("[data-current-content-id]"), type = article?.dataset.contentLayout ?? article?.dataset.contentType ?? hero.dataset.contentLayout ?? "story", key = /^\/(stories|games|tools|blog|videos)\/[a-z0-9][a-z0-9-]{0,119}\/$/.test(w.location.pathname) ? w.location.pathname : hero.closest("[data-viewer-content-path]")?.dataset.viewerContentPath ?? (/^[0-9a-f-]{36}$/i.test(article?.dataset.currentContentId ?? "") ? article.dataset.currentContentId : w.location.pathname.replace(/index\.html$/, ""));
        hero.dataset.viewerSaveMounted = "true";
        const save = mount(hero, key, type, ["saved"]);
        hero.after(save);
        const footer = d.querySelector(".story-footer") ?? hero.closest("article") ?? d.querySelector("main");
        const bottom = mount(footer, key, type, ["experienced", "loved"]);
        if (footer.matches(".story-footer")) (footer.querySelector(".storyteller-socials,.story-return-link") ?? bottom).before(bottom);
        if (!footer.matches(".story-footer") && footer.querySelector(".content-next-section,.related-content,[data-related-content]")) footer.querySelector(".content-next-section,.related-content,[data-related-content]").before(bottom);
      }
    }
    const keys = [...new Set([...hosts].map((h) => h.dataset.viewerKey))];
    if (keys.length && !loading && !ready) void initialize();
    if (ready && account && !ended) void hydrate(keys.filter((k) => !requested.has(k)));
  }
  function schedule() {
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(scan);
    }
  }
  async function initialize() {
    loading = true;
    try {
      account = await connect();
      if (ended) return;
      ready = true;
      error = "";
      if (account) stop = account.subscribe(() => {
        ended = true;
        epoch++;
        account = null;
        stopSync?.();
        reads.clear();
        states.clear();
        writes.clear();
        requested.clear();
        pending.clear();
        for (const h of hosts) {
          paint(h);
          status(h, "Your account changed. Reload to continue.");
        }
      });
      if (account && !ended) stopSync = watchViewerChanges(() => void refresh(), {window:w,document:d});
      for (const h of hosts) {
        paint(h);
        status(h, "");
      }
      schedule();
    } catch (e) {
      ready = true;
      error = e.message;
      for (const h of hosts) {
        paint(h);
        status(h, error);
      }
    } finally {
      loading = false;
    }
  }
  async function hydrate(keys) {
    if (!keys.length) return;
    keys.forEach((k) => requested.add(k));
    const version = epoch;
    try {
      for (let i = 0; i < keys.length; i += 100) {
        const batch = keys.slice(i, i + 100), sequence = ++readSequence, before = new Map(writes);
        batch.forEach(key => reads.set(key,sequence));
        const r = await account.client.rpc("fas_my_viewer_actions", { content_keys: batch });
        if (r.error || !Array.isArray(r.data)) throw Error("Your saved status could not load. Select an action to retry.");
        if (ended || version !== epoch) return;
        // A response may replace an earlier local write, but never a write or
        // newer read that started after this request.
        const applied = new Set();
        for (const s of r.data ?? []) if (!pending.has(s.key) && reads.get(s.key) === sequence && writes.get(s.id) === before.get(s.id)) {
          states.set(s.key,s); applied.add(s.key);
        }
        for (const h of hosts) if (applied.has(h.dataset.viewerKey)) {
          paint(h);
          status(h, "");
        }
      }
    } catch (e) {
      if (!ended && version === epoch) {
        for (const h of hosts) if (keys.includes(h.dataset.viewerKey)) status(h, e.message);
      }
    }
  }
  async function refresh() {
    if (!ready || !account || ended) return;
    if (refreshing || pending.size) { refreshQueued = true; return; }
    refreshing = true; refreshQueued = false;
    try { await hydrate([...new Set([...hosts].filter(h=>h.isConnected).map(h=>h.dataset.viewerKey))]); }
    finally { refreshing = false; if (refreshQueued && !pending.size && !ended) void refresh(); }
  }
  const collectionRendered = () => { schedule(); queueMicrotask(() => void refresh()); };
  w.addEventListener('fas-viewer-collection-rendered',collectionRendered);
  d.addEventListener("click", async (event) => {
    const b = event.target.closest("[data-viewer-action]");
    if (!b) return;
    const host = b.closest("[data-viewer-key]");
    if (!hosts.has(host)) return;
    event.preventDefault();
    event.stopPropagation();
    host.dataset.viewerInteracted = "true";
    const key = host.dataset.viewerKey, action = b.dataset.viewerAction;
    if (ended) return;
    if (error) {
      ready = false;
      error = "";
      void initialize();
      return;
    }
    if (!account) {
      w.location.assign(signInHref(w.location.pathname + w.location.search));
      return;
    }
    if (pending.has(key)) return;
    pending.add(key);
    for (const h of hosts) if (h.dataset.viewerKey === key) {
      paint(h);
      status(h, "Saving…");
    }
    try {
      let state = states.get(key);
      if (!state) {
        const check = await account.client.rpc("fas_my_viewer_actions", { content_keys: [key] });
        if (check.error || !check.data?.[0]) throw Error("This content or your account is unavailable. Reload and try again.");
        state = check.data[0];
      }
      if (ended) return;
      const r = await account.client.rpc("fas_set_viewer_action", { content_key: key, action_key: action, enabled: !state[action] });
      if (r.error || !r.data) throw Error("Your change could not be saved. Please try again.");
      if (ended) return;
      writes.set(r.data.id, r.data);
      publishViewerChanges(w);
      states.set(key, r.data);
      for (const [alias, value] of states) if (value.id === r.data.id) states.set(alias, { ...r.data, key: alias });
      w.dispatchEvent(new CustomEvent("fas-viewer-action-change", { detail: { key, ...r.data } }));
      for (const h of hosts) if (states.get(h.dataset.viewerKey)?.id === r.data.id) {
        paint(h);
        status(h, "Saved.");
      }
    } catch (e) {
      if (!ended) {
        for (const h of hosts) if (h.dataset.viewerKey === key) status(h, e.message);
      }
    } finally {
      pending.delete(key);
      for (const h of hosts) if (h.dataset.viewerKey === key) paint(h);
      if (refreshQueued && !pending.size) void refresh();
    }
  });
  w.addEventListener("pageshow", (event) => {
    if (event.persisted) w.location.reload();
  });
  const observer = new w.MutationObserver(schedule);
  observer.observe(d.body, { childList: true, subtree: true });
  scan();
  w.addEventListener("pagehide", () => {
    ended = true;
    epoch++;
    observer.disconnect();
    stop?.();
    stopSync?.();
    reads.clear();
    w.removeEventListener('fas-viewer-collection-rendered',collectionRendered);
    for (const h of hosts) {
      states.delete(h.dataset.viewerKey);
      paint(h);
    }
    states.clear();
    writes.clear();
  }, { once: true });
}
export {
  connectViewerAccount,
  initViewerActions,
  viewerLabels
};
