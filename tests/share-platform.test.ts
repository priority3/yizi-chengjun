// shareImage's choices, with fake browser features: the share sheet with the PNG where the browser takes files,
// nothing more when the player closes the sheet, and the save-image overlay in every other case. The picture is
// encoded once, synchronously, so the share sheet is reached in the task of the tap.
import { describe, expect, it, vi } from 'vitest';
import { pngBlob, SHARE_FILE, SHARE_TITLE, shareImage, type PngSource, type ShareDeps } from '../src/platform/share.ts';

const TEXT = '《一字成军》第三章 · 平顶山：三星通关，击杀 87 只妖怪！';
/** What the fake canvas encodes to: a PNG data URL whose payload is the bytes of "encoded". */
const ENCODED = 'data:image/png;base64,ZW5jb2RlZA==';

/** A canvas whose toDataURL returns `url` (a real empty canvas gives "data:,") or throws. */
function fakeCanvas(url: string | 'throw' = ENCODED) {
  return {
    toDataURL: vi.fn((): string => {
      if (url === 'throw') throw new Error('tainted');
      return url;
    }),
  } satisfies PngSource;
}

/** Browser features with a share sheet that takes files and succeeds, unless overridden. */
function fakeDeps(over: Partial<ShareDeps> = {}) {
  const deps = {
    canShare: vi.fn((_: ShareData) => true),
    share: vi.fn(async (_: ShareData) => {}),
    overlay: vi.fn((_src: string, _alt: string) => {}),
    ...over,
  };
  return deps;
}

/** An error named like the DOMExceptions navigator.share rejects with. */
const named = (name: string) => Object.assign(new Error(name), { name });

describe('shareImage', () => {
  it('hands the PNG to the share sheet with the title and the text', async () => {
    const canShare = vi.fn((_: ShareData) => true);
    const share = vi.fn(async (_: ShareData) => {});
    const overlay = vi.fn();
    expect(await shareImage(fakeCanvas(), TEXT, { canShare, share, overlay })).toBe('shared');
    expect(canShare).toHaveBeenCalledTimes(1);
    const asked = canShare.mock.calls[0][0];
    expect(asked.files?.[0].name).toBe(SHARE_FILE);
    expect(asked.files?.[0].type).toBe('image/png');
    expect(await asked.files?.[0].text()).toBe('encoded');
    const sent = share.mock.calls[0][0];
    expect(sent).toMatchObject({ title: SHARE_TITLE, text: TEXT });
    expect(sent.files).toEqual(asked.files);
    expect(overlay).not.toHaveBeenCalled();
  });

  it('reaches the share sheet in the same task as the tap, encoding the canvas once', () => {
    const canvas = fakeCanvas();
    const deps = fakeDeps();
    // Not awaited: the sheet must already have been asked for when shareImage hands back its promise, or the
    // browser may have dropped the tap's user activation by the time it is.
    void shareImage(canvas, TEXT, deps);
    expect(deps.share).toHaveBeenCalledTimes(1);
    expect(canvas.toDataURL).toHaveBeenCalledTimes(1);
  });

  it('does nothing more when the player closes the sheet', async () => {
    const deps = fakeDeps({ share: vi.fn(async () => Promise.reject(named('AbortError'))) });
    expect(await shareImage(fakeCanvas(), TEXT, deps)).toBe('cancelled');
    expect(deps.overlay).not.toHaveBeenCalled();
  });

  it('shows the same picture to save when sharing fails any other way', async () => {
    for (const err of [named('NotAllowedError'), named('DataError'), new Error('target app crashed')]) {
      const canvas = fakeCanvas();
      const deps = fakeDeps({ share: vi.fn(async () => Promise.reject(err)) });
      expect(await shareImage(canvas, TEXT, deps)).toBe('saved');
      expect(deps.overlay).toHaveBeenCalledWith(ENCODED, TEXT);
      expect(canvas.toDataURL).toHaveBeenCalledTimes(1);
    }
  });

  it('shows the picture to save where the browser cannot share files', async () => {
    const refuses = fakeDeps({ canShare: vi.fn(() => false) });
    expect(await shareImage(fakeCanvas(), TEXT, refuses)).toBe('saved');
    expect(refuses.share).not.toHaveBeenCalled();
    expect(refuses.overlay).toHaveBeenCalledWith(ENCODED, TEXT);

    const throws = fakeDeps({
      canShare: vi.fn(() => {
        throw new TypeError('files are not supported');
      }),
    });
    expect(await shareImage(fakeCanvas(), TEXT, throws)).toBe('saved');
    expect(throws.share).not.toHaveBeenCalled();

    // No canShare (older browsers with share only), or no share API at all.
    for (const deps of [fakeDeps({ canShare: undefined }), fakeDeps({ share: undefined })]) {
      expect(await shareImage(fakeCanvas(), TEXT, deps)).toBe('saved');
      expect(deps.overlay).toHaveBeenCalledTimes(1);
    }
  });

  it('skips the sheet when the canvas gives no PNG, and fails loudly when it cannot be read at all', async () => {
    const deps = fakeDeps();
    expect(await shareImage(fakeCanvas('data:,'), TEXT, deps)).toBe('saved');
    expect(deps.canShare).not.toHaveBeenCalled();
    // A tainted canvas throws; shareResult (ui/share-result.ts) catches it and leaves the result panel as it was.
    await expect(shareImage(fakeCanvas('throw'), TEXT, fakeDeps())).rejects.toThrow('tainted');
  });
});

describe('pngBlob', () => {
  it('decodes a base64 PNG data URL into a PNG blob', async () => {
    const blob = pngBlob(ENCODED);
    expect(blob?.type).toBe('image/png');
    expect(await blob?.text()).toBe('encoded');
  });

  it('turns down anything else', () => {
    expect(pngBlob('data:,')).toBeNull();
    expect(pngBlob('data:image/jpeg;base64,ZW5jb2RlZA==')).toBeNull();
    expect(pngBlob('data:image/png;base64,***')).toBeNull();
  });
});
