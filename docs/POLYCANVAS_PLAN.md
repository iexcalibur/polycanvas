# PolyCanvas — separating the edgeless canvas from Polymind

Status: plan + verified fork. Written 2026-10-14.

PolyCanvas is a fork of Polymind that ships **only the edgeless (infinite) canvas**.
Opening the app lands you on a canvas. There is no "notes vs canvas" split, no page
mode switch, and none of the note-taking shell around it (journals, tags,
collections, AI chat, meetings).

The UI of the canvas itself is copied 1:1 from Polymind/Blockmind. Nothing inside
`blockmind/` changes in the first passes.

---

## 1. How edgeless actually works inside Polymind (findings)

These findings drive the plan. Everything was read from the source, not guessed.

**Edgeless is a doc _mode_, not a separate app.**
Every doc has a `primaryMode` property (`'page' | 'edgeless'`) stored on the
`DocRecord` (`packages/frontend/core/src/modules/doc/entities/record.ts`). It is set at
creation by `DocsService.createDoc({ primaryMode })`
(`modules/doc/services/docs.ts:144`). When the caller gives no mode, the
`EditorSettingDocCreateMiddleware` fills it from the user setting
`newDocDefaultMode`, whose schema default is `'page'`
(`modules/editor-setting/schema.ts:23`).

**The live mode is `EditorService.editor.mode$`.**
`modules/editor/entities/editor.ts` starts it at `'page'`, and `bindWorkbenchView`
syncs it both ways with the `?mode=` query string of the workbench view, defaulting to
the doc's `primaryMode`. `editor.setMode('edgeless')` is all it takes to flip a doc.

**Rendering picks one of two Lit editors.**
`components/page-detail-editor.tsx` → `blockmind/block-suite-editor/blockmind-editor.tsx`
renders `<page-editor>` or `<edgeless-editor>` based on `mode`
(`core/src/blockmind/editors/{page,edgeless}-editor.ts`). The edgeless editor is a
thin host that builds a `BlockStdScope` with the edgeless specs.

**The whole canvas engine lives in `blockmind/` and stays untouched.**

| Area                                                                            | Location (under `blockmind/polymind/`)                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Edgeless root block, spec, service, keyboard                                    | `blocks/root/src/edgeless/`                                                           |
| Surface block (the canvas data layer)                                           | `blocks/surface/`                                                                     |
| Shapes, brush, connector, mindmap, text, group, link, templates, turbo-renderer | `gfx/*`                                                                               |
| Toolbar, zoom toolbar, selected rect, dragging area, auto-connect               | `widgets/edgeless-*`                                                                  |
| Frames, frame panel, edgeless text, surface-ref                                 | `blocks/frame`, `fragments/frame-panel`, `blocks/edgeless-text`, `blocks/surface-ref` |
| Canvas templates (gitignored, generated at install)                             | `packages/frontend/templates/edgeless/` via `build-edgeless.mjs`                      |

**An edgeless doc still contains page blocks.** Text on the canvas is a `note` block
holding paragraphs, lists, code, database, etc. So the "page" block packages are
_not_ removable. What is removable is the page _shell_: page-mode editor host, mode
switch, outline, journals, and so on.

**Route flow today.**
`/` → `desktop/pages/index/index.tsx` → welcome screen on first launch → creates a
`local` workspace → navigates to `/workspace/:id/all`. The inner routes live in
`desktop/workbench-router.ts` (`/all`, `/collection`, `/tag`, `/trash`, `/journals`,
`/chat`, `/settings`, `/:pageId`). A doc renders through
`desktop/pages/workspace/detail-page/detail-page.tsx`.

**The shell around the editor** (what makes it feel like a note app):

- `components/root-app-sidebar/` — workspace switcher, quick search, new page,
  journal button, recent chats, organize, tags, collections, trash, settings.
- `detail-page-header.tsx` — `EditorModeSwitch`, title, favorite, info, present,
  journal date picker, menu.
