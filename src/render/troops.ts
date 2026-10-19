// What a card is once it stands on the map (字旗＋小兵): its character on a war banner, and a squad of soldiers
// holding the card's gear, one soldier per level up to three (from level 4 they wear helmets; the banner's seal says
// the level). Heroes stand alone under a banner of their name, a name fragment or the 金 card is just its banner.
// drawTroop draws one pad's troop; muzzle says where the soldier whose turn it is lets a shot go.
import { HERO_RECIPES } from '../config/combos.ts';
import { glyphOf, UNITS } from '../config/units.ts';
import type { Pt } from '../core/map.ts';
import type { HeroId, Tile, UnitId } from '../core/types.ts';
import { roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { CINNABAR, ink, INK, PAPER, wash } from './ink.ts';
import { drawHeroFigure, HERO_SCALE, heroTip } from './troop-heroes.ts';
import { drawSoldier, gearTip, type Look } from './troop-parts.ts';

/** How long a strike or a pulse takes to play, in seconds (shorter for cards that attack faster). */
export function strikeTime(id: UnitId): number {
  const every = UNITS[id].interval;
  return every > 0 ? Math.min(0.42, every * 0.8) : 0.42;
}

const LOOKS: Partial<Record<UnitId, Look>> = {
  棍: { cloth: '#7a3b12', trim: '#d9a531', hat: 'band', hatColor: '#c8322a', gear: 'staff' },
  箭: { cloth: '#2c6e2f', trim: '#d9c9a4', hat: 'knot', hatColor: INK, gear: 'bow' },
  火: { cloth: '#d23a12', trim: '#f2c14e', hat: 'band', hatColor: '#f2c14e', gear: 'fire' },
  冰: { cloth: '#1e84b8', trim: '#e6f2f8', hat: 'hood', hatColor: '#e6f2f8', gear: 'ice' },
  雷: { cloth: '#6a35b5', trim: '#f2d36a', hat: 'straw', hatColor: '#d9b56b', gear: 'thunder' },
  毒: { cloth: '#3f8f2a', trim: '#2b2420', hat: 'hood', hatColor: '#2f6a22', gear: 'pipe' },
  网: { cloth: '#8a5a24', trim: '#d9c9a4', hat: 'straw', hatColor: '#d9b56b', gear: 'net' },
  速: { cloth: '#0d7f73', trim: '#f2c14e', hat: 'band', hatColor: '#f2c14e', gear: 'signal' },
  钱: { cloth: '#a87400', trim: '#c8322a', hat: 'cap', hatColor: INK, gear: 'coins' },
  疗: { cloth: '#c93f73', trim: '#f4e8cc', hat: 'knot', hatColor: INK, gear: 'gourd' },
  鼓: { cloth: '#b8321f', trim: '#f2c14e', hat: 'band', hatColor: '#f4e8cc', gear: 'drum' },
  镜: { cloth: '#6f86a6', trim: '#e6eef6', hat: 'cap', hatColor: '#3a4a5e', gear: 'mirror' },
};

/** Where the banner's pole and each soldier stand, relative to the pad's centre, by squad size (back to front). */
const FLAG_AT: readonly [number, number] = [-15, 3];
const SPOTS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[5, 4]],
  [[12, 1], [0, 6]],
  [[7, 1], [-3, 7], [15, 7]],
];
// Reason: a hero stands further right than a soldier would, so its bigger head doesn't cover its two-character banner.
const HERO_AT: readonly [number, number] = [10, 6];

/** Fragments that are the right half of a name (空/戒/僧/龙): their banner is torn on the pole side instead. */
const RIGHT_HALF = new Set<UnitId>(HERO_RECIPES.map((r) => r.b));

/** How many soldiers a tile's squad has (a hero, a fragment or the 金 card counts as one). */
export function troopSize(t: Pick<Tile, 'id' | 'level'>): number {
  return LOOKS[t.id] ? Math.min(3, t.level) : 1;
}

interface FlagStyle {
  cloth: string;
  trim: string;
  glyph: string;
}

/** The banner's cloth: paper with a band in the card's colour; gold when gilded; a fragment's is torn. */
function flagStyle(t: Tile): FlagStyle {
  const def = UNITS[t.id];
  if (def.kind === 'divine') return { cloth: '#e8c35a', trim: CINNABAR, glyph: CINNABAR };
  if (t.divine) return { cloth: '#ecc85e', trim: CINNABAR, glyph: INK };
  return { cloth: PAPER, trim: def.kind === 'fragment' ? '#c9a24a' : def.color, glyph: INK };
}

/**
 * A war banner whose pole stands at (x, y): the card's character on its cloth (a hero's two stacked), the level on a
 * cinnabar seal hung on the pole from level 2, the free edge stirring in the wind. A fragment's cloth is frayed on
 * one side.
 */
