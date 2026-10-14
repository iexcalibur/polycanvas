import { PackageList, type PackageName } from './yarn';

export const PackageToDistribution = new Map<
  PackageName,
  BUILD_CONFIG_TYPE['distribution']
>([
  ['@polycanvas/web', 'web'],
  ['@polycanvas/electron-renderer', 'desktop'],
  ['@polycanvas/electron', 'desktop'],
]);

export const AliasToPackage = new Map<string, PackageName>([
  ['web', '@polycanvas/web'],
  ['electron', '@polycanvas/electron'],
  ['desktop', '@polycanvas/electron-renderer'],
  ['renderer', '@polycanvas/electron-renderer'],
  ['gql', '@polycanvas/graphql'],
  ...PackageList.map(
    pkg => [pkg.name.split('/').pop()!, pkg.name] as [string, PackageName]
  ),
]);