- `detail-page.tsx` sidebar tabs — chat, properties, journal, outline, frame,
  adapter, transcript.
- `layouts/workspace-layout.tsx` — `AIIsland`, `MeetingIsland`.
- Settings dialog sections — about, ai, appearance, backup, editor (page + edgeless),
  experimental, meetings, shortcuts.

---

## 2. What was done today (Phase 0 — the fork)

- Copied `/Users/shubham/Desktop/polymind` → `/Users/shubham/Desktop/PolyCanvas`
  with `rsync -a`, **excluding**: Rust `target/` (6.6 GB of build cache), the outer
  `.git` (380 MB), the nested `blockmind/.git` (91 MB), `.claude/worktrees`, lint
  caches and `.DS_Store`. 153,802 files copied; the 18 file difference is exactly
  those excluded caches.
- Removed the copied Swift build cache
  `packages/frontend/native/transcription-server/.build/` (1.0 GB, gitignored,
  meeting-transcription only). The original in Polymind is untouched.
- `git init -b main` in PolyCanvas. No commits were made; that is yours to do.
- `.gitignore`: the line `/blockmind/` was commented out. In Polymind, Blockmind was
  a separate nested git repo (origin `iexcalibur/blockmind`, upstream
  `toeverything/blocksuite`) and was ignored by the outer repo. In PolyCanvas it is
  plain in-tree source and will be tracked. See the risk note in §6 if you want to
  keep it as a submodule instead.
- `tools/cli/src/rspack-shared/html-plugin.ts`: the build-hash lookup now falls back
  to `'dev'` when the repo has no commits yet. Without this the dev server crashed on
  the unborn `main` branch.
- `.claude/launch.json` now starts the web app:
  `yarn polycanvas dev -p @polycanvas/web` on port 8080.
- `yarn install` ran clean (14 s, offline, from the copied `node_modules`). The
  postinstall regenerated workspace tsconfigs and the edgeless templates.
- `yarn polycanvas dev -p @polycanvas/web` builds and serves at http://localhost:8080.
  The app boots to the Polymind welcome screen and creates a local workspace exactly
  as before. See §7.

Prebuilt native binaries (`packages/frontend/native/*.darwin-arm64.node`) came along
with the copy, so the Electron app can also be started without a Rust toolchain on
this Mac. The web app never needed them.

---

## 3. The plan, in phases

Each phase is independently shippable and leaves the app running. Do them in order;
Phase 1 is the one that turns Polymind into PolyCanvas.

### Phase 1 — Boot straight into a canvas (the product change)

**Status: done 2026-10-14, verified in the browser.** What landed:

- `modules/editor-setting/schema.ts` — `newDocDefaultMode` defaults to `'edgeless'`;
  `impls/doc-create-middleware.ts` — the `'ask'` setting also resolves to edgeless.
- `modules/editor/entities/editor.ts` — `mode$` starts as `'edgeless'`; `setMode` and
  `toggleMode` coerce to edgeless (every caller funnels through them: header menu,
  note header, peek view, mobile); `bindWorkbenchView` ignores `?mode=page`.
- `blockmind/view-extensions/editor-view/doc-mode-service.ts` — provider default is
  edgeless.
- `desktop/pages/index/index.tsx` — no welcome screen; creates the local workspace
  silently and redirects to `/workspace/:id/canvas`. `welcome.tsx` deleted.
- `desktop/pages/workspace/canvas/index.tsx` (new) — opens the most recently updated
  non-trash doc or creates an edgeless one, with `replaceHistory` so Back skips it.
- `desktop/workbench-router.ts` — `/canvas` added; `/all` now lands on the canvas.
  The journals/tags/collections/chat routes are **kept** until Phase 3 removes the
  sidebar links that point at them (otherwise those links 404).
- `detail-page-header.tsx` — mode switch and journal header removed; icon is always
  edgeless. `detail-page.tsx` — only the Properties and Frame sidebar tabs remain;
  outline viewer, AI chat hook, journal focus logic removed.
