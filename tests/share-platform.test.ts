// shareImage's choices, with fake browser features: the share sheet with the PNG where the browser takes files,
// nothing more when the player closes the sheet, and the save-image overlay in every other case.
import { describe, expect, it, vi } from 'vitest';
import { SHARE_FILE, SHARE_TITLE, shareImage, type PngSource, type ShareDeps } from '../src/platform/share.ts';

const TEXT = '《字斗西游》第三章 · 平顶山：三星通关，击杀 87 只妖怪！';
/** What the fake canvas's toDataURL returns (a real one encodes the canvas again). */
const ENCODED = 'data:image/png;base64,ZW5jb2RlZA==';

/** A canvas whose toBlob hands back `blob` (null: the browser couldn't encode it) or throws. */
function fakeCanvas(blob: Blob | null | 'throw' = new Blob(['png bytes'], { type: 'image/png' })): PngSource {
  return {
    toBlob: (done: BlobCallback) => {
      if (blob === 'throw') throw new Error('tainted');
      done(blob);
    },
    toDataURL: () => ENCODED,
  };
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
    const sent = share.mock.calls[0][0];
    expect(sent).toMatchObject({ title: SHARE_TITLE, text: TEXT });
    expect(sent.files).toEqual(asked.files);
    expect(overlay).not.toHaveBeenCalled();
  });

  it('does nothing more when the player closes the sheet', async () => {
    const deps = fakeDeps({ share: vi.fn(async () => Promise.reject(named('AbortError'))) });
    expect(await shareImage(fakeCanvas(), TEXT, deps)).toBe('cancelled');
    expect(deps.overlay).not.toHaveBeenCalled();
  });

  it('shows the picture to save when sharing fails any other way', async () => {
    for (const err of [named('NotAllowedError'), named('DataError'), new Error('target app crashed')]) {
      const deps = fakeDeps({ share: vi.fn(async () => Promise.reject(err)) });
      expect(await shareImage(fakeCanvas(), TEXT, deps)).toBe('saved');
      expect(deps.overlay).toHaveBeenCalledWith(ENCODED, TEXT);
    }
  });

  it('shows the picture to save where the browser cannot share files', async () => {
    const refuses = fakeDeps({ canShare: vi.fn(() => false) });
    expect(await shareImage(fakeCanvas(), TEXT, refuses)).toBe('saved');
    expect(refuses.share).not.toHaveBeenCalled();
    expect(refuses.overlay).toHaveBeenCalledTimes(1);

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

  it('falls back to encoding the canvas again when it could not make a PNG blob', async () => {
    for (const canvas of [fakeCanvas(null), fakeCanvas('throw')]) {
      const deps = fakeDeps();
      expect(await shareImage(canvas, TEXT, deps)).toBe('saved');
      expect(deps.canShare).not.toHaveBeenCalled();
      expect(deps.overlay).toHaveBeenCalledWith(ENCODED, TEXT);
    }
  });

  it('shows the PNG it already made, read back as a data URL, when it can', async () => {
    const deps = fakeDeps({ canShare: vi.fn(() => false), dataUrl: vi.fn(async () => 'data:image/png;base64,cmVhZA==') });
    await shareImage(fakeCanvas(), TEXT, deps);
    expect(deps.overlay).toHaveBeenCalledWith('data:image/png;base64,cmVhZA==', TEXT);
    // A failed read falls back to encoding again.
    const failing = fakeDeps({ canShare: vi.fn(() => false), dataUrl: vi.fn(async () => Promise.reject(new Error('read'))) });
    await shareImage(fakeCanvas(), TEXT, failing);
    expect(failing.overlay).toHaveBeenCalledWith(ENCODED, TEXT);
  });
});
