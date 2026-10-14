import cp from 'node:child_process';
import { readdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { utils } from '@electron-forge/core';
import { FusesPlugin } from '@electron-forge/plugin-fuses';

import {
  appIdMap,
  arch,
  buildType,
  icnsPath,
  iconUrl,
  iconX64PngPath,
  iconX512PngPath,
  icoPath,
  platform,
  productName,
} from './scripts/make-env.js';

const fromBuildIdentifier = utils.fromBuildIdentifier;

const linuxMimeTypes = [`x-scheme-handler/${productName.toLowerCase()}`];

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const DEFAULT_ELECTRON_LOCALES_KEEP = new Set([
  'en',
  'en_US',
  'en_GB',
  'zh_CN',
  'zh_TW',
  'fr',
  'es',
  'es_419',
  'pl',
  'de',
  'ru',
  'ja',
  'it',
  'ca',
  'da',
  'hi',
  'sv',
  'ur',
  'ar',
  'uk',
  'ko',
  'pt_BR',
  'fa',
  'nb',
]);

const getElectronLocalesKeep = () => {
  const raw = process.env.ELECTRON_LOCALES_KEEP?.trim();
  if (!raw) return DEFAULT_ELECTRON_LOCALES_KEEP;

  const normalized = raw.toLowerCase();
  if (normalized === 'all' || normalized === '*') return null;

  const keep = new Set(
    raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );

  // Always keep English as a safe fallback.
  keep.add('en');
  keep.add('en_US');
  keep.add('en_GB');
  return keep;
};

const getElectronPakLocalesKeep = keep => {
  const pakKeep = new Set();
  for (const locale of keep) {
    if (locale === 'en') {
      pakKeep.add('en-US');
      continue;
    }
    pakKeep.add(locale.replaceAll('_', '-'));
  }

  // Always keep English (US) as a safe fallback for Chromium/Electron locales.
  pakKeep.add('en');
  pakKeep.add('en-US');
  pakKeep.add('en-GB');
  return pakKeep;
};

const trimElectronFrameworkLocales = async (
  resourcesAppDir,
  targetPlatform
) => {
  if (process.env.TRIM_ELECTRON_LOCALES === '0') return;
  if (targetPlatform !== 'darwin' && targetPlatform !== 'mas') return;

  const keep = getElectronLocalesKeep();
  if (!keep) return;

  const contentsDir = path.resolve(resourcesAppDir, '..', '..');
  const frameworkResourcesDir = path.join(
    contentsDir,
    'Frameworks',
    'Electron Framework.framework',
    'Versions',
    'A',
    'Resources'
  );

  let entries;
  try {
    entries = await readdir(frameworkResourcesDir, { withFileTypes: true });
  } catch {
    return;
  }
  const localeDirs = entries
    .filter(entry => entry.isDirectory() && entry.name.endsWith('.lproj'))
    .map(entry => entry.name);

  await Promise.all(
    localeDirs.map(async dirName => {
      const locale = dirName.slice(0, -'.lproj'.length);
      if (keep.has(locale)) return;
      await rm(path.join(frameworkResourcesDir, dirName), {
        recursive: true,
        force: true,
      });
    })
  );
};

const trimElectronPakLocales = async (resourcesAppDir, targetPlatform) => {
  if (process.env.TRIM_ELECTRON_LOCALES === '0') return;
  if (targetPlatform !== 'win32' && targetPlatform !== 'linux') return;

  const keep = getElectronLocalesKeep();
  if (!keep) return;

  const rootDir = path.resolve(resourcesAppDir, '..', '..');
  const localesDir = path.join(rootDir, 'locales');

  let entries;
  try {
    entries = await readdir(localesDir, { withFileTypes: true });
  } catch {
    return;
  }

  const pakKeep = getElectronPakLocalesKeep(keep);

  await Promise.all(
    entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.pak'))
      .map(async entry => {
        const locale = entry.name.slice(0, -'.pak'.length);
        if (pakKeep.has(locale)) return;
        await rm(path.join(localesDir, entry.name), { force: true });
      })
  );
};

const makers = [
  !process.env.SKIP_BUNDLE &&
    platform === 'darwin' && {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULMO',
        icon: icnsPath,
        name: 'PolyMind',
        'icon-size': 128,
        background: path.join(
          __dirname,
          './resources/icons/dmg-background.png'
        ),
        contents: [
          {
            x: 176,
            y: 192,
            type: 'file',
            path: path.join(
              __dirname,
              'out',
              buildType,
              `${productName}-darwin-${arch}`,
              `${productName}.app`
            ),
          },
          { x: 432, y: 192, type: 'link', path: '/Applications' },
        ],
        iconSize: 118,
        file: path.join(
          __dirname,
          'out',
          buildType,
          `${productName}-darwin-${arch}`,
          `${productName}.app`
        ),
      },
    },
  !process.env.SKIP_BUNDLE && {
    name: '@electron-forge/maker-squirrel',
    config: {
      name: productName,
      setupIcon: icoPath,
      iconUrl: iconUrl,
      loadingGif: './resources/icons/polymind_installing.gif',
    },
  },
  !process.env.SKIP_BUNDLE && {
    name: '@reforged/maker-appimage',
    platforms: ['linux'],
    /** @type {import('@reforged/maker-appimage').MakerAppImageConfig} */
    config: {
      options: {
        bin: productName,
        mimeType: linuxMimeTypes,
        productName,
        genericName: productName,
        categories: [
          'Office',
          'WordProcessor',
          'Presentation',
          'ContactManagement',
          'ProjectManagement',
          'VectorGraphics',
          'Chat',
        ],
        compressor: 'zstd',
        icon: { '64x64': iconX64PngPath, '512x512': iconX512PngPath },
      },
    },
  },
  !process.env.SKIP_BUNDLE && {
    name: '@electron-forge/maker-deb',
    config: {
      bin: productName,
      options: {
        name: productName,
        productName,
        icon: iconX512PngPath,
        mimeType: linuxMimeTypes,
        scripts: {
          // maker-deb does not have a way to include arbitrary files in package root
          // instead, put files in extraResource, and then install with a script
          postinst: './resources/deb/postinst',
          prerm: './resources/deb/prerm',
        },
      },
    },
  },
  !process.env.SKIP_BUNDLE && {
    name: '@electron-forge/maker-flatpak',
    platforms: ['linux'],
    /** @type {import('@electron-forge/maker-flatpak').MakerFlatpakConfig} */
    config: {
      options: {
        mimeType: linuxMimeTypes,
        productName,
        bin: productName,
        id: fromBuildIdentifier(appIdMap),
        icon: { '64x64': iconX64PngPath, '512x512': iconX512PngPath },
        branch: buildType,
        runtime: 'org.freedesktop.Platform',
        runtimeVersion: '25.08',
        sdk: 'org.freedesktop.Sdk',
        base: 'org.electronjs.Electron2.BaseApp',
        baseVersion: '25.08',
        files: [
          [
            './resources/polymind.metainfo.xml',
            '/usr/share/metainfo/polymind.metainfo.xml',
          ],
        ],
        modules: [
          {
            name: 'zypak',
            sources: [
              {
                type: 'git',
                url: 'https://github.com/refi64/zypak',
                tag: 'v2025.09',
              },
            ],
          },
        ],
        finishArgs: [
          // Wayland/X11 Rendering
          '--socket=wayland',
          '--socket=x11',
          '--share=ipc',
          // Open GL
          '--device=dri',
          // Audio output
          '--socket=pulseaudio',
          // Read/write home directory access
          '--filesystem=home',
          // Allow communication with network
          '--share=network',
          // System notifications with libnotify
          '--talk-name=org.freedesktop.Notifications',
        ],
      },
    },
  },
].filter(Boolean);