- Verified: fresh storage → `/` → workspace + canvas created, no welcome;
  reload → same canvas reopens; old `?mode=page` links render edgeless; DOM has
  `edgeless-editor`, no `page-editor`, no mode-switch button, tabs = properties, frame.
- Known: `detail-page/tabs/{adapter,chat,journal,outline,transcript}` are now
  orphaned (no importer) and go away in Phase 4. `tsc -b` on core reports 329
  errors, all pre-existing from Polymind's working tree (Blockmind toolbar typings,
  meetings, AI, history modal); none in the files above. The rspack build does not
  type-check, so the app runs.

Original goal and steps, kept for reference:

Goal: open the app, see a canvas. No welcome screen, no "All docs", no mode switch.

1. **Default new docs to edgeless.**
   `modules/editor-setting/schema.ts:23` — change `.default('page')` to
   `.default('edgeless')`. The `'ask'` and `'page'` enum values can stay for now.
2. **Index route creates and opens a canvas.**
   `desktop/pages/index/index.tsx` — replace the welcome flow:
   - if no local workspace exists, create one silently (keep the existing
     `workspacesService.create('local', …)` call; drop the `WelcomeScreen`);
   - once inside the workspace, open the most recently updated doc whose
     `primaryMode` is `edgeless`, or create one with
     `docsService.createDoc({ primaryMode: 'edgeless' })` (same call the
     command palette uses in `modules/quicksearch/services/cmdk.ts:104`);
   - navigate with `jumpToPageBlock(workspaceId, docId, 'edgeless', …, RouteLogic.REPLACE)`
     from `components/hooks/use-navigate-helper.ts` so the URL carries `?mode=edgeless`.
     The doc list and creation need the workspace scope, so the simplest shape is: index
     page redirects to `/workspace/:id/canvas` and a new tiny `canvas` workbench route
     does the "open last or create" step inside the workspace scope.
3. **Workbench routes.**
   `desktop/workbench-router.ts` — add `/canvas` (above), make `/all` redirect to
   `/canvas`, and remove `/journals`, `/tag`, `/tag/:id`, `/collection`,
   `/collection/:id`, `/chat`. Keep `/trash`, `/settings`, `/:pageId`,
   `/:pageId/attachments/:attachmentId`.
4. **Pin the editor to edgeless.**
   `modules/editor/entities/editor.ts` — initialise `mode$` to `'edgeless'` and ignore
   `?mode=page` in `bindWorkbenchView` (treat any incoming mode as `'edgeless'`). This
   keeps shared links, peek view and embed-doc previews from falling back to page mode.
5. **Strip page-only UI from the doc view.**
   - `detail-page-header.tsx`: remove `<EditorModeSwitch />` from `NormalPageHeader`,
     delete `JournalPageHeader` and the journal pickers. Keep title, favorite, info,
     menu, present button.
   - `detail-page.tsx`: remove the `outline`, `journal`, `transcript`, `adapter` and
     `chat` sidebar tabs and the `EditorOutlineViewer`. Keep `properties` and `frame`.
     Drop the `isJournal` focus logic.
   - `blockmind/block-suite-mode-switch/` can be deleted once nothing imports it
     (grep for `EditorModeSwitch`; the mobile app also uses it).
6. **Verify**: fresh profile → `/` → canvas with toolbar. Reload → same canvas.
   Cmd+K "New edgeless" still works. `?mode=page` in the URL stays edgeless.

Files touched: 6. Lines: roughly 150. This is a one-day change.

### Phase 2 — Product identity

**Status: done 2026-10-14, verified in the browser.** What landed:

- Root `package.json` → `@polycanvas/monorepo` 0.1.0 (needs `yarn install` after).
- HTML template title and OG title, `DESCRIPTION` in `html-plugin.ts`,
  `manifest.json`, `document-title` suffix, release channel names in
  `utils/channel.ts`, Settings ▸ About copy, onboarding tooltip, HTML preview hint.
