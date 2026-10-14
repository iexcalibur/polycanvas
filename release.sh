#!/bin/bash
set -e

RELEASE_DIR="$HOME/Desktop/PolyMind-releases"
ELECTRON_DIR="packages/frontend/apps/electron"
RENDERER_DIR="packages/frontend/apps/electron-renderer"

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[release]${NC} $1"; }
success() { echo -e "${GREEN}[release]${NC} $1"; }

# --- Version bump ---
BUMP="${1:-none}"
if [[ "$BUMP" != "none" ]]; then
  CURRENT=$(node -p "require('./$ELECTRON_DIR/package.json').version")
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

  case "$BUMP" in
    patch) PATCH=$((PATCH + 1)) ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    *)
      echo "Usage: ./release.sh [patch|minor|major]"
      echo "  patch  — 0.26.3  → 0.26.4"
      echo "  patch  — 0.26.99 → 0.27.0   (overflow: .99 rolls over)"
      echo "  patch  — 0.99.99 → 1.0.0    (overflow cascades to major)"
      echo "  minor  — 0.26.3  → 0.27.0"
      echo "  minor  — 0.99.0  → 1.0.0"
      echo "  major  — 0.26.3  → 1.0.0"
      echo "  (none) — build without version bump"
      exit 1
      ;;
  esac

  # Version overflow: any component reaching >= 100 rolls over into the
  # next higher component. This keeps patch and minor bounded to [0, 99]
  # and matches semver visually (e.g. 0.26.99 -> 0.27.0 rather than
  # 0.26.100, and 0.99.99 -> 1.0.0 rather than 1.99.100 when a patch
  # hits the ceiling on both).
  if [ "$PATCH" -ge 100 ]; then
    PATCH=0
    MINOR=$((MINOR + 1))
  fi
  if [ "$MINOR" -ge 100 ]; then
    MINOR=0
    MAJOR=$((MAJOR + 1))
  fi

  NEW_VERSION="$MAJOR.$MINOR.$PATCH"
  log "Bumping version: $CURRENT → $NEW_VERSION"

  # Update version in all relevant package.json files so BUILD_CONFIG.appVersion matches
  node -e "
    const fs = require('fs');
    const paths = [
      './$ELECTRON_DIR/package.json',
      './$RENDERER_DIR/package.json',
      './package.json',
    ];
    for (const p of paths) {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
      pkg.version = '$NEW_VERSION';
      fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
    }
  "
else
  NEW_VERSION=$(node -p "require('./$ELECTRON_DIR/package.json').version")
  log "Building version: $NEW_VERSION (no bump)"
fi

# --- Build ---
export BUILD_TYPE=stable

log "Building renderer..."
yarn polycanvas build -p @polycanvas/electron-renderer

log "Copying web assets..."
rm -rf "$ELECTRON_DIR/resources/web-static"
cp -r "$RENDERER_DIR/dist" "$ELECTRON_DIR/resources/web-static"

# --- Build Apple-Silicon-only native module ---
#
# Phase 8c dropped x86_64 support. Two reasons:
#   1. Cohere Transcribe 2B requires the Apple Neural Engine, which
#      Intel Macs don't have. With Phase 8d/e removing Whisper-
#      large-v3 (the only thing that ran on Intel), the post-stop
#      transcription pipeline simply has no engine on x86_64.
#   2. DTLN-aec-coreml uses `Float16` directly, which is unavailable
#      on macOS x86_64. The x86_64 Swift build hits dozens of
#      "'Float16' is unavailable in macOS" errors and won't link.
#
# Single-arch arm64 builds are simpler all the way through —
# no `lipo`, no `napi universalize`, no `--arch=universal` packaging.
NATIVE_DIR="packages/frontend/native"

