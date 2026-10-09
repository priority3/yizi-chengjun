// What the player sees of the B5 cards: their descriptions (with the 鼓 beside a fighter and a 镜's current
// reflection), and their illustrations, which must stay inside the card and grow with the level.
import { describe as group, expect, it } from 'vitest';
import { MAX_LEVEL } from '../src/config/units.ts';
import { mirrorRate } from '../src/core/mirror.ts';
import { defaultMods } from '../src/core/treasures.ts';
import type { UnitId } from '../src/core/types.ts';
import { drawNeedleShot, drawNetOver, drawNetShot, drawPoisonBubbles } from '../src/render/fx-cards.ts';
import { drawUnitIcon } from '../src/render/unit-art.ts';
import { describe } from '../src/ui/describe.ts';
import { battle, emptyGame, put } from './helpers.ts';

/**
 * A stand-in 2D context that records the farthest point anything is painted at from the origin (transforms are not
 * followed: the painters under test draw in place) and how many shapes get filled or stroked.
 */
function recorder() {
  let reach = 0;
  let shapes = 0;
  const point = (x: number, y: number, r = 0) => {
    reach = Math.max(reach, Math.hypot(x, y) + r);
  };
  const gradient = { addColorStop: () => {} };
  const noop = () => {};
  const ctx = {
    lineWidth: 1,
    beginPath: noop,
    closePath: noop,
    moveTo: point,
    lineTo: point,
    quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => {
      point(cx, cy);
      point(x, y);
    },
    arc: (x: number, y: number, r: number) => point(x, y, r),
    ellipse: (x: number, y: number, rx: number, ry: number) => point(x, y, Math.max(rx, ry)),
    rect: (x: number, y: number, w: number, h: number) => {
      point(x, y);
      point(x + w, y + h);
    },
    fill: () => void shapes++,
    stroke: () => void shapes++,
    fillRect: (x: number, y: number, w: number, h: number) => {
      point(x, y);
      point(x + w, y + h);
      shapes++;
    },
    clip: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, reach: () => reach, shapes: () => shapes };
}

const NEW_CARDS: readonly UnitId[] = ['毒', '网', '鼓', '镜'];

group('descriptions of the new cards', () => {
  const mods = defaultMods();
  const card = (id: UnitId, level = 1) => ({ id, level, divine: false });

  it('give 毒 its poison per stack and 网 its hold, both growing with the level', () => {
    expect(describe(card('毒'), mods)).toBe('毒 · 毒针叠毒，最多 5 层，Boss 也吃满（伤害 5，每层每秒 2，射程 180）');
    expect(describe(card('毒', 2), mods)).toContain('（伤害 11，每层每秒 4.4，射程 180）');
    expect(describe(card('网'), mods)).toBe('网 · 撒网定身，Boss 也网得住（伤害 2，定身 1 秒，射程 150）');
    expect(describe(card('网', 5), mods)).toContain('定身 1.4 秒');
  });

  it('show a fighter beside a 鼓 hitting harder, and what the 鼓 and 镜 give', () => {
    const g = battle(emptyGame());
    const arrow = put(g, 3, '箭');
    expect(describe(arrow, g.mods, 'plain', { g, cell: 3 })).toContain('（伤害 8，射程 200）');
    put(g, 1, '鼓', 2);
    expect(describe(arrow, g.mods, 'plain', { g, cell: 3 })).toContain('（伤害 10，射程 200，鼓 +30%）');
    expect(describe(card('鼓'), mods)).toBe('鼓 · 周围 8 格的字每级伤害 +15%、攻速 +10%');
    expect(describe(card('鼓', 4), mods)).toContain('（现在伤害 +45%、攻速 +40%）');
    const rate = Math.round(mirrorRate(g, card('镜')) * 10) / 10;
    expect(describe(card('镜'), mods)).toBe('镜 · 每 6 秒把阵地受的伤反弹全场');
    expect(describe(card('镜'), g.mods, 'mire', { g, cell: -1 })).toBe(`镜 · 每 6 秒把阵地受的伤反弹全场（每 1 血反弹 ${rate}，最多存 30，泥沼）`);
  });
});

group('art of the new cards', () => {
  it('draws every level inside the illustration box, with more to it at the top level', () => {
    const s = 100;
    for (const id of NEW_CARDS) {
      const counts: number[] = [];
      for (let level = 1; level <= MAX_LEVEL; level++) {
        const r = recorder();
        expect(drawUnitIcon(r.ctx, id, 0, 0, s, level), id).toBe(true);
        // The parchment inside the frame spans about 0.9 s from the centre; the level aura already reaches 0.73 s.
        expect(r.reach(), `${id} level ${level}`).toBeLessThanOrEqual(0.75 * s);
        counts.push(r.shapes());
      }
      expect(counts[MAX_LEVEL - 1], `${id}: ${counts.join(' ')}`).toBeGreaterThan(counts[0]);
    }
  });

  it('draws the needle, the flying net, the bubbles and the net over a monster around their spot', () => {
    const needle = recorder();
    drawNeedleShot(needle.ctx);
    expect(needle.reach()).toBeLessThan(14);
    expect(needle.shapes()).toBeGreaterThan(2);
    // The flying net's mesh is clipped to its circle, which the recorder doesn't follow: count its shapes only.
    const flying = recorder();
    drawNetShot(flying.ctx, 1);
    expect(flying.shapes()).toBeGreaterThan(4);
    const bubbles = recorder();
    drawPoisonBubbles(bubbles.ctx, 0, 0, 12, 5, 0.7, 3);
    expect(bubbles.shapes()).toBeGreaterThanOrEqual(5);
    expect(bubbles.reach()).toBeLessThan(12 * 2);
    const net = recorder();
    drawNetOver(net.ctx, 0, 0, 12, 0.7, 3);
    expect(net.shapes()).toBeGreaterThan(3);
  });
});
