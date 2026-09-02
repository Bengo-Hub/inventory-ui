import path from 'node:path';

// inventory-ui/e2e/docs-capture/lib -> Codevertex root is 5 levels up, then into the sibling
// shared-docs repo. Screenshots are written straight there so there's one source of truth for
// the images instead of a separate copy step.
export const ASSETS_DIR = path.resolve(
  __dirname,
  '../../../../../shared-docs/docs/user-guide/inventory/assets',
);

export function assetPath(...segments: string[]) {
  return path.join(ASSETS_DIR, ...segments);
}
