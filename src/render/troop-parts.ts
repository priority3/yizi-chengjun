// The little soldiers a card turns into on the map (字旗＋小兵), drawn in the 国潮青绿 ink style: legs, a tunic in the
// card's colour, a head with its hat, and the gear the card fights or works with, posed by `a`, the attack phase
// (0 at rest, rising through wind-up and strike back to rest). Everything is drawn facing right with its feet at the
// origin; drawSoldier mirrors it for a soldier facing left. troops.ts decides who stands where and when they strike.
import { ink, INK } from './ink.ts';

export type Hat = 'knot' | 'band' | 'helm' | 'straw' | 'hood' | 'cap';
export type Gear = 'staff' | 'bow' | 'fire' | 'ice' | 'thunder' | 'pipe' | 'net' | 'signal' | 'coins' | 'gourd' | 'drum' | 'mirror';

/** What a card's soldiers look like. */
export interface Look {
  /** Tunic. */
  cloth: string;
  /** Belt, headband, collar. */
  trim: string;
  hat: Hat;
  hatColor: string;
  gear: Gear;
}

/** How a level or 鎏金 dresses the same soldier: an iron (or gilt) helmet from level 4, gold trim when gilded. */
export interface Dress {
  armored: boolean;
  gilded: boolean;
}

const SKIN = '#f0d2ae';
const WOOD = '#6b4a2a';
const IRON = '#8d969c';
const GOLD = '#e2b13c';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.max(0, Math.min(1, t));

