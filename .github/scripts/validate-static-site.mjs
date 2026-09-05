import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const failures = [];
const requiredFiles = [
  "index.html",
  "404.html",
  "styles.css",
  "favicon.svg",
  "robots.txt",
  "sitemap.xml",
];

const read = (file) => readFileSync(resolve(root, file), "utf8");
const bytes = (file) => statSync(resolve(root, file)).size;

for (const file of requiredFiles) {
  try {
    statSync(resolve(root, file));
  } catch {
    failures.push(`Missing required file: ${file}`);
  }
}

if (failures.length === 0) {
  const index = read("index.html");
  const notFound = read("404.html");
  const css = read("styles.css");
  const favicon = read("favicon.svg");
  const robots = read("robots.txt");
  const sitemap = read("sitemap.xml");
  const documents = [index, notFound];

  const requiredDestinations = [
    "https://tetizz.github.io/Home/",
    "https://tetizz.github.io/Play/",
    "https://tetizz.github.io/Bookup/",
    "https://tetizz.github.io/Connections/",
    "https://tetizz.github.io/progressive/",
    "https://tetizz.github.io/chess-notes-/",
    "https://github.com/tetizz",
  ];

  for (const destination of requiredDestinations) {
    if (!index.includes(`href="${destination}`)) {
      failures.push(`Homepage is missing destination: ${destination}`);
    }
  }

  for (const [name, html] of [["index.html", index], ["404.html", notFound]]) {
    for (const marker of [
      '<meta name="viewport"',
      'http-equiv="Content-Security-Policy"',
      '<a class="skip-link"',
      "<header",
      "<nav",
      "<main",
    ]) {
      if (!html.includes(marker)) {
        failures.push(`${name} is missing required markup: ${marker}`);
      }
    }

    if (/<script\b/i.test(html)) {
      failures.push(`${name} must remain runtime-JavaScript free`);
    }

    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    for (const match of html.matchAll(/href="#([^"]+)"/g)) {
      if (!ids.has(match[1])) {
        failures.push(`${name} links to missing fragment #${match[1]}`);
      }
    }

    for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
      const href = match[1];
      if (!href.startsWith("https://") && !href.startsWith("#") && !href.startsWith("/")) {
        failures.push(`${name} contains a non-absolute navigation link: ${href}`);
      }
    }
  }

  if (!index.includes('<section class="projects" id="projects"')) {
    failures.push("Homepage is missing the project directory landmark");
  }

  if (!index.includes("<h1>tetizz.github.io</h1>")) {
    failures.push("Homepage must retain the original plain repository title");
  }

  if (!css.includes("@media (prefers-reduced-motion: reduce)")) {
    failures.push("Stylesheet is missing reduced-motion handling");
  }

  if (!css.includes(":focus-visible")) {
    failures.push("Stylesheet is missing a visible keyboard-focus treatment");
  }

  if (css.includes("min-width: 320px")) {
    failures.push("Stylesheet must allow narrow viewports without a fixed width floor");
  }

  if (/url\s*\(\s*["']?https?:/i.test(css)) {
    failures.push("Stylesheet must not fetch external runtime assets");
  }

  const keyframeBlocks = css.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?)\n\}/g);
  const allowedAnimatedProperties = new Set(["opacity", "transform"]);
  for (const block of keyframeBlocks) {
    for (const declaration of block[1].matchAll(/^\s*([a-z-]+)\s*:/gm)) {
      if (!allowedAnimatedProperties.has(declaration[1])) {
        failures.push(`Animation changes disallowed property: ${declaration[1]}`);
      }
    }
  }

  for (const transition of css.matchAll(/transition\s*:\s*([^;]+)/g)) {
    const withoutTimingFunctions = transition[1].replace(/\([^)]*\)/g, "");
    for (const item of withoutTimingFunctions.split(",")) {
      const property = item.trim().split(/\s+/)[0];
      if (!allowedAnimatedProperties.has(property)) {
        failures.push(`Transition changes disallowed property: ${property}`);
      }
    }
  }

  const tagCount = (index.match(/<[a-z][^>]*>/gi) ?? []).length;
  if (tagCount > 230) {
    failures.push(`Homepage DOM budget exceeded: ${tagCount} elements (max 230)`);
  }

  const payloadBytes = requiredFiles.reduce((sum, file) => sum + bytes(file), 0);
  if (bytes("index.html") > 18 * 1024) {
    failures.push(`Homepage budget exceeded: ${bytes("index.html")} bytes`);
  }
  if (bytes("styles.css") > 24 * 1024) {
    failures.push(`Stylesheet budget exceeded: ${bytes("styles.css")} bytes`);
  }
  if (payloadBytes > 45 * 1024) {
    failures.push(`Total first-party payload budget exceeded: ${payloadBytes} bytes`);
  }

  if (!favicon.startsWith("<svg") || /<script\b/i.test(favicon)) {
    failures.push("Favicon must be a script-free inline SVG document");
  }

  if (!robots.includes("Sitemap: https://tetizz.github.io/sitemap.xml")) {
    failures.push("robots.txt must advertise the canonical sitemap");
  }

  if (!sitemap.includes("<loc>https://tetizz.github.io/</loc>")) {
    failures.push("Sitemap must include the canonical homepage");
  }

  if (!documents.every((html) => !/fonts\.(googleapis|gstatic)\.com/i.test(html))) {
    failures.push("HTML must use system fonts without external font requests");
  }

  if (failures.length === 0) {
    console.log(`Validated ${root}`);
    console.log(`Homepage elements: ${tagCount}/230`);
    console.log(`Static payload: ${payloadBytes}/46080 bytes`);
    console.log("Runtime JavaScript: 0 bytes");
  }
}

if (failures.length > 0) {
  console.error("Static-site validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