- `build-config.ts` URLs now point at `github.com/iexcalibur/polycanvas` (releases,
  discussions). There is no PolyCanvas website yet, so pricing/license/discord URLs
  all go to the repo; change when you have real destinations.
- Electron: `productName` PolyCanvas, description, homepage, repo URL, `make-env.ts`
  channel product names. The `polymind://` deep-link scheme and `appIdMap` are
  **not** renamed (they are tied to the internal scope rename in Phase 5, and
  `generate-assets.ts` still names the Polymind release repo).
- i18n: 128 brand mentions replaced in `en.json` **values only**; the 4 keys that
  contain `PolyMind` (e.g. `"PolyMind Cloud"`) are untouched because code looks them
  up by key.
- `DEFAULT_WORKSPACE_NAME` → `My Canvases`.
- New placeholder mark: `/polycanvas-logo.svg`, `onboarding/assets/logo.tsx`, and
  every favicon / Electron icon regenerated by `scripts/generate-icons.py` (Pillow,
  plus `iconutil` for `.icns`). Replace the mark by editing the SVG and the script's
  `render()` together, then re-running the script.
- Dev server moved to **port 8090** (`bundle-shared.ts`, Electron `DEV_SERVER_URL`,
  `.claude/launch.json`, local/mobile/desktop e2e configs). Cloud e2e suites still
  say 8080 and are deleted in Phase 5.
- README rewritten; `docs/BUILDING.md` rebranded.
- Verified on a fresh origin: tab title `Untitled · PolyCanvas`, OG title, favicon
  served, sidebar shows `My Canvases`, no `PolyMind` text anywhere on the page.
- Known: 6 pre-existing lint errors in files I touched only for strings
  (`app-updater-button`, `html-plugin.ts` `BUILD_TYPE`, settings index param).
  Identifiers like `getPolyMindWorkspaceSchema`, `PolyMind_WORKSPACE_DB_SCHEMA`,
  `com.polymind.*` i18n keys and `--polymind-*` CSS variables are internal and wait
  for Phase 5.

Original checklist, kept for reference. Only product-facing strings and assets. Internal package scopes stay `@polycanvas/*`
and `@blockmind/*` (see Phase 5 for why).

- Root `package.json` `name` → `@polycanvas/monorepo`; `version` → `0.1.0`.
- `tools/cli/src/rspack-shared/html-plugin.ts` — `DESCRIPTION`, title, OG tags.
- `tools/utils/src/build-config.ts:46-77` — github/changelog/download/pricing/discord
  URLs.
- `packages/frontend/apps/electron/package.json` — `productName`, `build.appId`,
  `build.name`; `release.sh` if you keep desktop builds.
- `packages/frontend/core/public/` — favicons, `manifest.json`; `polymind-logo.svg`;
  `components/polymind/onboarding/assets/logo.tsx`.
- `packages/frontend/i18n/src/resources/en.json` — 123 strings contain `PolyMind`.
  Replace with `PolyCanvas` (sed) or introduce a `{{appName}}` interpolation and
  set it once. The other locales can keep `PolyMind` until you care about them.
- `packages/common/env/src/constant.ts` — `DEFAULT_WORKSPACE_NAME`.
- `README.md`, `docs/BUILDING.md`, `LICENSE` attribution lines.

### Phase 3 — Shell slimming

**Status: done 2026-10-14, verified in the browser.** What landed:

- Sidebar (`components/root-app-sidebar/index.tsx`) is now: workspace switcher,
  search, **New canvas**, a **Canvases** section, then Others → Trash, Import, and the
  updater/download button. Removed: AI button, All docs, Journals, Recent chats,
  Organize, Tags, Collections, Invite members, Template entrance, audio player.
- New `navigation-panel/sections/canvases/` lists every non-trash doc, most recently
  updated first, with a plus button that creates a canvas. Expanded by default
  (`DEFAULT_COLLAPSABLE_STATE.canvases`). New drag location
  `navigation-panel:canvases:list` in `types/dnd.ts`.
