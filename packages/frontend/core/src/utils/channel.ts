import { z } from 'zod';

export const appSchemes = z.enum([
  'polymind',
  'polymind-canary',
  'polymind-beta',
  'polymind-internal',
  'polymind-dev',
]);

export type Scheme = z.infer<typeof appSchemes>;
export type Channel = 'stable' | 'canary' | 'beta' | 'internal';

export const schemeToChannel = {
  polymind: 'stable',
  'polymind-canary': 'canary',
  'polymind-beta': 'beta',
  'polymind-internal': 'internal',
  'polymind-dev': 'canary', // dev does not have a dedicated app. use canary as the placeholder.
} as Record<Scheme, Channel>;

export const channelToScheme = {
  stable: 'polymind',
  canary: BUILD_CONFIG.debug ? 'polymind-dev' : 'polymind-canary',
  beta: 'polymind-beta',
  internal: 'polymind-internal',
} as Record<Channel, Scheme>;

export const appIconMap = {
  stable: '/imgs/app-icon-stable.ico',
  canary: '/imgs/app-icon-canary.ico',
  beta: '/imgs/app-icon-beta.ico',
  internal: '/imgs/app-icon-internal.ico',
} satisfies Record<Channel, string>;

export const appNames = {
  stable: 'PolyCanvas',
  canary: 'PolyCanvas Canary',
  beta: 'PolyCanvas Beta',
  internal: 'PolyCanvas Internal',
} satisfies Record<Channel, string>;

export const appSchemaUrl = z.custom<string>(
  (url: string) => {
    try {
      return appSchemes.safeParse(new URL(url).protocol.replace(':', ''))
        .success;
    } catch {
      return false;
    }
  },
  { message: 'Invalid URL or protocol' }
);
