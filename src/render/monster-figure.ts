// The bodies of the masked monsters (脸谱小鬼): legs, a robe, armour or rib-striped bones, wings or spider legs behind,
// and what grows on the head (horns, ears, hair, buns, fins, a crest). All of it is drawn in the figure's own units:
// feet at the origin, facing right, a 小妖 about 31 units tall; monsters-art.ts scales a figure to its monster's radius
// and caches it as a sprite. The faces are in monster-masks.ts, what the monsters carry in monster-gear.ts.
import { CINNABAR, ink, INK } from './ink.ts';

export type Body = 'robe' | 'wide' | 'armor' | 'bones' | 'bib' | 'none';
export type Head = 'none' | 'nubs' | 'pointy' | 'round' | 'bat' | 'goldHorns' | 'bigHorns' | 'bullHorns' | 'hair' | 'topknots' | 'fins' | 'crest' | 'bigCrest' | 'band' | 'bald';
export type Back = 'batWings' | 'birdWings' | 'goldWings' | 'spiderLegs' | 'wind' | 'none';

export const GOLD = '#e2b13c';
export const SKIN = '#f0d2ae';
const IRON = '#7d868c';

/** Head centre height and radius in figure units. */
export const HEAD_Y = -23;

export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, color: string): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  for (const [lw, c] of [
    [w + 1.6, INK],
    [w, color],
  ] as const) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = c;
    ctx.stroke();
  }
}

export function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline = 1): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

type Pt = [number, number];

/** The point at `t` (0..1) along the quadratic curve p0 -> p1 bending towards c. */
function qpt(p0: Pt, c: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * t * u * c[0] + t * t * p1[0], u * u * p0[1] + 2 * t * u * c[1] + t * t * p1[1]];
}