- `workspace-layout.tsx`: `AIIsland` and `MeetingIsland` removed.
- Settings dialog: AI, Meetings and Backup entries removed; the Editor page section
  and the "new doc default mode" row are gone. Remaining: Appearance, Editor
  (general + edgeless), Keyboard shortcuts, Experimental features, About.
- `enable_ai` feature flag defaults to off.
- Routes `/chat`, `/journals`, `/tag*`, `/collection*` removed from the workbench
  router (deferred from Phase 1).
- Command palette: no "create page" entry; the editor "Convert to page/edgeless"
  command is gone; the header menu's "switch default mode" item and the note
  header's "open in page" button are gone. The sidebar "+" menu (only shown when
  the setting is `ask`) no longer offers Page.
- i18n: "New Page" → "New canvas", "All docs" → "All canvases".
- Verified: sidebar text reads `My Canvases | Search | Settings | Canvases | Untitled |
Others | Trash | Import`; the plus button creates and opens a second canvas and the
  list shows both; Settings lists exactly the five sections above.
- Known: lint still flags pre-existing unused share/cloud leftovers in
  `block-suite-header/menu/index.tsx` and `general-setting/index.tsx` that Polymind
  already carried. The now-orphaned sections (`favorites`, `organize`, `tags`,
  `collections`, `migration-favorites`), pages (`all-page`, `journals`, `tag*`,
  `collection*`, `chat`) and sidebar files (`ai-button`, `journal-button`,
  `recent-chats`, `sidebar-audio-player`, `template-doc-entrance`,
  `invite-members-button`) are deleted in Phase 4.

Original checklist, kept for reference. Make the surrounding chrome match a canvas product.

- `components/root-app-sidebar/index.tsx`: keep workspace navigator, quick search,
  a **New canvas** button, a **Canvases** list (all docs filtered by
  `primaryMode === 'edgeless'`; the filter already exists in
  `modules/collection-rules/impls/filters/doc-primary-mode.ts`), trash, settings.
  Remove `AppSidebarJournalButton`, `RecentChats`, `NavigationPanelOrganize`,
  `NavigationPanelTags`, `NavigationPanelCollections`, `template-doc-entrance`,
  `sidebar-audio-player`, `invite-members-button`, `notification-button`.
- `layouts/workspace-layout.tsx`: remove `<AIIsland />` and `<MeetingIsland />`.
- `desktop/dialogs/setting/general-setting/`: remove `ai`, `meetings`, `backup`,
  `editor/page.tsx`; keep `appearance`, `editor/edgeless`, `editor/general`,
  `shortcuts`, `about`, `experimental-features`.
- `desktop/pages/workspace/all-page/` can become the Canvases list, or be deleted
  if the sidebar list is enough.
- Feature flags (`modules/feature-flag`): default `enable_ai` off.
- Command palette (`modules/quicksearch/services/cmdk.ts`): remove
  `creation:create-page`.

### Phase 4 — Remove dead features from `packages/frontend/core`

**Status: done 2026-10-14, verified in the browser.** What landed:

- **Deleted**: `blockmind/ai/` (the whole AI package), `modules/ai-button`,
  `modules/journal`, `modules/media` (audio playback + meeting transcription),
  `modules/template-doc`, `modules/import-template`, the AI/mobile store and view
  extensions, `outline-viewer`, the recording and journal header buttons, the
  starter bar, the AI/meeting islands, the chat/journals/all-docs/tags/collections
  pages, the chat/journal/outline/adapter/transcript sidebar tabs, the AI/meetings/
  backup settings panels, the favorites/organize/tags/collections navigation
  sections and their folder/collection/tag nodes, the journal property type and its
  collection-rule providers, the AI unit tests, and the orphaned sidebar buttons.
- **Mobile editions removed** (`core/src/mobile`, `apps/{mobile,ios,android,
mobile-shared}`, `mobile-native`, `tests/polymind-mobile`, tooling references,
  Cargo member). They were the main consumer of the journal/tag/template modules, so
  keeping them compiling would have meant keeping everything else.
