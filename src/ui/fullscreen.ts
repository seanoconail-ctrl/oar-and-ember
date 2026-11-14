/**
 * Fullscreen (Book 2 section 21; decision DG-18): asked of the browser on the page (from a user
 * gesture: the menu's click or key), keeping the integer scaling and letterbox the presenter
 * already gives any size. In Chromium the Escape key is locked while fullscreen, so a press opens
 * the pause menu and a long press leaves fullscreen; in WebKit, where Escape leaves fullscreen,
 * leaving it during play opens the pause menu (the view listens for `fullscreenchange`).
 */

interface KeyboardLock {
  lock(keys?: string[]): Promise<void>;
  unlock(): void;
}

export function isFullscreen(doc: Document): boolean {
  return doc.fullscreenElement != null;
}

/** Whether this browser offers fullscreen on the page at all. */
export function fullscreenOffered(doc: Document): boolean {
  return doc.fullscreenEnabled;
}

/** Enters or leaves fullscreen. Resolves to the state afterwards; never throws. */
export async function toggleFullscreen(doc: Document): Promise<boolean> {
  const keyboard = (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;
  try {
    if (isFullscreen(doc)) {
      keyboard?.unlock();
      await doc.exitFullscreen();
      return false;
    }
    await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
    // Chromium: Escape opens the pause menu rather than leaving fullscreen at once.
    await keyboard?.lock(['Escape']).catch(() => undefined);
    return true;
  } catch {
    return isFullscreen(doc);
  }
}