console.log('makers', makers);

/**
 * @type {import('@electron-forge/shared-types').ForgeConfig}
 */
export default {
  buildIdentifier: buildType,
  packagerConfig: {
    name: productName,
    appBundleId: fromBuildIdentifier(appIdMap),
    icon: icnsPath,
    // Phase-8j: real Developer ID code signing replaces the previous
    // ad-hoc (`identity: '-'`) approach. With ad-hoc signing each
    // rebuild produced a different code hash, so macOS TCC saw new
    // builds as different apps and dropped Microphone / Screen
    // Recording grants across upgrades. Real Developer ID gives a
    // stable code requirement; TCC keeps grants forever.
    //
    // Hardened runtime is required for notarisation (and a Good Idea
    // anyway). Entitlements file declares the runtime exceptions our
    // app actually needs — JIT for V8, library validation off for
    // the napi-rs .node + Swift transcription-server, mic input,
    // network client+server, dyld env vars for child-process spawn.
    osxSign: {
      identity:
        process.env.APPLE_DEVELOPER_ID_APPLICATION ||
        'Developer ID Application: Shubham Kumar (F37GPAXXA8)',
      // Developer ID distribution doesn't use provisioning profiles
      // (those are for Mac App Store / TestFlight). When this flag is
      // true (default), @electron/osx-sign 1.3.3 silently bails out of
      // the entire signing pass on certain hosts because the
      // pre-embed step hangs looking for a profile that isn't there.
      // Disabling this skips that step and lets the actual codesign
      // run.
      preEmbedProvisioningProfile: false,
      // Same reason — entitlements automation is for Mac App Store
      // sandbox apps. Our app is direct-download outside the MAS, so
      // we want our own entitlements file applied verbatim, not
      // transformed.
      preAutoEntitlements: false,
      optionsForFile: filePath => ({
        hardenedRuntime: true,
        entitlements: path.join(__dirname, 'resources/entitlements.plist'),
        // entitlementsInherit applies to all child processes and
        // nested binaries (helpers, frameworks, the transcription-
        // server, the .node module). Same file — covers everything.
        entitlementsInherit: path.join(
          __dirname,
          'resources/entitlements.plist'
        ),
        // Hardened-runtime requires `--options runtime`; @electron/
        // osx-sign sets this automatically when hardenedRuntime is
        // true. The -i (identifier) override on the .app keeps the
        // bundle ID stable so TCC matching works.
        //
        // NOTE: must use the resolved string here, NOT
        // `fromBuildIdentifier(appIdMap)`. The build-identifier
        // helper returns a lazy object that electron-forge resolves
        // at its own callsites; osx-sign's `additionalArguments`
        // pass-through doesn't know how to unwrap it, and we get
        // `Identifier=[object Object]` baked into the signature.
        additionalArguments: filePath.endsWith('.app')
          ? ['-i', appIdMap[buildType]]
          : [],
      }),
    },
    electronZipDir: process.env.ELECTRON_FORGE_ELECTRON_ZIP_DIR,
    osxNotarize: undefined,
    // We need the following line for updater
    extraResource: [
      './resources/app-update.yml',
      ...(platform === 'linux' ? ['./resources/polymind.metainfo.xml'] : []),
      // Swift writes the binary to `.build/arm64-apple-macosx/release/`
      // and creates `.build/release/` as a symlink to that arch-
      // specific dir. Pointing extraResource at the symlinked path
      // (.build/release/...) made electron-packager's `cp -R` copy
      // the symlink itself rather than the underlying file — the
      // bundled file ended up as a broken symlink pointing at
      // `../arm64-apple-macosx/release/transcription-server`, which
      // doesn't exist inside Contents/Resources/. Spawning the
      // server then failed with ENOENT and the app sat permanently
      // "Offline". Pointing directly at the arch-specific path
      // resolves to a real Mach-O file, which `cp -R` copies as a
      // regular file. release.sh builds with `--arch arm64`, so this
      // path is always populated.
      ...(platform === 'darwin'
        ? [
            '../../native/transcription-server/.build/arm64-apple-macosx/release/transcription-server',
          ]
        : []),
    ],
    protocols: [
      {
        name: productName,
        schemes: [productName.toLowerCase()],
      },
    ],
    executableName: productName,
    ignore: [
      /\.map$/,
      /\/out($|\/)/,
      /\/src($|\/)/,
      /\/test($|\/)/,
      /\/scripts($|\/)/,
      /\/examples($|\/)/,
      /\/docs($|\/)/,
      /\/README\.md$/,
      /\/forge\.config\.mjs$/,
      /\/dev-app-update\.yml$/,
      /\/resources\/app-update\.yml$/,
      /\/tsconfig.*\.json$/,
      /\/vitest\.config\.\w+$/,
      /\/\.gitignore$/,
    ],
    afterCopy: [
      (buildPath, _electronVersion, targetPlatform, _arch, done) => {
        Promise.all([
          trimElectronFrameworkLocales(buildPath, targetPlatform),
          trimElectronPakLocales(buildPath, targetPlatform),
        ])
          .then(() => done())
          .catch(done);
      },
    ],
    asar: true,
    // Tell @electron/universal that .node files are universal binaries
    // (identical in both x64 and arm64 builds) and safe to take from x64.
    osxUniversal: {
      x64ArchFiles: '{**/*.node,**/transcription-server}',
    },
    extendInfo: {
      NSMicrophoneUsageDescription:
        'PolyMind needs microphone access to record and transcribe your voice during meetings.',
      // Phase-8k: both the Rust recorder (retired) and the Swift
      // transcription server's SystemAudioCapture now use
      // AudioHardwareCreateProcessTap, which Apple gates with the
      // dedicated audio-only TCC entry — "System Audio Recording".
      // NSAudioCaptureUsageDescription is the matching usage-string
      // key for that prompt. Replaces the prior NSScreenCapture-
      // UsageDescription / "Screen & System Audio Recording" path,
      // which was overkill for an app that never reads pixels.
      NSAudioCaptureUsageDescription:
        'PolyMind needs system audio access to capture and transcribe other participants during meetings. No screen content is ever recorded — audio only.',
      NSSpeechRecognitionUsageDescription:
        'PolyMind uses speech recognition to provide live meeting transcription.',
      NSAccessibilityUsageDescription:
        'PolyMind needs accessibility access to detect active meeting windows.',
    },
  },
  makers,
  plugins: [
    { name: '@electron-forge/plugin-auto-unpack-natives', config: {} },
    // FusesPlugin disabled — causes code signature invalidation on unsigned builds
    // new FusesPlugin({
    //   version: FuseVersion.V1,
    //   [FuseV1Options.RunAsNode]: false,
    //   [FuseV1Options.EnableCookieEncryption]: true,
    //   [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    //   [FuseV1Options.EnableNodeCliInspectArguments]: false,
    //   [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    //   [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // }),
  ],
  hooks: {
    readPackageJson: async (_, packageJson) => {
      // we want different package name for canary build
      // so stable and canary will not share the same app data
      packageJson.productName = productName;
    },
    prePackage: async () => {
      if (!process.env.HOIST_NODE_MODULES) {
        await rm(path.join(__dirname, 'node_modules'), {
          recursive: true,
          force: true,
        });

        await symlink(
          path.join(__dirname, '..', '..', '..', 'node_modules'),
          path.join(__dirname, 'node_modules')
        );
      }
    },
    generateAssets: async (_, platform, arch) => {
      if (process.env.SKIP_GENERATE_ASSETS) {
        return;
      }

      // TODO(@Peng): right now we do not need the following
      // it is for octobase-node, but we dont use it for now.
      if (platform === 'darwin' && arch === 'universal') {
        // Universal build: native module is pre-built as universal via
        // napi universalize in release.sh, no TARGET override needed.
      } else if (platform === 'darwin' && arch === 'arm64') {
        // In GitHub Actions runner, MacOS is always x64
        // we need to manually set TARGET to aarch64-apple-darwin
        process.env.TARGET = 'aarch64-apple-darwin';
      }

      cp.spawnSync('yarn', ['generate-assets'], {
        stdio: 'inherit',
        cwd: __dirname,
      });
    },
  },
};