- **Rewired**: module registry, editor view/store managers, editor adapters, edgeless
  note header patch, peek view (no AI chat block, no outline overlay), doc display
  meta and at-menu (no journal icons/groups), quick search (no journal session or
  date picker), workspace schema (no AI/transcription blocks), dialogs/routes (no
  template import), attachment viewer (audio falls back to the generic card), the
  backlink panel (plain-text previews instead of the AI markdown renderer), the
  mobile config modal (inline header), collection rules (no empty-journal filter).
- **Kept on purpose**: `modules/tag`, `modules/collection`, `modules/organize`,
  `modules/favorite` (doc property system and header star; UI entry points are
  gone), `mermaid`/`typst`/`pdf` (used inside notes), the Electron main-process
  recording code and `transcription-server` crate (not reachable from the UI; a
  separate cleanup once the desktop build is exercised).
- Verified: fresh build, app boots to a canvas, New canvas and the Canvases list work,
  Settings lists Appearance/Editor/Shortcuts/Experimental/About, no error boundary,
  no AI network errors in the console.
- Numbers: `tsc -b` core errors 329 → 267, all remaining ones pre-existing (the only
  "new" line is the pre-existing dialog-schema error whose message text changed).
  oxlint on `core/src`: 103 errors in Polymind → 46 here, all pre-existing.

Original checklist, kept for reference.

Delete, in this order, re-running `yarn typecheck` after each:

1. `core/src/blockmind/ai/` and `modules/ai-button`, `desktop/components/ai-island`,
   `detail-page/tabs/chat.tsx`, `desktop/pages/workspace/chat/`.
2. Meetings and recording: `desktop/components/meeting-island`,
   `detail-page/tabs/transcript*`, `block-suite-header/recording/`,
   Electron `src/main/recording/`, `packages/frontend/native/transcription-server`,
   `media_capture`, `meetings_db`, `packages/frontend/media-capture-playground`.
3. `modules/journal`, `detail-page/tabs/journal.tsx`, `block-suite-header/journal/`.
4. `modules/tag`, `modules/collection`, `modules/organize`, `modules/favorite`
   (favorites can stay if you like the star), `desktop/pages/workspace/{tag,all-tag,collection,all-collection}`.
5. `modules/template-doc`, `desktop/dialogs/import-template`, `/template/*` routes.
6. Page-mode only: `core/src/blockmind/outline-viewer`, `fragments/outline` usage,
   `editors/page-editor.ts` **only after** peek-view and embed-doc previews are
   confirmed to render edgeless (they call `editor.setMode(doc.primaryMode$)` in
   `modules/peek-view/view/utils.ts:70`).

Keep: `pdf`, `mermaid`, `typst` (used inside note blocks on the canvas),
`attachment-viewer`, `peek-view`, `workspace-property`, `doc-info`, `backup` module
(the Electron backup, not the settings page, if you ship desktop).

### Phase 5 — Repo hygiene (optional, do last)

**Status: done 2026-10-14.** What landed:

- **Workspaces dropped**: `packages/backend/{server,native}`, `apps/ai-proxy`,
  `tests/polymind-cloud*`, `tests/polymind-desktop-cloud`, `docs/reference`,
  `media-capture-playground`, plus the mobile packages removed in Phase 4. The
  Rust workspace now lists only `common/native`, `y-octo`, and `frontend/native`.
  `@polycanvas/graphql` stays because core's permissions/embedding modules still
  import its types.
- **CI/infra trimmed**: `.github` keeps only the issue templates, actionlint and the
  `build-rust` / `setup-node` / `setup-version` actions. Deployment, helm, renovate,
  CLA, funding, labeler, auto-assign, CODEOWNERS, `.docker`, `.codesandbox`,
  `codecov.yml` and the root `main.js` / `index.html` artifacts are gone.
