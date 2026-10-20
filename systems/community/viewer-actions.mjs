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
  let account, ready = false, ended = false, epoch = 0, loading, error = "", scheduled = false, stop;
  const node = (tag, text) => {
    const el = d.createElement(tag);
    el.textContent = text;
    return el;
  };
  function status(host, text) {
    const label = host.querySelector("[data-viewer-status]");
    label.textContent = text;
    label.classList.toggle("visually-hidden", text === "Saved." || text === "Saving…");
  }
  function paint(host) {
    const key = host.dataset.viewerKey, s = states.get(key), labels = viewerLabels(host.dataset.viewerType);
    for (const b of host.querySelectorAll("[data-viewer-action]")) {
      const action = b.dataset.viewerAction, on = s?.[action] === true;
      b.setAttribute("aria-pressed", String(on));
      b.disabled = ended || pending.has(key) || !ready;
      const icon = node("i", "");
      icon.className = "fa-solid " + { saved: ["game", "tool"].includes(host.dataset.viewerType) ? "fa-star" : "fa-bookmark", experienced: "fa-check", loved: "fa-heart" }[action];
      icon.setAttribute("aria-hidden", "true");
      b.replaceChildren(icon, node("span", labels[action][on ? 1 : 0]));
      if (host.classList.contains("viewer-card-actions")) b.setAttribute("aria-label", labels[action][on ? 1 : 0] + " — " + (host.closest("article")?.querySelector("h3")?.textContent ?? "content"));
    }
    const badge = host.querySelector("[data-viewer-experienced]");
    if (badge) {
      badge.textContent = s?.experienced ? "✓ " + labels.experienced[1] : "";
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
    for (const card of d.querySelectorAll(".content-grid-card[data-viewer-content]")) if (!card.querySelector(".viewer-card-actions")) mount(card, card.dataset.viewerContent, card.dataset.viewerContentType, ["saved"], true);
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
        states.clear();
        writes.clear();
        requested.clear();
        pending.clear();
        for (const h of hosts) {
          paint(h);
          status(h, "Your account changed. Reload to continue.");
        }
      });
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
        const batch = keys.slice(i, i + 100), r = await account.client.rpc("fas_my_viewer_actions", { content_keys: batch });
        if (r.error) throw Error("Your saved status could not load. Select an action to retry.");
        if (ended || version !== epoch) return;
        for (const s of r.data ?? []) if (!pending.has(s.key)) states.set(s.key, { ...writes.get(s.id) ?? s, key: s.key });
        for (const h of hosts) if (batch.includes(h.dataset.viewerKey)) {
          paint(h);
          status(h, "");
        }
      }
    } catch (e) {
      if (!ended) {
        for (const h of hosts) if (keys.includes(h.dataset.viewerKey)) status(h, e.message);
      }
    }
  }
  d.addEventListener("click", async (event) => {
    const b = event.target.closest("[data-viewer-action]");
    if (!b) return;
    const host = b.closest("[data-viewer-key]");
    if (!hosts.has(host)) return;
    event.preventDefault();
    event.stopPropagation();
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
