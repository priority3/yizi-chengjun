// Hands a painted picture to the player: the system share sheet with the PNG attached where the browser can share
// files (most phones), else a full-screen copy of the picture to long-press (phones) or right-click (desktop) and
// save. That overlay is the game's only DOM UI besides the canvas.
import { SANS_STACK } from '../render/fonts.ts';

/** Title of the shared picture and of the save-image overlay. */
export const SHARE_TITLE = '一字成军战报';
/** The overlay's instructions. */
export const SAVE_HINT = '长按图片保存，或右键另存为';
/** File name the share sheet shows for the picture. */
export const SHARE_FILE = 'yizi-chengjun.png';

/** How a share ended: sent through the share sheet, the sheet closed by the player, or the picture shown to save by hand. */
export type ShareOutcome = 'shared' | 'cancelled' | 'saved';

/** The canvas method shareImage uses (tests pass a fake). */
export type PngSource = Pick<HTMLCanvasElement, 'toDataURL'>;

/** The browser features shareImage relies on; the defaults are the real ones, tests pass fakes. */
export interface ShareDeps {
  /** navigator.canShare, where the browser has it. */
  canShare?: (data: ShareData) => boolean;
  /** navigator.share, where the browser has it. */
  share?: (data: ShareData) => Promise<void>;
  /** Shows the picture (a PNG data URL) for saving by hand; `alt` describes it. */
  overlay: (src: string, alt: string) => void;
}

/** The real browser features (whatever of them exist here). */
function browserDeps(): ShareDeps {
  const nav: Partial<Navigator> = typeof navigator === 'undefined' ? {} : navigator;
  return {
    canShare: typeof nav.canShare === 'function' ? (d) => navigator.canShare(d) : undefined,
    share: typeof nav.share === 'function' ? (d) => navigator.share(d) : undefined,
    overlay: showShareOverlay,
  };
}

/**
 * Shares the canvas as a PNG: navigator.share({ files, title, text }) where navigator.canShare accepts the file;
 * otherwise, or when sharing fails for any reason but the player closing the sheet (AbortError), shows the picture
 * full screen with SAVE_HINT. Resolves once the sheet has closed or the overlay is up.
 */
export async function shareImage(canvas: PngSource, text: string, deps: ShareDeps = browserDeps()): Promise<ShareOutcome> {
  // Reason: encode synchronously, in the task of the tap, and reach navigator.share before the first await. The
  // sheet needs the tap's user activation, which browsers drop after a few seconds, and canvas.toBlob is scheduled
  // in idle time: on a page that animates every frame it took 1 to 7 seconds, long enough to lose the sheet.
  const url = canvas.toDataURL('image/png');
  const blob = pngBlob(url);
  if (blob && deps.share && typeof File === 'function') {
    const file = new File([blob], SHARE_FILE, { type: 'image/png' });
    if (canShareFiles(deps, file)) {
      try {
        await deps.share({ files: [file], title: SHARE_TITLE, text });
        return 'shared';
      } catch (err) {
        // Reason: AbortError is the player closing the sheet on purpose; any other failure (no permission, a target
        // app that gave up) still owes them a way to keep the picture.
        if (isAbort(err)) return 'cancelled';
      }
    }
  }
  // Reason: the overlay shows the data URL itself rather than a blob: URL, because in-app browsers (WeChat) only offer
  // 保存图片 on long-press for images they can read back.
  deps.overlay(url, text);
  return 'saved';
}

const PNG_DATA_URL = 'data:image/png;base64,';

/** The PNG behind a base64 PNG data URL, decoded synchronously; null for anything else (an empty canvas gives "data:,"). */
export function pngBlob(url: string): Blob | null {
  if (!url.startsWith(PNG_DATA_URL)) return null;
  try {
    const bin = atob(url.slice(PNG_DATA_URL.length));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  } catch {
    return null;
  }
}

/** Whether the share sheet takes this file. Reason: some browsers throw instead of answering false. */
function canShareFiles(deps: ShareDeps, file: File): boolean {
  try {
    return deps.canShare?.({ files: [file] }) === true;
  } catch {
    return false;
  }
}

function isAbort(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

/** Closes the overlay that is open, if any (one at a time). */
let closeOpen: (() => void) | null = null;

/**
 * Shows `src` (an image URL) full screen over the game, with SAVE_HINT and a 关闭 button, replacing any overlay
 * already open. While it is open the game canvas ignores the pointer; 关闭 or Escape removes it.
 */
export function showShareOverlay(src: string, alt: string): void {
  closeOpen?.();
  const doc = document;
  const hintId = 'yzcj-share-hint';
  const root = doc.createElement('div');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', SHARE_TITLE);
  root.setAttribute('aria-describedby', hintId);
  Object.assign(root.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
    zIndex: '2147483000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: '16px',
    background: 'rgba(12,7,4,0.94)',
  });
  // Reason: clear of the notch and the home bar where env() works; other browsers ignore this and keep 16px.
  root.style.padding = 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))';

  const img = doc.createElement('img');
  img.src = src;
  img.alt = alt;
  Object.assign(img.style, {
    display: 'block',
    flex: '0 1 auto',
    minHeight: '0',
    maxWidth: '100%',
    maxHeight: 'calc(100% - 120px)',
    objectFit: 'contain',
    borderRadius: '8px',
    boxShadow: '0 10px 36px rgba(0,0,0,0.65)',
  });
  // Reason: index.html turns off selection and iOS's long-press menu for the whole game; the picture needs them back.
  img.style.setProperty('-webkit-touch-callout', 'default');
  img.style.setProperty('-webkit-user-select', 'auto');
  img.style.setProperty('user-select', 'auto');

  const hint = doc.createElement('p');
  hint.id = hintId;
  hint.textContent = SAVE_HINT;
  Object.assign(hint.style, { margin: '14px 0 10px', color: '#f3e6c8', font: `600 15px/1.4 ${SANS_STACK}`, textAlign: 'center' });

  const close = doc.createElement('button');
  close.type = 'button';
  close.textContent = '关闭';
  close.setAttribute('aria-label', '关闭战报图片');
  Object.assign(close.style, {
    minWidth: '128px',
    minHeight: '44px',
    padding: '0 24px',
    border: '2px solid #8a4a0a',
    borderRadius: '12px',
    background: 'linear-gradient(#ffcf6a, #e8912a)',
    color: '#4a2204',
    font: `700 17px ${SANS_STACK}`,
    cursor: 'pointer',
  });
  root.append(img, hint, close);

  // The game canvas stays underneath: make sure no stray tap or drag reaches it meanwhile.
  const canvases = Array.from(doc.querySelectorAll('canvas'));
  const pointer = canvases.map((c) => c.style.pointerEvents);
  for (const c of canvases) c.style.pointerEvents = 'none';
  const before = doc.activeElement;
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    done();
  };
  const done = () => {
    if (closeOpen !== done) return;
    closeOpen = null;
    root.remove();
    canvases.forEach((c, i) => (c.style.pointerEvents = pointer[i]));
    doc.removeEventListener('keydown', onKey);
    if (before instanceof HTMLElement && before !== doc.body) before.focus({ preventScroll: true });
  };
  close.addEventListener('click', done);
  // Reason: installGuards (platform/web.ts) cancels contextmenu on the document for the game; stopping it here lets
  // right-click 另存为 and Android's long-press image menu through.
  root.addEventListener('contextmenu', (e) => e.stopPropagation());
  doc.addEventListener('keydown', onKey);
  closeOpen = done;
  doc.body.appendChild(root);
  close.focus({ preventScroll: true });
}
