// The web entry (src/main.ts) booted headless on a minimal fake page (tests/fake-page.ts) whose browser names no
// language, so the game stays in Chinese. Checks the console handle external screenshot scripts rely on (__yzcj:
// title / chapters / play / editor / about / current), the launch splash, taps from DOM pointer events, the #editor
// address, and a hidden page pausing and saving the run.
import { beforeAll, describe, expect, it } from 'vitest';
import { HEALTH_ADVICE } from '../src/config/legal.ts';
import { RUN_KEY } from '../src/platform/save.ts';
import { startButton } from '../src/ui/title-layout.ts';
import { app, body, bootWebEntry, canvases, doc, frame, frames, location, pointer, storage, win } from './fake-page.ts';

beforeAll(async () => {
  await bootWebEntry();
});

describe('web entry', () => {
  it('fits the stage into #app and opens on the 健康游戏忠告 splash', () => {
    expect(app.children[0]).toBe(canvases[0]);
    expect([canvases[0].width, canvases[0].height]).toEqual([360, 640]);
    expect(frames).toHaveLength(1);
    expect(frame()).toEqual(expect.arrayContaining([HEALTH_ADVICE[0]]));
  });

  it('keeps the __yzcj console handle working', () => {
    const handle = win.__yzcj;
    if (!handle) throw new Error('__yzcj is missing');
    handle.title();
    expect(frame()).toContain('开始游戏');
    handle.chapters();
    expect(frame()).toContain('选择章节');
    handle.about();
    expect(frame()).toContain('关于');
    handle.editor();
    expect(handle.inEditor()).toBe(true);
    handle.play(1);
    expect(handle.current).toBeDefined();
    frame();
    expect(typeof win.__yzcjIcon?.(32)).toBe('string');
  });

  it('turns DOM pointer events on the canvas into taps', () => {
    const handle = win.__yzcj;
    if (!handle) throw new Error('__yzcj is missing');
    handle.title();
    const b = startButton(false);
    const [x, y] = [b.x + b.w / 2, b.y + b.h / 2];
    canvases[0].dispatchEvent(pointer('pointerdown', x, y));
    canvases[0].dispatchEvent(pointer('pointerup', x, y));
    expect(frame()).toContain('选择章节');
  });

  it('follows the #editor address, and pauses and saves a run when the page is hidden', () => {
    const handle = win.__yzcj;
    if (!handle) throw new Error('__yzcj is missing');
    location.hash = '#editor';
    win.dispatchEvent(new Event('hashchange'));
    expect(handle.inEditor()).toBe(true);
    location.hash = '';
    win.dispatchEvent(new Event('hashchange'));
    expect(handle.inEditor()).toBe(false);
    expect(frame()).toContain('开始游戏');

    handle.play(1);
    storage.delete(RUN_KEY);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(storage.has(RUN_KEY)).toBe(true);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
  });

  it('shows a painted result card through the dev hook __yzcjShare', () => {
    expect(win.__yzcjShare?.({ chapter: 2 })).toBe('data:image/png;base64,AAAA');
    expect(body.children).toHaveLength(1);
  });
});
