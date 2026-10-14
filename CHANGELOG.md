# Changelog

All notable changes to the PolyMind project (PolyMind fork) are documented in this file.

---

## [Unreleased]

### Removed
- **Admin dependency fully removed** — single-user, local-first product
  - Permission entity always grants full owner+admin access
  - Guard service always returns `true` for all actions
  - Backend `@Admin()` guard made pass-through
  - Deleted `packages/frontend/admin/` (~133 files) — standalone admin panel app
  - Deleted `packages/common/graphql/src/graphql/admin/` (~20 files) — admin GraphQL queries
  - Removed admin routes, admin menu item, admin build config, admin tsconfig reference
  - `UserFeature.isAdmin$` always returns `true`
- **All telemetry fully removed** — zero data sent externally
  - Removed all `track.xxx()` calls from ~150 frontend files
  - `@polycanvas/track` exports are no-ops (track, tracker, sentry all do nothing)
  - Deleted `packages/backend/server/src/core/telemetry/` — backend GA4 forwarding
  - Deleted `packages/common/nbstore/src/telemetry/` — IndexedDB event queue
  - Deleted `packages/frontend/core/src/modules/telemetry/` — frontend telemetry module
  - Deleted `packages/frontend/track/src/` internals (sentry, tracker, state, telemetry)
  - Bootstrap telemetry initialization emptied
  - No Sentry, no Google Analytics, no custom analytics
- **Cloud stubbed out** — local-first only, no backend server needed
  - Cloud workspace flavour provider removed (only local workspaces)
  - Backend proxy (`/api`, `/socket.io`, `/graphql`) removed from dev server
  - LocalDemoTips banner changed from cloud upsell to local data reminder
  - TopTip component stripped of auth/cloud dependencies
  - Cloud module kept as stub (services exist but `server` is always `null`)
- **Favorites sidebar section** removed from desktop and mobile navigation
  - `NavigationPanelFavorites` and `NavigationPanelMigrationFavorites` removed from sidebar
  - `favorite` table dropped from `PolyMind_WORKSPACE_USERDATA_DB_SCHEMA`
  - `FavoriteStore` converted to no-op stub (star icons on docs still render but are inert)

---

## Previous Changes (from git history)

### Added
- Spaces module as first-class knowledge containers (`feat(spaces)`)
- Space-scoped Memory + Claude AI Chat (`feat(spaces)`)
- Dump Zone — capture inbox + screenshot OCR (`feat(dump)`)
- Sub-Spaces, Workspace Chat, AI Search, Doc Gen, Cross-Space Connections, Dump Auto-Org (`feat: complete vision`)
- Seed sample workspace data on first load (`feat: seed`)
- Makefile for project build/run commands

### Fixed
- Use `find$()` instead of `find$({})` — empty where matched nothing
- Retry DB polling for seed + use `create()` for docProperties
- Remove localStorage guard — seed whenever spaces table is empty
- Delay seed to ensure DB is ready before checking spaces
- Use `globalStyle` for `dropZoneText` small selector (vanilla-extract)
- Use `globalStyle` for `typingDots` span selectors (vanilla-extract)

### Removed
- iOS, Android, and mobile app support (`chore: remove iOS/Android`)
- Inherited PolyMind CI/CD, deployments, helm charts, and Docker configs