/** A stroke drawn twice, ink a little wider under the colour, so thin parts still carry an outline. */
function inkedLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, color: string): void {
  ctx.lineCap = 'round';
  for (const [lw, c] of [
    [w + 1.6, INK],
    [w, color],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineWidth = lw;
    ctx.strokeStyle = c;
    ctx.stroke();
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline = true): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

/** An arm in the tunic's colour from the shoulder to the hand, with the hand on the end. */
function arm(ctx: CanvasRenderingContext2D, sx: number, sy: number, hx: number, hy: number, cloth: string): void {
  inkedLine(ctx, sx, sy, hx, hy, 2, cloth);
  dot(ctx, hx, hy, 1.4, SKIN, false);
}

function body(ctx: CanvasRenderingContext2D, look: Look, dress: Dress): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3a3330';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-2, -6);
  ctx.lineTo(-2.6, 0);
  ctx.moveTo(2, -6);
  ctx.lineTo(2.8, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5.2, -5);
  ctx.lineTo(5.2, -5);
  ctx.lineTo(3.8, -14.5);
  ctx.lineTo(-3.8, -14.5);
  ctx.closePath();
  ctx.fillStyle = look.cloth;
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = dress.gilded ? GOLD : look.trim;
  ctx.fillRect(-4.6, -9.4, 9.2, 1.8);
  if (dress.armored) {
    // Shoulder plates.
    ctx.beginPath();
    ctx.ellipse(-3.2, -13.6, 2.4, 1.4, -0.3, 0, Math.PI * 2);
    ctx.ellipse(3.2, -13.6, 2.4, 1.4, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = dress.gilded ? GOLD : IRON;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

function head(ctx: CanvasRenderingContext2D, look: Look, dress: Dress): void {
  dot(ctx, 0, -18.8, 4.6, SKIN);
  ctx.fillStyle = INK;
  ctx.fillRect(1.6, -19.4, 1.1, 1.6);
  const hat: Hat = dress.armored ? 'helm' : look.hat;
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK;
  switch (hat) {
    case 'knot':
    case 'band':
      ctx.beginPath();
      ctx.arc(0, -19.6, 4.7, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fillStyle = INK;
      ctx.fill();
      dot(ctx, -1.6, -24.4, 2, INK, false);
      if (hat === 'band') {
        inkedLine(ctx, -4.6, -20.8, 4.4, -20.8, 1.2, look.hatColor);
        ctx.beginPath();
        ctx.moveTo(-4.4, -20.8);
        ctx.quadraticCurveTo(-7.5, -21.5, -8.6, -19);
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = look.hatColor;
        ctx.stroke();
      }
      break;
    case 'helm': {
      ctx.beginPath();
      ctx.arc(0, -19.6, 5, Math.PI, Math.PI * 2);
      ctx.lineTo(5.6, -18.8);
      ctx.lineTo(-5.6, -18.8);
      ctx.closePath();
      ctx.fillStyle = dress.gilded ? GOLD : IRON;
      ctx.fill();
      ctx.stroke();
      // The red tassel on top.
      ctx.beginPath();
      ctx.moveTo(0, -24.6);
      ctx.quadraticCurveTo(-2.5, -28, -4.4, -26.4);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#c8322a';
      ctx.stroke();
      break;
    }
    case 'straw':
      ctx.beginPath();
      ctx.moveTo(-8.4, -20.4);
      ctx.quadraticCurveTo(0, -27.8, 8.4, -20.4);
      ctx.quadraticCurveTo(0, -22, -8.4, -20.4);
      ctx.closePath();
      ctx.fillStyle = look.hatColor;
      ctx.fill();
      ctx.stroke();
      break;
    case 'hood':
      ctx.beginPath();
      ctx.arc(-0.6, -19.4, 5.4, Math.PI * 0.55, Math.PI * 1.85);
      ctx.quadraticCurveTo(3.4, -22.6, 2.6, -21.2);
      ctx.quadraticCurveTo(-1.5, -20, -2.4, -14.6);
      ctx.closePath();
      ctx.fillStyle = look.hatColor;
      ctx.fill();
      ctx.stroke();
      break;
    case 'cap':
      ctx.beginPath();
      ctx.arc(0, -20.4, 4.4, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = look.hatColor;
      ctx.fill();
      ctx.stroke();
      dot(ctx, 0, -25, 1.1, '#c8322a', false);
      break;
  }
}

/** A tiny teardrop flame at (x, y), `r` across. */
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - r * 1.3, y + r * 0.6, x - r * 0.8, y - r * 0.6, x + r * 0.1, y - r * 1.8);
  ctx.bezierCurveTo(x + r * 0.9, y - r * 0.6, x + r * 1.3, y + r * 0.6, x, y + r);
  ctx.closePath();
  ctx.fillStyle = '#e2582f';
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = INK;
  ctx.stroke();
  dot(ctx, x, y + r * 0.1, r * 0.45, '#f6c35a', false);
}

/** The staff's angle (radians, 0 = pointing ahead): resting up at a slant, raised back, then brought down in front. */
function staffAngle(a: number): number {
  if (a <= 0) return -1.15;
  if (a < 0.4) return lerp(-1.15, -2.3, a / 0.4);
  if (a < 0.6) return lerp(-2.3, 0.35, (a - 0.4) / 0.2);
  return lerp(0.35, -1.15, (a - 0.6) / 0.4);
}

/** How far a throwing hand is wound back (0 at rest and after, 1 at the top of the wind-up). */
const windUp = (a: number): number => (a <= 0 ? 0 : a < 0.35 ? a / 0.35 : a < 0.5 ? 1 - (a - 0.35) / 0.15 : 0);
/** Whether a thrown thing has left the hand (from the throw until just before the soldier is ready again). */
const thrown = (a: number): boolean => a >= 0.45 && a < 0.92;

/** The gear and the arms holding it, for the pose `a` at time `time`. */
function gear(ctx: CanvasRenderingContext2D, look: Look, a: number, time: number): void {
  const cloth = look.cloth;
  switch (look.gear) {
    case 'staff': {
      const th = staffAngle(a);
      const dx = Math.cos(th);
      const dy = Math.sin(th);
      const hx = 4;
      const hy = -12;
      inkedLine(ctx, hx - dx * 8, hy - dy * 8, hx + dx * 17, hy + dy * 17, 1.6, WOOD);
      dot(ctx, hx + dx * 17, hy + dy * 17, 1.2, GOLD, false);
      arm(ctx, -1.5, -13, hx - dx * 4, hy - dy * 4, cloth);
      arm(ctx, 2.5, -13, hx, hy, cloth);
      break;
    }
    case 'bow': {
      const draw = a <= 0 ? 0.15 : a < 0.55 ? 0.15 + (a / 0.55) * 0.85 : 0;
      const bx = 6.5;
      const by = -12.8;
      ctx.beginPath();
      ctx.arc(bx - 3, by, 6.6, -1.05, 1.05);
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = WOOD;
      ctx.stroke();
      const tipX = bx - 3 + Math.cos(1.05) * 6.6;
      const tipY = Math.sin(1.05) * 6.6;
      const px = tipX - 1.2 - draw * 5;
      ctx.beginPath();
      ctx.moveTo(tipX, by - tipY);
      ctx.lineTo(px, by);
      ctx.lineTo(tipX, by + tipY);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = '#efe6d0';
      ctx.stroke();
      if (a < 0.55) {
        inkedLine(ctx, px, by, bx + 4, by, 0.8, '#d9c9a4');
        ctx.beginPath();
        ctx.moveTo(bx + 6, by);
        ctx.lineTo(bx + 3.6, by - 1.6);
        ctx.lineTo(bx + 3.6, by + 1.6);
        ctx.closePath();
        ctx.fillStyle = INK;
        ctx.fill();
      }
      arm(ctx, 2.5, -13, bx, by, cloth);
      arm(ctx, -0.5, -13, px, by, cloth);
      break;
    }
    case 'fire':
    case 'net': {
      const w = windUp(a);
      const hx = lerp(6.5, -3.5, w);
      const hy = lerp(-12, -21, w);
      arm(ctx, 2, -13.2, hx, hy, cloth);
      if (!thrown(a)) {
        if (look.gear === 'fire') flame(ctx, hx + 0.5, hy - 2.6, 2.6);
        else {
          ctx.beginPath();
          ctx.ellipse(hx + 1, hy - 1.5, 4, 3.2, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#d8c7a0';
          ctx.fill();
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = INK;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(hx - 2, hy - 3);
          ctx.lineTo(hx + 3, hy + 0.5);
          ctx.moveTo(hx + 3.6, hy - 3.4);
          ctx.lineTo(hx - 1.6, hy + 0.4);
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      arm(ctx, -2, -13, -4, -9, cloth);
      break;
    }
    case 'ice': {
      // A staff with an ice crystal on top, tipped forward to point at the target on the strike.
      const tilt = a <= 0 ? 0 : a < 0.45 ? (a / 0.45) * 0.9 : lerp(0.9, 0, (a - 0.45) / 0.55);
      const th = -Math.PI / 2 + tilt;
      const hx = 5;
      const hy = -11.5;
      const tx = hx + Math.cos(th) * 15;
      const ty = hy + Math.sin(th) * 15;
      inkedLine(ctx, hx - Math.cos(th) * 9, hy - Math.sin(th) * 9, tx, ty, 1.3, WOOD);
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(th) * 5, ty + Math.sin(th) * 5);
      ctx.lineTo(tx - Math.sin(th) * 2.4, ty + Math.cos(th) * 2.4);
      ctx.lineTo(tx - Math.cos(th) * 1.5, ty - Math.sin(th) * 1.5);
      ctx.lineTo(tx + Math.sin(th) * 2.4, ty - Math.cos(th) * 2.4);
      ctx.closePath();
      ctx.fillStyle = '#bfe8f6';
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = INK;
      ctx.stroke();
      arm(ctx, 2.5, -13, hx, hy, cloth);
      arm(ctx, -2, -13, -3.5, -9, cloth);
      break;
    }
    case 'thunder': {
      // A mallet raised over the head on the strike, sparking at the top.
      const up = a <= 0 ? 0 : a < 0.25 ? a / 0.25 : a < 0.65 ? 1 : lerp(1, 0, (a - 0.65) / 0.35);
      const hx = lerp(6, 2.5, up);
      const hy = lerp(-11.5, -25.5, up);
      const th = lerp(-0.6, -1.5, up);
      const mx = hx + Math.cos(th) * 6;
      const my = hy + Math.sin(th) * 6;
      inkedLine(ctx, hx, hy, mx, my, 1.2, WOOD);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(th + Math.PI / 2);
      ctx.fillStyle = '#7a52b8';
      ctx.fillRect(-3.4, -1.8, 6.8, 3.6);
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = INK;
      ctx.strokeRect(-3.4, -1.8, 6.8, 3.6);
      ctx.restore();
      if (up > 0.8) {
        ctx.beginPath();
        ctx.moveTo(mx - 2, my - 3);
        ctx.lineTo(mx + 1, my - 6);
        ctx.lineTo(mx - 1, my - 7);
        ctx.lineTo(mx + 2.5, my - 10.5);
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = '#f2d36a';
        ctx.stroke();
      }
      arm(ctx, 2.2, -13.4, hx, hy, cloth);
      arm(ctx, -2, -13, -3.8, -9, cloth);
      break;
    }
    case 'pipe': {
      const kick = a > 0.3 && a < 0.5 ? 1.4 : 0;
      inkedLine(ctx, 3.4 - kick, -18.4, 15.5 - kick, -18, 0.9, '#8a6a3a');
      arm(ctx, 2.5, -13, 10 - kick, -17.8, cloth);
      arm(ctx, -0.5, -13, 6 - kick, -18, cloth);
      if (kick) dot(ctx, 17.5, -18, 1.6, 'rgba(160,220,120,0.9)', false);
      break;
    }
    case 'signal': {
      // A pennant on a stick, always fluttering: the 速 runner calls the pace.
      const hx = 5;
      const hy = -11.5;
      inkedLine(ctx, hx, hy + 3, hx + 1.5, hy - 17, 0.9, WOOD);
      const flap = Math.sin(time * 9) * 1.6;
      ctx.beginPath();
      ctx.moveTo(hx + 1.4, hy - 16.5);
      ctx.quadraticCurveTo(hx + 6, hy - 15.5 + flap, hx + 10, hy - 13.5 + flap);
      ctx.lineTo(hx + 1.2, hy - 10.5);
      ctx.closePath();
      ctx.fillStyle = look.trim;
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = INK;
      ctx.stroke();
      arm(ctx, 2.5, -13, hx, hy, cloth);
      arm(ctx, -2, -13, -3.8, -9, cloth);
      break;
    }
    case 'coins':
    case 'gourd':
    case 'mirror': {
      // Held out at rest; raised high when the card pays out, heals or flashes.
      const up = a <= 0 ? 0 : a < 0.3 ? a / 0.3 : lerp(1, 0, (a - 0.3) / 0.7);
      const hx = lerp(6, 4.5, up);
      const hy = lerp(-11, -24, up);
      if (look.gear === 'coins') {
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = INK;
        for (let i = 0; i < 3; i++) dot(ctx, hx + 0.6, hy + 1.6 + i * 2.6, 1.6, '#d9a531');
      } else if (look.gear === 'gourd') {
        dot(ctx, hx + 0.8, hy + 4, 2.6, '#c9a24a');
        dot(ctx, hx + 0.8, hy + 0.6, 1.7, '#c9a24a');
      } else {
        dot(ctx, hx + 1.5, hy - 1, 3.6, '#b08a3a');
        dot(ctx, hx + 1.5, hy - 1, 2.5, '#dceaf2', false);
        if (up > 0.5) {
          ctx.beginPath();
          ctx.moveTo(hx - 1, hy - 6);
          ctx.lineTo(hx + 4, hy + 4);
          ctx.moveTo(hx + 6.5, hy - 3.5);
          ctx.lineTo(hx - 3.5, hy + 1.5);
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = 'rgba(255,255,255,0.95)';
          ctx.stroke();
        }
      }
      arm(ctx, 2.5, -13, hx, hy, cloth);
      arm(ctx, -2, -13, -3.8, -9, cloth);
      break;
    }
    case 'drum': {
      // A waist drum beaten with both sticks in turn, all the time: the 鼓 keeps the beat.
      ctx.save();
      ctx.translate(5.4, -9.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.2, 3.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#b8321f';
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(2.4, 0, 1.2, 3.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f4e8cc';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      const beat = Math.sin(time * 10);
      const s1 = beat > 0 ? beat : 0;
      const s2 = beat < 0 ? -beat : 0;
      for (const [sx, s] of [
        [2.6, s1],
        [-0.8, s2],
      ] as const) {
        const hx = 8.6 - s * 1.2;
        const hy = -12.5 - s * 5;
        arm(ctx, sx, -13, hx, hy, cloth);
        inkedLine(ctx, hx, hy, hx + 1.2 + s, hy + 4.2 - s * 5, 0.6, WOOD);
      }
      break;
    }
  }
}

/** The tip of a soldier's gear for the pose at the strike, in its own (right-facing) coordinates: where shots leave. */
export function gearTip(g: Gear): readonly [number, number] {
  switch (g) {
    case 'staff':
      return [14, -10];
    case 'bow':
      return [12, -12.8];
    case 'fire':
    case 'net':
      return [7, -16];
    case 'ice':
      return [14, -22];
    case 'thunder':
      return [3, -32];
    case 'pipe':
      return [17, -18];
    default:
      return [7, -14];
  }
}

/**
 * One soldier standing at (x, y) facing `face` (1 right, -1 left), in pose `a`, `s` times the normal size.
 * The whole body leans into a strike a little, pivoting on its feet.
 */
export function drawSoldier(ctx: CanvasRenderingContext2D, x: number, y: number, look: Look, dress: Dress, face: number, a: number, time: number, s = 1): void {
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 1, 6.5 * s, 2.2 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = ink(0.24);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * s, s);
  // Reason: each soldier breathes on its own beat (seeded by where it stands), so a squad doesn't bob in lockstep.
  ctx.translate(0, Math.sin(time * 3.2 + x * 0.37 + y * 0.11) * 0.45);
  const lean = a > 0.35 && a < 0.7 ? 0.12 : 0;
  ctx.rotate(lean);
  body(ctx, look, dress);
  head(ctx, look, dress);
  gear(ctx, look, a, time);
  ctx.restore();
}