- **CLI renamed**: `yarn polycanvas …` (alias `yarn pc`), entry
  `tools/cli/src/polycanvas.ts`, bin `polycanvas`. The server-only runtime loader
  and the `@polycanvas/server` / `admin` cases in the CLI are removed.
- **Internal scopes renamed** in 1,130 files: the old `@polymind` scope → `@polycanvas/*`,
  `@polymind-tools` → `@polycanvas-tools/*`, `@polymind-test` →
  `@polycanvas-test/*`. Deliberately **not** renamed, because they are data formats
  or binary names: `@blockmind/polymind` package names, `polymind:*` block flavours,
  `com.polymind.*` i18n keys, `--polymind-*` CSS variables, the `polymind://`
  Electron scheme, and the Rust crate / napi binary names (`polymind.darwin-arm64.node`
  is prebuilt; renaming it would require a Rust rebuild).

Original checklist, kept for reference.

- **Internal rename the old `@polymind` scope → `@polycanvas/*`** and `@blockmind` → whatever
  you prefer. 2,317 files reference `polymind`. It is a mechanical `sed` across
  `package.json`, `tsconfig*.json`, imports, `.oxlintrc.json`, `Cargo.toml` crate
  names, Electron IPC scheme (`__appInfo.scheme`), CSS variable prefix
  `--polymind-*` (hundreds in Blockmind), i18n keys `com.polymind.*`. Then
  `yarn install && yarn polycanvas init`. Do it in one commit, on a quiet day, after
  the product changes land; it makes every later upstream merge from Polymind or
  BlockSuite a conflict party. Not doing it costs nothing functionally.
- **Drop workspaces you will never build**: `packages/backend/*`,
  `packages/frontend/apps/{mobile,ios,android,ai-proxy,mobile-shared}`,
  `packages/frontend/mobile-native`, `tests/polymind-cloud*`, `tests/polymind-mobile`,
  `docs/reference`, `packages/frontend/media-capture-playground`. Remove them from
  root `package.json` `workspaces`, `Cargo.toml` `members`, `tsconfig.json`
  references, then `yarn install`. Install size and typecheck time drop a lot.
- `.github/`: delete the deployment/helm/renovate pieces; keep a lint+typecheck+
  web-build workflow.
- Root `main.js` and `index.html` are stale build artifacts (gitignored). Delete.
- `.claude/settings.local.json` (93 KB of permission grants) came with the copy;
  prune or keep.

---

## 4. Keep / remove matrix

| Thing                                                                                       | Verdict              | Why                                                               |
| ------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `blockmind/**` (all packages)                                                               | **Keep, untouched**  | The canvas, and the blocks that live inside notes on the canvas   |
| `core/src/blockmind/editors/edgeless-editor.ts`                                             | Keep                 | The host element                                                  |
| `core/src/blockmind/editors/page-editor.ts`                                                 | Keep until Phase 4.6 | Peek view / embed previews                                        |
| `block-suite-mode-switch`                                                                   | Remove (Phase 1)     | No modes to switch                                                |
| `detail-page` + header                                                                      | Keep, trimmed        | It _is_ the canvas view                                           |
| `modules/editor`, `doc`, `workspace`, `workbench`, `storage`, `workspace-engine`, `nbstore` | Keep                 | Persistence and routing                                           |
| `modules/journal`, `tag`, `collection`, `organize`, `template-doc`                          | Remove (Phase 3-4)   | Note-app organisation                                             |
| AI chat, copilot, ai-island                                                                 | Remove (Phase 4)     | Not a canvas feature                                              |
| Meetings / recording / transcription                                                        | Remove (Phase 4)     | Not a canvas feature, and 1 GB of Swift build                     |
| `packages/frontend/templates/edgeless*`                                                     | Keep                 | Canvas template gallery                                           |
| `packages/frontend/templates/onboarding`                                                    | Remove               | Page-mode onboarding docs                                         |
| Electron app                                                                                | Keep (optional)      | Prebuilt `.node` binaries copied; builds without Rust on this Mac |
| Backend server, mobile, iOS, Android                                                        | Remove (Phase 5)     | Local-only product                                                |

