import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeContentMeta, sortContent, createCardMarkup } from "../content/content-system.js";

const SITE_ORIGIN = "https://fromastoryteller.com";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CONTENT_ROOTS = ["games", "tools", "stories", "videos", "blog"];
const CONTENT_ROOT_ORDER = new Map(
  CONTENT_ROOTS.map((name, index) => [name, index])
);

const STATIC_PAGE_GROUPS = [
  {
    label: "HOME",
    pages: ["/"]
  },
  {
    label: "MAIN SECTIONS",
    pages: [
      "/about/",
      "/contact/",
      "/games/",
      "/stories/",
      "/tools/"
    ]
  },
  {
    label: "LEGAL",
    pages: [
      "/privacy/",
      "/terms/"
    ]
  }
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

  validateIndexableHtml(pagePath, canonicalUrl);
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

    published.push({ metaPath, meta, ...validated });
  }

  return published.sort(comparePublishedItems);
}

function validateStaticPages() {
  for (const group of STATIC_PAGE_GROUPS) {
    for (const urlPath of group.pages) {
      const pagePath =
        urlPath === "/"
          ? join(ROOT, "index.html")
          : join(ROOT, urlPath.replace(/^\//, ""), "index.html");

      if (!existsSync(pagePath) || !statSync(pagePath).isFile()) {
        fail(`Static sitemap page ${urlPath} has no matching index.html.`);
      }
      validateIndexableHtml(pagePath, new URL(urlPath, SITE_ORIGIN).href);
    }
  }
}

function attributes(tag) {
  return Object.fromEntries(Array.from(tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs),
    match => [match[1].toLowerCase(), match[3]]));
}

function validateIndexableHtml(pagePath, canonicalUrl) {
  const html = readFileSync(pagePath, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
  const links = Array.from(head.matchAll(/<link\b[^>]*>/gi), match => attributes(match[0]));
  const canonical = links.filter(tag => tag.rel?.toLowerCase() === "canonical");
  if (canonical.length !== 1 || canonical[0].href !== canonicalUrl) {
    fail(`${relative(ROOT, pagePath)} must have exactly one head canonical matching ${canonicalUrl}.`);
  }
  const metas = Array.from(head.matchAll(/<meta\b[^>]*>/gi), match => attributes(match[0]));
  if (metas.some(tag => ["robots", "googlebot"].includes(tag.name?.toLowerCase()) &&
      /(?:^|[\s,])(noindex|none)(?:$|[\s,])/i.test(tag.content || ""))) {
    fail(`${relative(ROOT, pagePath)} is noindexed but included in the sitemap.`);
  }
  if (metas.some(tag => tag["http-equiv"]?.toLowerCase() === "refresh")) {
    fail(`${relative(ROOT, pagePath)} redirects but is included in the sitemap.`);
  }
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
  const text = main.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, "").trim();
  if (!text || !/<h1\b[^>]*>[^<\s]/i.test(main)) {
    fail(`${relative(ROOT, pagePath)} has no meaningful main content or heading.`);
  }
}

function replaceGenerated(html, id, markup, tagName = "div") {
  const start = `<!-- static:${id}:start -->`;
  const end = `<!-- static:${id}:end -->`;
  const region = `${start}\n${markup}\n${end}`;
  if (html.includes(start)) {
    const begin = html.indexOf(start);
    const finish = html.indexOf(end, begin);
    if (finish < 0) fail(`Missing generated closing marker: ${id}`);
    return html.slice(0, begin) + region + html.slice(finish + end.length);
  }
  const empty = new RegExp(`(<${tagName}\\b[^>]*\\bid=["']${id}["'][^>]*>)\\s*(<\\/${tagName}>)`);
  if (!empty.test(html)) fail(`Missing empty container or generated markers: ${id}`);
  return html.replace(empty, (_, open, close) => `${open}\n${region}\n${close}`);
}

function generateStaticHtml(items) {
  // Use the same card renderer and sorting as the interactive browser listing.
  const content = sortContent(items.map(item => normalizeContentMeta(item.meta)));
  const components = ["header", "sidebar"].map(name => ({
    id: `${name}-placeholder`,
    html: readFileSync(join(ROOT, "components", `${name}.html`), "utf8")
      .replace(name === "header" ? "<header " : "<aside ",
        name === "header" ? "<header data-static-component " : "<aside data-static-component ")
  }));
  const pagePaths = [
    ...STATIC_PAGE_GROUPS.flatMap(group => group.pages), "/blog/", "/videos/", "/search/",
    ...items.map(item => item.url)
  ];
  for (const urlPath of new Set(pagePaths)) {
    const path = join(ROOT, urlPath.replace(/^\//, ""), "index.html");
    let html = readFileSync(path, "utf8");
    for (const component of components) html = replaceGenerated(html, component.id, component.html.trim());
    const section = urlPath === "/" ? "home" : urlPath.split("/")[1];
    if (urlPath === "/" || CONTENT_ROOTS.some(name => urlPath === `/${name}/`)) {
      const categoryItems = section === "home" ? content : content.filter(item => item.category === section);
      const empty = section === "blog" ? "No blogs found yet." : section === "videos" ? "No videos found yet." : "Nothing to show yet.";
      const markup = categoryItems.map(createCardMarkup).join("\n") || `<p class="content-grid-empty">${empty}</p>`;
      html = replaceGenerated(html, `${section}-grid`, markup, "section");
    }
    writeIfChanged(path, html);
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

function formatJsonArrayGroup(paths, isLastGroup) {
  return paths
    .map((path, index) => {
      const isLastItem = index === paths.length - 1;
      const needsComma = !isLastItem || !isLastGroup;
      return `  ${JSON.stringify(path)}${needsComma ? "," : ""}`;
    })
    .join("\n");
}

function buildContentIndex(items) {
  const groups = CONTENT_ROOTS
    .map((rootName) => ({
      rootName,
      paths: items
        .filter((item) => getRootName(item.metaPath) === rootName)
        .map((item) => `/${item.metaPath}`)
    }))
    .filter((group) => group.paths.length > 0);

  const body = groups
    .map((group, index) =>
      formatJsonArrayGroup(group.paths, index === groups.length - 1)
    )
    .join("\n\n");

  return `[\n${body}\n]\n`;
}

function buildStaticSitemapGroup(label, pages) {
  const urls = pages
    .map((urlPath) => {
      const loc = new URL(urlPath, SITE_ORIGIN).toString();

      return [
        "  <url>",
        `    <loc>${xmlEscape(loc)}</loc>`,
        "  </url>"
      ].join("\n");
    })
    .join("\n\n");

  return `  <!-- ${label} -->\n${urls}`;
}

function buildDynamicSitemapGroup(rootName, items) {
  const groupItems = items.filter(
    (item) => getRootName(item.metaPath) === rootName
  );

  if (groupItems.length === 0) return "";

  const label = rootName.toUpperCase();

  const urls = groupItems
    .map((item) => [
      "  <url>",
      `    <loc>${xmlEscape(item.canonicalUrl)}</loc>`,
      `    <lastmod>${xmlEscape(item.dateModified)}</lastmod>`,
      "  </url>"
    ].join("\n"))
    .join("\n\n");

  return `  <!-- ${label} -->\n${urls}`;
}

function buildSitemap(items) {
  const sections = [];

  for (const group of STATIC_PAGE_GROUPS) {
    if (group.label === "LEGAL") continue;
    sections.push(buildStaticSitemapGroup(group.label, group.pages));
  }

  for (const rootName of CONTENT_ROOTS) {
    const section = buildDynamicSitemapGroup(rootName, items);
    if (section) sections.push(section);
  }

  const legalGroup = STATIC_PAGE_GROUPS.find((group) => group.label === "LEGAL");
  if (legalGroup) {
    sections.push(buildStaticSitemapGroup(legalGroup.label, legalGroup.pages));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n${sections.join("\n\n")}\n\n</urlset>\n`;
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
  generateStaticHtml(publishedItems);
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