log "Building native module (Apple Silicon)..."
# Clean stale arch-specific .node binaries from earlier interrupted
# universal builds. Without this, electron-forge's asar packing picks up
# leftover polymind.darwin-{universal,x64}.node files alongside the new
# arm64 one, and the runtime napi router requires the universal one
# first (line 178 of generated index.js). The released DMG then loads
# a stale binary and crashes on first MeetingsStore call. Idempotent —
# `rm -f` is happy when the files don't exist.
rm -f "$NATIVE_DIR"/polymind.darwin-universal.node
rm -f "$NATIVE_DIR"/polymind.darwin-x64.node
rm -f "$ELECTRON_DIR"/dist/polymind.darwin-universal.node
rm -f "$ELECTRON_DIR"/dist/polymind.darwin-x64.node

cd "$NATIVE_DIR"
npx napi build -p polymind_native --platform --release --target aarch64-apple-darwin
cd - > /dev/null
success "  Native module ready"

log "Building transcription-server (Swift, Apple Silicon)..."
cd "$NATIVE_DIR/transcription-server"
swift package clean
swift build -c release --arch arm64
# Swift naturally emits the binary at:
#   .build/arm64-apple-macosx/release/transcription-server
# It ALSO creates a `.build/release` symlink pointing at
# `arm64-apple-macosx/release`. Both paths reach the same file.
#
# Earlier attempts here did an mkdir + rm + cp dance against
# `.build/release/transcription-server`, which (via the symlink)
# deleted the actual binary that Swift had just produced — leaving
# nothing to bundle. Other attempts used `ln -s` to manage the
# `.build/release/` location; that worked locally but
# electron-packager's extraResource pass uses `cp -R` semantics that
# preserve symlinks, so the bundled file ended up as a broken
# symlink pointing at `../arm64-apple-macosx/release/...` (a path
# that doesn't exist inside Contents/Resources/). Symptom: every
# install spawned the Swift server with ENOENT, app sat permanently
# "Offline", Cohere auto-download never fired.
#
# Cleanest fix: don't touch `.build/release/` at all here.
# forge.config.mjs's `extraResource` points directly at the
# arch-specific file Swift writes (a real Mach-O), and
# electron-packager's `cp -R` resolves that to a real-file copy in
# Contents/Resources/. No symlink in the bundle, no rm-the-binary-
# we-just-built footgun.
cd - > /dev/null
success "  Transcription server ready (Apple Silicon)"

log "Building electron main..."
yarn polycanvas build -p @polycanvas/electron

log "Killing existing PolyMind..."
pkill -f "PolyMind" 2>/dev/null || true
sleep 1

log "Packaging Apple Silicon app..."
cd "$ELECTRON_DIR"
# osxSign in forge.config.mjs uses Developer ID Application identity
# + hardened runtime + resources/entitlements.plist. electron-forge
# signs the .app, all helpers/frameworks, the napi .node binding, AND
# the bundled transcription-server during this `package` step.
# No post-package codesign hammer needed any more — that was the
# workaround for ad-hoc signing's TCC fragility, which is now gone.
npx electron-forge package --arch=arm64

APP_BUNDLE="out/stable/PolyMind-darwin-arm64/PolyMind.app"

# Verification: confirm the .app and the transcription-server child
# binary are both signed with the Developer ID. If either is unsigned
# or signed with a different identity, the user's macOS will refuse
# to spawn the server with a Gatekeeper rejection. Loud failure here
# beats a silent one in the DMG.
log "Verifying code signatures..."
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE" 2>&1 \
  | tail -5
codesign -dv "$APP_BUNDLE/Contents/Resources/transcription-server" 2>&1 \
  | grep -E "Authority|TeamIdentifier|Identifier"

log "Creating DMG..."
npx electron-forge make --arch=arm64 --skip-package

# --- Copy to releases ---
cd - > /dev/null
mkdir -p "$RELEASE_DIR"
DMG_SOURCE="$ELECTRON_DIR/out/stable/make/PolyMind.dmg"
cp "$DMG_SOURCE" "$RELEASE_DIR/PolyMind-latest.dmg"

success "================================================"
success "  PolyMind v${NEW_VERSION} built successfully!"
success "================================================"
success ""
success "  DMG: $RELEASE_DIR/PolyMind-latest.dmg"
success ""
