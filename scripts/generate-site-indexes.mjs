import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ORIGIN = "https://fromastoryteller.com";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CONTENT_ROOTS = ["games", "tools", "stories", "videos", "blog"];
const CONTENT_ROOT_ORDER = new Map(
  CONTENT_ROOTS.map((name, index) => [name, index])
);

const STATIC_PAGES = [
  "/",
  "/about/",
  "/contact/",
  "/blog/",
  "/games/",
  "/stories/",
  "/tools/",
  "/videos/",
  "/privacy/",
  "/terms/"
];

const CONTENT_INDEX_PATH = join(ROOT, "content", "content-index.json");
const SITEMAP_PATH = join(ROOT, "sitemap.xml");

function toPosixPath(value) {
  return value.split(sep).join("/");
}

function fail(message) {
  throw new Error(`[site-indexes] ${message}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Could not read valid JSON from ${relative(ROOT, path)}: ${error.message}`);
  }
}

function collectMetaFiles(directory, output = []) {
  if (!existsSync(directory)) return output;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      collectMetaFiles(fullPath, output);
    } else if (entry.isFile() && entry.name === "meta.json") {
      output.push(fullPath);
    }
  }

  return output;
}

function isPublished(meta) {
  return meta?.status === "published" && meta?.draft !== true;
}

function requireString(meta, key, metaPath) {
  const value = meta?.[key];

  if (typeof value !== "string" || !value.trim()) {
    fail(`Published file ${metaPath} is missing required field "${key}".`);
  }

  return value.trim();
}

function normaliseUrlPath(urlPath) {
  return urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
}

function validatePublishedMeta(meta, metaPath, absoluteMetaPath) {
  const url = normaliseUrlPath(requireString(meta, "url", metaPath));
  const canonicalUrl = requireString(meta, "canonicalUrl", metaPath);
  const datePublished = requireString(meta, "datePublished", metaPath);
  const dateModified =
    typeof meta?.dateModified === "string" && meta.dateModified.trim()
      ? meta.dateModified.trim()
      : datePublished;

  if (!canonicalUrl.startsWith(`${SITE_ORIGIN}/`) && canonicalUrl !== `${SITE_ORIGIN}/`) {
    fail(
      `Published file ${metaPath} has canonicalUrl outside ${SITE_ORIGIN}: ${canonicalUrl}`
    );
  }

  const expectedCanonical = new URL(url, SITE_ORIGIN).toString();

  if (canonicalUrl !== expectedCanonical) {
    fail(
      `Published file ${metaPath} has mismatched url/canonicalUrl. Expected ${expectedCanonical}, found ${canonicalUrl}.`
    );
  }

  const pagePath = join(dirname(absoluteMetaPath), "index.html");

  if (!existsSync(pagePath) || !statSync(pagePath).isFile()) {
    fail(`Published file ${metaPath} has no matching index.html.`);
  }

  return { url, canonicalUrl, datePublished, dateModified };
}

function getRootName(metaPath) {
  return metaPath.split("/")[0] || "";
}

function comparePublishedItems(a, b) {
  const rootA = CONTENT_ROOT_ORDER.get(getRootName(a.metaPath)) ?? 999;
  const rootB = CONTENT_ROOT_ORDER.get(getRootName(b.metaPath)) ?? 999;

  if (rootA !== rootB) return rootA - rootB;

  const dateCompare = a.datePublished.localeCompare(b.datePublished);
  if (dateCompare !== 0) return dateCompare;

  return a.metaPath.localeCompare(b.metaPath);
}

function getPublishedItems() {
  const metaFiles = CONTENT_ROOTS.flatMap((rootName) =>
    collectMetaFiles(join(ROOT, rootName))
  );

  const published = [];
  const seenUrls = new Map();
  const seenCanonicalUrls = new Map();

  for (const absoluteMetaPath of metaFiles) {
    const metaPath = toPosixPath(relative(ROOT, absoluteMetaPath));
    const meta = readJson(absoluteMetaPath);

    if (!isPublished(meta)) continue;

    const validated = validatePublishedMeta(meta, metaPath, absoluteMetaPath);

    if (seenUrls.has(validated.url)) {
      fail(
        `Duplicate published url ${validated.url} in ${seenUrls.get(validated.url)} and ${metaPath}.`
      );
    }

    if (seenCanonicalUrls.has(validated.canonicalUrl)) {
      fail(
        `Duplicate canonicalUrl ${validated.canonicalUrl} in ${seenCanonicalUrls.get(validated.canonicalUrl)} and ${metaPath}.`
      );
    }

    seenUrls.set(validated.url, metaPath);
    seenCanonicalUrls.set(validated.canonicalUrl, metaPath);

    published.push({ metaPath, ...validated });
  }

  return published.sort(comparePublishedItems);
}

function validateStaticPages() {
  for (const urlPath of STATIC_PAGES) {
    const pagePath =
      urlPath === "/"
        ? join(ROOT, "index.html")
        : join(ROOT, urlPath.replace(/^\//, ""), "index.html");

    if (!existsSync(pagePath) || !statSync(pagePath).isFile()) {
      fail(`Static sitemap page ${urlPath} has no matching index.html.`);
    }
  }
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildContentIndex(items) {
  return `${JSON.stringify(items.map(({ metaPath }) => `/${metaPath}`), null, 2)}\n`;
}

function buildSitemap(items) {
  const staticEntries = STATIC_PAGES.map((urlPath) => ({
    loc: new URL(urlPath, SITE_ORIGIN).toString()
  }));

  const dynamicEntries = items.map((item) => ({
    loc: item.canonicalUrl,
    lastmod: item.dateModified
  }));

  const body = [...staticEntries, ...dynamicEntries]
    .map((entry) => {
      const lines = ["  <url>", `    <loc>${xmlEscape(entry.loc)}</loc>`];

      if (entry.lastmod) {
        lines.push(`    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
      }

      lines.push("  </url>");
      return lines.join("\n");
    })
    .join("\n\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n${body}\n\n</urlset>\n`;
}

function writeIfChanged(path, content) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;

  if (current === content) return false;

  writeFileSync(path, content, "utf8");
  return true;
}

function main() {
  validateStaticPages();

  const publishedItems = getPublishedItems();
  const contentIndexChanged = writeIfChanged(
    CONTENT_INDEX_PATH,
    buildContentIndex(publishedItems)
  );
  const sitemapChanged = writeIfChanged(
    SITEMAP_PATH,
    buildSitemap(publishedItems)
  );

  console.log(`[site-indexes] ${publishedItems.length} published content item(s) found.`);
  console.log(
    `[site-indexes] content/content-index.json ${contentIndexChanged ? "updated" : "already current"}.`
  );
  console.log(
    `[site-indexes] sitemap.xml ${sitemapChanged ? "updated" : "already current"}.`
  );
}

main();
