---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.css"
  - "**/*.mdx"
  - "**/next.config.*"
  - "**/tailwind.config.*"
  - "**/postcss.config.*"
  - "**/source.config.ts"
  - "**/registry.json"
  - "**/components.json"
  - "**/*.html"
---

# Frontend

## "Like we had before" is a git lookup
- When the user points at an earlier look ("go back to the X look", "we had this before"), run `git log --oneline --reverse -- <ui files>` first; prior design states are usually commits already.
- Restore measured values verbatim with `git show <sha>:<path>`, then re-apply them on the current structure. Never eyeball equivalents, because a re-derived approximation is never the same color, radius or spacing.
- If several revisions could be the one, show the candidates and let the user pick.

## Headless CMS builds
- Put every page into the CMS as structured blocks and keep all styling in the frontend code. Never paste a page in as a raw/Custom HTML block with its own `<style>`, even when the source site built it as custom code, because that moves design into the CMS and forces editors and agents onto `unfiltered_html` (which can save scripts).
- Before calling a site copy done, check every page for raw-HTML blocks and prove each rebuilt page matches with side-by-side screenshots.
- Tailwind v4 (`@import "tailwindcss"`) scans every repo file, including captured HTML and fixtures, so a CMS class like `invert` becomes a real utility and restyles the CMS page (a grey panel rendered black). In any site that renders CMS HTML, restrict scanning up front:
  ```css
  @import "tailwindcss" source(none);
  @source "../app";
  @source "../components";
  @source "../lib";
  ```

## Next.js dev server traps
- Never run `next build` while `next dev` is up on the same project; both write `.next`, and every route then 500s with `TypeError: __webpack_modules__[moduleId] is not a function` though the source is fine. Fix: stop the dev server, delete `.next`, restart. Give a build its own `distDir` if both must run. Start dev on a clean `.next` after a build. (Next 14.2.35, Windows, 2026-08-06.)
- Open the dev server on the exact host it prints. Next dev blocks cross-origin `/_next/*`, so `127.0.0.1` against a `localhost` server renders HTML that never hydrates, with no console error. The only evidence is dev-server stderr: `Blocked cross-origin request to Next.js dev resource /_next/hmr from "127.0.0.1"`. Fix: use the printed host, or add `allowedDevOrigins: ['127.0.0.1']` to `next.config` and restart. Read stderr before suspecting the code. (This is the opposite of the Postgres DSN advice in the `machine` rule.)

## Fumadocs oversized sidebar
- `DocsLayout`'s `#nd-docs-layout` is a 5-column grid with `1fr` centering gutters, and the sidebar card bleeds across the left gutter, so on wide monitors it balloons with nav crammed on its right. Changing `--fd-layout-width` does not fix it.
- Keep `/docs` out of the marketing chrome: header/footer in a `(site)` route group, `app/docs/` outside it, so `DocsLayout` owns the viewport. No `--fd-banner-height` / `--fd-docs-height` offset hacks.
- Kill the gutters through the documented `containerProps`, not `!important` CSS in globals (fragile, and Turbopack serves it stale). In `app/docs/layout.tsx`:
  ```tsx
  const docsGrid: CSSProperties = {
    gridTemplate: `"sidebar sidebar header toc toc"
  "sidebar sidebar toc-popover toc toc"
  "sidebar sidebar main toc toc" 1fr / 0 var(--fd-sidebar-col) minmax(0,1fr) var(--fd-toc-width) 0`,
  };
  // <DocsLayout {...baseOptions()} containerProps={{ style: docsGrid }}>
  ```
  `var(--fd-sidebar-col)` keeps collapse working. Scope `RootProvider theme={{enabled:false}}` inside the docs layout; the root layout keeps only html/body/ThemeProvider.
- Only if docs must sit under your own sticky header: v16 has no `--fd-nav-height`; set `--fd-banner-height: <hdr>px` and `--fd-docs-height: calc(100dvh - <hdr>px)`.
- Turbopack on Windows often misses `globals.css` edits. Check the value changed in the live page; if stale, stop the server, clear `.next`, restart.

## shadcn registry authoring
- In `registry.json`, a dependency on another item in the same registry must be namespace-qualified (`@<registry>/<item>`). A bare name resolves against ui.shadcn.com and 404s (`The item at https://ui.shadcn.com/r/styles/new-york-v4/<name>.json was not found`).
- shadcn/ui primitives (`button`, `dialog`) stay bare; third-party registry items use the full URL.
- Consumers map `"@<registry>": "<homepage>/r/{name}.json"` under `registries` in `components.json`.
- Verify with `shadcn add @<registry>/<item> --dry-run` in a throwaway project. `~/code/ghl-components` still uses bare sibling names and likely has this bug.

## Mobile and tablet checks
- Never describe a phone layout from the CSS. Render it and measure, because a page that looks right in the stylesheet can still zoom out to desktop scale on a phone.
- Emulate the device, never a narrowed desktop window: `agent-browser set device "iPhone 15 Pro"` (mobile mode, touch, DPR, iOS UA), then override the viewport for newer models (iPhone 17/17 Pro 402x874, Air 420x912, 17 Pro Max 440x956). `set viewport` alone gives desktop rendering and a desktop scrollbar. `-p ios` needs a Mac.
- Proof per device: `window.innerWidth` equals the device width, the mobile layout is active, no desktop scrollbar. Default set: phone 360, 393, 402, 420, 440; tablet 768, 1024; desktop 1280, 1920. When handing a mobile check to an agent, name `set device` and these widths.
- Sidebar-to-stack layouts use `grid-template-columns: minmax(0, 1fr)` and `main { min-width: 0 }`. A bare `1fr` keeps min-content width, so a `nowrap` table or `pre` (even inside `overflow-x: auto`) widens the document and mobile Chrome zooms the whole page out.
- Direct-Playwright fallback on this machine (the Playwright CLI breaks from browser/version drift): `NODE_PATH=C:/Users/HamCh/code/otaku-solutions/node_modules node shot.cjs <dir> C:/Users/HamCh/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, where `shot.cjs` launches `chromium.launch({ executablePath })` with `newContext({ ...devices['Pixel 7'] })`, screenshots top and mid-page, and prints `{ docW: document.documentElement.scrollWidth, vw: window.innerWidth }`. `vw` must be 412. iPhone profiles need WebKit, which is not installed here; use a Pixel profile.
- For Artifact pages, test a copy wrapped in the host's `<!doctype html>…<body>` shell, because the bare file renders in quirks mode and hides the result.
