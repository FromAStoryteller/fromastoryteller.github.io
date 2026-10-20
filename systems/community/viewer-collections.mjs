import { connectViewerAccount } from "./viewer-actions.mjs";
import { createCardMarkup } from "../content/content-system.js";
import { publicCoverUrl } from "./profiles.mjs";
import { signInHref } from "../../account/return-path.mjs";
async function mountViewerCollection(root2, { connect = connectViewerAccount } = {}) {
  const d = root2.ownerDocument, w = d.defaultView, kind = root2.dataset.viewerCollection, title = kind === "favourites" ? "Favourites" : "Saved for later";
  let account, ended = false, cursor = null, loading = false, stop;
  w.addEventListener("pageshow", (event) => {
    if (event.persisted) w.location.reload();
  });
  const node = (tag, text) => {
    const n = d.createElement(tag);
    n.textContent = text;
    return n;
  };
  function fail(text, signIn = false) {
    root2.replaceChildren(node("h1", title), node("p", text));
    const link = node("a", signIn ? "Sign in" : "Reload this collection");
    link.className = "account-secondary";
    link.href = signIn ? signInHref(w.location.pathname) : w.location.pathname;
    root2.append(link);
  }
  try {
    account = await connect();
    if (!account) {
      fail("Sign in to see your private " + title.toLowerCase() + ".", true);
      return;
    }
    stop = account.subscribe(() => {
      ended = true;
      fail("Your account changed. Sign in again to view this collection.", true);
    });
    root2.replaceChildren(node("h1", title), node("p", kind === "favourites" ? "Games and tools you want to return to. Your favourites are private." : "Pieces you have kept for another time. Your saved list is private."));
    const nav = node("nav", "");
    nav.className = "viewer-collection-navigation";
    nav.setAttribute("aria-label", "Your collections");
    for (const [text, href] of [["Saved for later", "/account/saved/"], ["Favourites", "/account/favourites/"]]) {
      const a = node("a", text);
      a.href = href;
      a.className = "account-secondary";
      if (href === w.location.pathname) a.setAttribute("aria-current", "page");
      nav.append(a);
    }
    root2.append(nav);
    const grid = node("div", "");
    grid.className = "content-grid viewer-collection-grid";
    const status = node("p", "Loading your collection…");
    status.setAttribute("role", "status");
    const more = node("button", "Load more");
    more.type = "button";
    more.className = "account-secondary";
    more.hidden = true;
    root2.append(status, grid, more);
    async function load() {
      if (ended || loading) return;
      loading = true;
      more.disabled = true;
      status.textContent = "Loading your collection…";
      try {
        const r = await account.client.rpc("fas_my_viewer_collection", { collection_key: kind, before_time: cursor?.saved_at ?? null, after_id: cursor?.id ?? null });
        if (ended) return;
        if (r.error || !Array.isArray(r.data?.items)) throw Error("Your collection could not load. Please try again.");
        for (const item of r.data.items) {
          const image = item.source === "file" ? item.image : publicCoverUrl(item.cover, account.imageBase);
          grid.insertAdjacentHTML("beforeend", createCardMarkup({ type: item.type, category: { story: "stories", game: "games", tool: "tools", video: "videos" }[item.type] ?? item.type, url: item.url, title: item.title, card: { title: item.title, description: item.summary, image, imageAlt: item.image_alt ?? item.cover?.alt ?? "" } }));
        }
        cursor = r.data.next_cursor;
        more.hidden = !cursor;
        more.textContent = "Load more";
        status.textContent = grid.children.length ? "" : "Nothing here yet. Use the save or favourite button on a piece or card to add it. Published pieces appear here while they are available.";
      } catch (e) {
        if (!ended) {
          status.textContent = e.message;
          more.hidden = false;
          more.textContent = "Try again";
        }
      } finally {
        loading = false;
        more.disabled = false;
      }
    }
    const changed = (event) => {
      if (ended || event.detail?.saved !== false) return;
      const card = [...grid.children].find((c) => c.dataset.viewerContent === event.detail.key);
      if (!card) return;
      const next = card.nextElementSibling ?? card.previousElementSibling;
      card.remove();
      if (next) next.querySelector("button,a")?.focus({ preventScroll: true });
      else {
        nav.querySelector("[aria-current]")?.focus({ preventScroll: true });
        status.textContent = cursor ? "Removed. Load more to see other saved pieces." : "Nothing here yet. Use the save or favourite button on a piece or card to add it.";
      }
    };
    w.addEventListener("fas-viewer-action-change", changed);
    more.onclick = () => void load();
    await load();
    w.addEventListener("pagehide", () => {
      ended = true;
      stop?.();
      w.removeEventListener("fas-viewer-action-change", changed);
    }, { once: true });
  } catch (e) {
    if (!ended) fail(e.message);
  }
}
const root = typeof document !== "undefined" ? document.querySelector("[data-viewer-collection]") : null;
if (root) void mountViewerCollection(root);
export {
  mountViewerCollection
};
