/**
 * The build id shown on the title screen and written into save headers (Book 2 section 20):
 * `<version>+<short commit>`, e.g. `0.1.0+3f2a9c1`. Vite injects it at build time.
 */
declare const __BUILD_ID__: string;

export const BUILD_ID: string = __BUILD_ID__;

/** Every build id has this shape; the title fonts must be able to draw any of them. */
export const BUILD_ID_PATTERN = /^\d+\.\d+\.\d+\+[0-9a-f]{7}$/;