export function outline(ctx: CanvasRenderingContext2D, w = 1.1): void {
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** What spreads behind the body: wings, a spider's eight legs, or 黄风怪's whirling wind. */
export function paintBack(ctx: CanvasRenderingContext2D, back: Back, cloth: string): void {
  switch (back) {
    case 'batWings':
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(q * 3, -14);
        ctx.quadraticCurveTo(q * 16, -27, q * 20, -12);
        ctx.quadraticCurveTo(q * 14.5, -14, q * 13, -8.5);
        ctx.quadraticCurveTo(q * 9, -12, q * 4, -9);
        ctx.closePath();
        ctx.fillStyle = '#4a3466';
        ctx.fill();
        outline(ctx, 1.2);
        line(ctx, q * 4, -12, q * 14, -15, 0.3, '#2a1a3a');
      }
      break;
    case 'birdWings':
    case 'goldWings': {
      const big = back === 'goldWings';
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(q * 3, -15);
        ctx.quadraticCurveTo(q * (big ? 17 : 11), -(big ? 30 : 21), q * (big ? 18 : 12), -8);
        ctx.quadraticCurveTo(q * (big ? 12 : 8), -9, q * 4, -7);
        ctx.closePath();
        ctx.fillStyle = big ? GOLD : '#f2c14e';
        ctx.fill();
        outline(ctx, 1.1);
        for (let i = 0; i < (big ? 4 : 2); i++) {
          const t = (i + 1) / (big ? 5 : 3);
          line(ctx, q * (4 + t * 2), -9 - t * 2, q * (5 + t * (big ? 11 : 6)), -9 - t * (big ? 14 : 8), 0.2, '#b07a1a');
        }
      }
      break;
    }
    case 'spiderLegs':
      ctx.lineCap = 'round';
      for (const q of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const y0 = -11 + i * 2.2;
          ctx.beginPath();
          ctx.moveTo(q * 3, y0);
          // Reason: the knees stay high and every foot comes down near the ground line, wherever its leg starts.
          ctx.quadraticCurveTo(q * (10 + i), y0 - 8 + i, q * (13 + i * 0.6), -2.4 + i * 1.2);
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = INK;
          ctx.stroke();
          ctx.lineWidth = 1.1;
          ctx.strokeStyle = cloth;
          ctx.stroke();
        }
      }
      break;
    case 'wind':
      // Three gusts curling round the body, each a tail running into a tightening curl, and a few grains of sand.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(196,140,50,0.85)';
      ctx.fillStyle = 'rgba(196,140,50,0.85)';
      ctx.lineWidth = 1.5;
      for (const [x, y, r, q] of [
        [-12, -8, 3.6, 1],
        [12.5, -17, 3.2, -1],
        [-10, -31, 2.6, 1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(x + q * r * 2.6, y + r);
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const a = Math.PI / 2 + q * t * Math.PI * 2.4;
          ctx.lineTo(x + Math.cos(a) * r * (1 - 0.7 * t), y + Math.sin(a) * r * (1 - 0.7 * t));
        }
        ctx.stroke();
      }
      for (const [x, y] of [
        [-15, -19],
        [15, -7],
        [-5, -38],
        [10, -31],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'none':
      break;
  }
}

/** The legs (none for a flyer or a spider's abdomen), then the robe, armour, bones or bare chest with its bib. */
export function paintBody(ctx: CanvasRenderingContext2D, body: Body, cloth: string, trim: string, legs: boolean): void {
  ctx.lineJoin = 'round';
  if (legs) {
    ctx.strokeStyle = '#2e2622';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2.4, -7);
    ctx.lineTo(-3, 0);
    ctx.moveTo(2.4, -7);
    ctx.lineTo(3.2, 0);
    ctx.stroke();
  }
  if (body === 'none') {
    // A spider's round abdomen in place of a robe.
    ctx.beginPath();
    ctx.ellipse(-1, -9, 6.4, 5.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = cloth;
    ctx.fill();
    outline(ctx, 1.2);
    ctx.beginPath();
    ctx.moveTo(-3.4, -11);
    ctx.lineTo(-1, -6.6);
    ctx.lineTo(1.4, -11);
    ctx.lineWidth = 1;
    ctx.strokeStyle = CINNABAR;
    ctx.stroke();
    return;
  }
  const half = body === 'wide' || body === 'armor' ? 7.4 : 6;
  const top = body === 'wide' || body === 'armor' ? 5.4 : 4.4;
  ctx.beginPath();
  ctx.moveTo(-half, -5.5);
  ctx.lineTo(half, -5.5);
  ctx.lineTo(top, -15);
  ctx.lineTo(-top, -15);
  ctx.closePath();
  ctx.fillStyle = body === 'bib' ? SKIN : cloth;
  ctx.fill();
  outline(ctx);
  if (body === 'bones') {
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = ink(0.55);
    for (let i = 0; i < 3; i++) {
      const y = -13 + i * 2.4;
      ctx.beginPath();
      ctx.moveTo(-3.4 - i * 0.4, y);
      ctx.quadraticCurveTo(0, y + 1, 3.4 + i * 0.4, y);
      ctx.stroke();
    }
  }
  if (body === 'bib') {
    ctx.beginPath();
    ctx.moveTo(0, -14.6);
    ctx.lineTo(4.2, -10);
    ctx.lineTo(0, -5.8);
    ctx.lineTo(-4.2, -10);
    ctx.closePath();
    ctx.fillStyle = cloth;
    ctx.fill();
    outline(ctx, 0.9);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-0.6, -11, 1.2, 1.2);
    return;
  }
  ctx.fillStyle = trim;
  ctx.fillRect(-half + 0.8, -10.2, (half - 0.8) * 2, 1.8);
  if (body === 'armor') {
    for (const q of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(q * 4.6, -14, 3.2, 1.8, q * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = IRON;
      ctx.fill();
      outline(ctx, 0.9);
    }
    ctx.beginPath();
    ctx.ellipse(0, -12.6, 2.6, 1.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    outline(ctx, 0.8);
  }
}

/** What grows behind or on the head: drawn before the head disc for horns and ears, after it for buns and crests. */
export function paintHead(ctx: CanvasRenderingContext2D, head: Head, face: string, hr: number, front: boolean): void {
  const hy = HEAD_Y;
  ctx.lineJoin = 'round';
  if (!front) {
    switch (head) {
      case 'nubs':
        for (const q of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(q * 2.6, hy - hr * 0.84);
          ctx.lineTo(q * 4.2, hy - hr * 1.5);
          ctx.lineTo(q * 5.4, hy - hr * 0.7);
          ctx.closePath();
          ctx.fillStyle = '#efe2c4';
          ctx.fill();
          outline(ctx, 0.9);
        }
        break;
      case 'pointy':
      case 'bat': {
        const big = head === 'bat';
        for (const q of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(q * 2.5, hy - hr * 0.7);
          ctx.lineTo(q * (big ? 8.5 : 6.5), hy - hr * (big ? 1.95 : 1.55));
          ctx.lineTo(q * 7, hy - hr * 0.3);
          ctx.closePath();
          ctx.fillStyle = face;
          ctx.fill();
          outline(ctx);
        }
        break;
      }
      case 'round':
        for (const q of [-1, 1]) {
          blob(ctx, q * hr * 0.76, hy - hr * 0.73, hr * 0.35, face, 1);
          blob(ctx, q * hr * 0.76, hy - hr * 0.73, hr * 0.16, 'rgba(255,240,220,0.35)', 0);
        }
        break;
      case 'goldHorns':
      case 'bigHorns': {
        // Thick crescents rooted across the top of the head, bending outward to a point, with ridges near the root.
        const gold = head === 'goldHorns';
        for (const q of [-1, 1]) {
          const outer: Pt = [q * hr * 0.75, hy - hr * 0.66];
          const outerC: Pt = [q * hr * 1.55, hy - hr * 1.05];
          const tip: Pt = [q * hr * 1.6, hy - hr * 2.25];
          const innerC: Pt = [q * hr * 1.05, hy - hr * 1.35];
          const inner: Pt = [q * hr * 0.15, hy - hr * 0.99];
          ctx.beginPath();
          ctx.moveTo(...outer);
          ctx.quadraticCurveTo(...outerC, ...tip);
          ctx.quadraticCurveTo(...innerC, ...inner);
          ctx.closePath();
          ctx.fillStyle = gold ? GOLD : '#3a3238';
          ctx.fill();
          outline(ctx);
          ctx.beginPath();
          for (const t of [0.22, 0.42]) {
            ctx.moveTo(...qpt(outer, outerC, tip, t));
            ctx.lineTo(...qpt(tip, innerC, inner, 1 - t));
          }
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = gold ? '#a8781a' : '#6a6270';
          ctx.stroke();
        }
        break;
      }
      case 'bullHorns':
        for (const q of [-1, 1]) {
          ctx.beginPath();
          // Out from the sides of the head and up: the lower edge first, then back along the upper one.
          ctx.moveTo(q * hr * 0.97, hy - hr * 0.26);
          ctx.quadraticCurveTo(q * hr * 2.3, hy - hr * 0.4, q * hr * 1.9, hy - hr * 2);
          ctx.quadraticCurveTo(q * hr * 1.45, hy - hr * 0.95, q * hr * 0.5, hy - hr * 0.87);
          ctx.closePath();
          ctx.fillStyle = '#efe2c4';
          ctx.fill();
          outline(ctx);
        }
        break;
      case 'hair':
        // Long black hair falling behind the shoulders.
        ctx.beginPath();
        ctx.moveTo(-hr * 0.9, hy - 1);
        ctx.quadraticCurveTo(-hr * 1.4, hy + 10, -hr * 0.6, hy + 14);
        ctx.lineTo(hr * 0.2, hy + 6);
        ctx.quadraticCurveTo(hr * 0.9, hy - hr * 1.2, -hr * 0.9, hy - 1);
        ctx.closePath();
        ctx.fillStyle = '#1e1a1c';
        ctx.fill();
        outline(ctx, 0.9);
        break;
      case 'fins':
        for (const q of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(q * hr * 0.8, hy - 1.5);
          ctx.quadraticCurveTo(q * hr * 1.7, hy - hr * 1.2, q * hr * 1.6, hy + 2.5);
          ctx.closePath();
          ctx.fillStyle = '#f08a3a';
          ctx.fill();
          outline(ctx, 0.9);
        }
        break;
      default:
        break;
    }
    return;
  }
  switch (head) {
    case 'bald':
      // A shine on the shaven crown.
      ctx.beginPath();
      ctx.arc(0, hy, hr * 0.72, Math.PI * 1.25, Math.PI * 1.55);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255,250,235,0.7)';
      ctx.stroke();
      break;
    case 'hair':
      // A bun with a red flower.
      ctx.beginPath();
      ctx.arc(0, hy - 0.8, hr + 0.3, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fillStyle = '#1e1a1c';
      ctx.fill();
      blob(ctx, -2.4, hy - hr - 2, 2.6, '#1e1a1c', 0.8);
      blob(ctx, 1.6, hy - hr - 1.4, 1.4, CINNABAR, 0.6);
      break;
    case 'topknots':
      for (const x of [-4.6, 0, 4.6]) blob(ctx, x, hy - hr + (x === 0 ? -1.6 : 0.4), 2, '#1e1a1c', 0.8);
      break;
    case 'crest':
    case 'bigCrest': {
      // Three leaf-shaped feathers fanning up and back from the crown.
      const big = head === 'bigCrest';
      const len = big ? 11 : 6.5;
      const wid = big ? 4.4 : 3;
      for (let i = 0; i < 3; i++) {
        const a = -0.75 + i * 0.4;
        const dx = Math.sin(a);
        const dy = -Math.cos(a);
        const bx = -1.5 + i * 1.5;
        const by = hy - hr + 1;
        const mx = bx + dx * len * 0.5;
        const my = by + dy * len * 0.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(mx - dy * wid, my + dx * wid, bx + dx * len, by + dy * len);
        ctx.quadraticCurveTo(mx + dy * wid, my - dx * wid, bx, by);
        ctx.closePath();
        ctx.fillStyle = big ? '#e2582f' : '#f2a03a';
        ctx.fill();
        outline(ctx, 0.8);
      }
      break;
    }
    case 'band':
      ctx.beginPath();
      ctx.arc(0, hy - 0.6, hr + 0.2, Math.PI * 1.08, Math.PI * 1.92);
      ctx.fillStyle = '#2a3a2e';
      ctx.fill();
      outline(ctx, 0.8);
      line(ctx, -hr, hy - 2, -hr - 3.4, hy + 1, 0.8, '#2a3a2e');
      break;
    default:
      break;
  }
}