---

## 5. How to run

```bash
cd /Users/shubham/Desktop/PolyCanvas
yarn install
yarn polycanvas dev -p @polycanvas/web
```

Then open http://localhost:8090. The Claude desktop launch config `polycanvas-web`
does the same.

Electron (optional):

```bash
yarn polycanvas dev -p @polycanvas/electron
```

---

## 6. Review notes and risks

- **Disk.** Before the copy the Mac had 7 GB free. The copy is 3.9 GB; after dropping
  the Swift cache it is about 2.9 GB. Polymind itself is still 11 GB, 6.6 GB of which
  is `target/` and can be deleted there with no loss (`cargo` rebuilds it).
- **Blockmind is now in-tree.** In Polymind it was a nested git repo with an upstream
  to `toeverything/blocksuite`. Tracking it in-tree is simplest and matches "copy
  everything 1:1". If you want to keep pulling BlockSuite upstream into it, add it
  as a submodule instead before the first commit:
  `git submodule add https://github.com/iexcalibur/blockmind.git blockmind`.
- **`.gitignore` ignores `/*.md`** at the repo root. `README.md` is only in Polymind's
  history because it was force-added. Keep docs under `docs/` (this file is).
- **No commits yet.** Husky installed its hooks; lint-staged will run on your first
  commit and may take a minute on 150k files. `git add -A && git commit` is yours to
  run.
- **Node 22, Yarn 4.13** are what Polymind pins and what this Mac has. Fine.
- **Rust is not needed** for the web app. It is needed only to rebuild
  `packages/frontend/native` for Electron; the copied `.darwin-arm64.node` binaries
  cover this machine.
- **E2E tests** under `tests/polymind-local` assume page mode and the full sidebar.
  Expect most to fail after Phase 1; prune them with Phase 3 rather than fixing.
- **Uncommitted Polymind work came along.** Polymind had 20 modified files on disk
  (meeting/recording, chat sidebar, native bindings). The copy includes those working
  tree changes, so PolyCanvas starts from Polymind's _working tree_, not its last
  commit. If you wanted a clean baseline, re-copy from a `git stash`ed Polymind.
- **Console noise from AI.** The only browser console errors are 504s from
  `CopilotClient.getSessions` / `getRecentSessions`: the dev server proxies `/api` to a
  backend on :3010 that is not running. Harmless, and gone once Phase 4 removes the AI
  module.
- **Shared workspace storage.** Both apps use IndexedDB keyed by origin. PolyCanvas
  now serves on `localhost:8090` (done in Phase 2) so it never shares local
  workspaces with a Polymind dev server on `:8080`.

---

## 7. Verification log

| Check                                                                       | Result                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| File count, source vs copy (excluding excluded dirs)                        | 153,820 vs 153,802; diff = `.DS_Store` + `.eslintcache`                                                                                                                                                                        |
| Workspace symlinks (`node_modules/@polycanvas/core`, `@blockmind/polymind`) | relative, resolve                                                                                                                                                                                                              |
| `yarn install`                                                              | exit 0, 14 s, warnings only (Prisma/server rebuild notices)                                                                                                                                                                    |
| `yarn polycanvas dev -p @polycanvas/web`                                    | serves on :8080 (after the html-plugin fallback fix)                                                                                                                                                                           |
| First rspack build                                                          | compiled successfully in 6.7 s (web entry + 6 workers)                                                                                                                                                                         |
| App boots in browser                                                        | welcome screen → Get Started → local workspace `Demo Workspace` created → `/workspace/:id/all`                                                                                                                                 |
| Edgeless canvas                                                             | New doc ▸ New edgeless → `/workspace/:id/:docId` renders the edgeless editor: toolbar (select, frame, connector, link, note, pen, eraser, shapes), zoom control, mode switch in header, present button. Identical to Polymind. |

The fork is a working, unmodified Polymind. Phase 1 is the first real PolyCanvas change.