function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, t: Tile, time: number): void {
  const st = flagStyle(t);
  const sway = Math.sin(time * 2.4 + x * 0.05) * 1.3;
  const fragment = UNITS[t.id].kind === 'fragment';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 44);
  ctx.stroke();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#6b4a2a';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 45, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#d9a531';
  ctx.fill();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const top = y - 42;
  const bottom = y - 18;
  const far = x + 23 + sway;
  ctx.beginPath();
  ctx.moveTo(x + 1, top);
  ctx.quadraticCurveTo(x + 12, top - 2 + sway * 0.3, far, top + 1);
  if (fragment && !RIGHT_HALF.has(t.id)) {
    // Frayed along the free edge: a zigzag down instead of a hem.
    for (let i = 1; i <= 6; i++) ctx.lineTo(far + (i % 2 ? -3 : 0) - (i / 6) * sway * 0.4, top + 1 + (i / 6) * (bottom - top - 1));
  } else ctx.lineTo(x + 23 + sway * 0.6, bottom);
  ctx.quadraticCurveTo(x + 12, bottom - 2.5, x + 1, bottom);
  if (fragment && RIGHT_HALF.has(t.id)) {
    for (let i = 1; i <= 5; i++) ctx.lineTo(x + 1 + (i % 2 ? 3 : 0), bottom - (i / 6) * (bottom - top));
  }
  ctx.closePath();
  ctx.fillStyle = st.cloth;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 1, bottom - 1.2);
  ctx.quadraticCurveTo(x + 12, bottom - 3.6, x + 22.5 + sway * 0.6, bottom - 1.2);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = st.trim;
  ctx.stroke();
  const g = glyphOf(t.id);
  const cx = x + 12 + sway * 0.4;
  if (g.length === 1) text(ctx, g, cx, top + 11.5, brush(17), st.glyph);
  else {
    text(ctx, g[0], cx, top + 6.5, brush(11), st.glyph);
    text(ctx, g[1], cx, top + 16.5, brush(11), st.glyph);
  }
  if (t.level >= 2) {
    // Reason: hung on the pole's far side from the cloth, where no soldier ever stands in front of it.
    roundRect(ctx, x - 9.5, top + 9, 8, 8, 1.4);
    ctx.fillStyle = CINNABAR;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = INK;
    ctx.stroke();
    text(ctx, String(t.level), x - 5.5, top + 13.3, sans(7, 800), PAPER);
  }
}

/**
 * The troop of tile `t` on the pad centred at (x, y): its banner, then its soldiers (or hero) back to front, all
 * facing `face`. `since` is the time since the troop last struck or pulsed; `shooter` is the soldier who did
 * (-1 for the whole squad).
 */
export function drawTroop(ctx: CanvasRenderingContext2D, t: Tile, x: number, y: number, face: number, since: number, shooter: number, time: number): void {
  const def = UNITS[t.id];
  const dur = strikeTime(t.id);
  const phase = since < dur ? since / dur : 0;
  if (t.divine) wash(ctx, x, y + 4, 30, '226,177,60', 0.35);
  const look = LOOKS[t.id];
  if (!look && def.kind !== 'hero') {
    // A fragment or the 金 card: just its banner, centred on the pad.
    drawFlag(ctx, x - 8, y + 4, t, time);
    return;
  }
  drawFlag(ctx, x + FLAG_AT[0], y + FLAG_AT[1], t, time);
  if (def.kind === 'hero') {
    drawHeroFigure(ctx, x + HERO_AT[0], y + HERO_AT[1], t.id as HeroId, face, phase, time, t.divine);
    return;
  }
  if (!look) return;
  const dress = { armored: t.level >= 4, gilded: t.divine };
  const spots = SPOTS[troopSize(t) - 1];
  spots.forEach(([dx, dy], i) => {
    const a = shooter < 0 || shooter === i ? phase : 0;
    drawSoldier(ctx, x + dx, y + dy, look, dress, face, a, time);
  });
}

/** Where the attack of tile `t` on the pad at (x, y), facing `face`, leaves when soldier `shooter` strikes. */
export function muzzle(t: Tile, x: number, y: number, face: number, shooter: number): Pt {
  if (UNITS[t.id].kind === 'hero') {
    const [tx, ty] = heroTip(t.id as HeroId);
    return { x: x + HERO_AT[0] + face * tx * HERO_SCALE, y: y + HERO_AT[1] + ty * HERO_SCALE };
  }
  const look = LOOKS[t.id];
  if (!look) return { x, y: y - 20 };
  const spots = SPOTS[troopSize(t) - 1];
  const [sx, sy] = spots[Math.max(0, shooter) % spots.length];
  const [tx, ty] = gearTip(look.gear);
  return { x: x + sx + face * tx, y: y + sy + ty };
}

/** The golden ring on the ground under a hero whose rage is full; it breathes until the ultimate goes off. */
export function drawReadyRing(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const k = 0.6 + 0.4 * Math.sin(time * 9);
  wash(ctx, x, y + 6, 34, '255,200,70', 0.35 + 0.2 * k);
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 26 + k * 2, 16 + k, 0, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(255,200,70,${(0.6 + 0.3 * k).toFixed(3)})`;
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = ink(0.4);
  ctx.stroke();
}
