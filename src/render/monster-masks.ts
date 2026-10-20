// The opera-mask faces (脸谱) of the monsters (脸谱小鬼): every monster's head is a plain disc in its face colour,
// and these paint the pattern over it — eyes, brows, the marks of its kind, its mouth. Each draws around a head centred
// at the origin with radius `hr`, facing right (+x is forward); the renderer mirrors the whole figure for a monster
// walking left. Bosses wear gold, silver-white or black faces, the colours the opera gives spirits and demons.
import { CINNABAR, ink, INK } from './ink.ts';

export type MaskKind =
  | 'imp'
  | 'wolf'
  | 'bear'
  | 'spider'
  | 'bat'
  | 'chick'
  | 'elite'
  | 'thief'
  | 'skull'
  | 'wind'
  | 'gold'
  | 'child'
  | 'blackBear'
  | 'fish'
  | 'web'
  | 'bull'
  | 'roc'
  | 'brows';

const WHITE = '#fff6e0';
const GOLD = '#e2b13c';
const MOUTH = '#2a1010';

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, fill: string, outline = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

function curve(ctx: CanvasRenderingContext2D, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, color = INK): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Two eyes: white almonds tilted by `tilt` with ink pupils (or `pupil`), a little forward of the face's middle. */
function eyes(ctx: CanvasRenderingContext2D, rx: number, ry: number, tilt: number, pupil = INK, outline = 0): void {
  for (const q of [-1, 1]) {
    oval(ctx, q * 2.9, -0.4, rx, ry, q * tilt, WHITE, outline);
    dot(ctx, q * 2.9 + 0.5, -0.3, Math.min(rx, ry) * 0.55, pupil);
  }
}

/** Angry brows sweeping up and out from above the nose. */
function brows(ctx: CanvasRenderingContext2D, w: number, lift = 0): void {
  for (const q of [-1, 1]) curve(ctx, q * 0.8, -2.4 - lift, q * 3.5, -5.4 - lift, q * 6, -2.8 - lift, w);
}

/** A dark open mouth with two white fangs. */
function fangs(ctx: CanvasRenderingContext2D, y: number, w = 2.6): void {
  oval(ctx, 0.4, y, w, 1.5, 0, MOUTH);
  ctx.fillStyle = WHITE;
  ctx.fillRect(-1.4, y - 1.2, 0.9, 1.3);
  ctx.fillRect(1.1, y - 1.2, 0.9, 1.3);
}

function cheeks(ctx: CanvasRenderingContext2D, color = 'rgba(214,60,50,0.55)'): void {
  for (const q of [-1, 1]) oval(ctx, q * 4.6, 2, 1.4, 0.9, 0, color);
}

/** A small flame mark on the forehead. */
function flameMark(ctx: CanvasRenderingContext2D, y: number, color = CINNABAR): void {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.quadraticCurveTo(-1.3, y - 2.1, 0, y - 3.4);
  ctx.quadraticCurveTo(1.3, y - 2.1, 0, y);
  ctx.fillStyle = color;
  ctx.fill();
}

export function paintMask(ctx: CanvasRenderingContext2D, kind: MaskKind, hr: number): void {
  ctx.save();
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'imp':
      eyes(ctx, 2.6, 1.7, 0.45);
      brows(ctx, 1.5);
      flameMark(ctx, -3.4);
      fangs(ctx, 3.6);
      cheeks(ctx);
      break;
    case 'wolf': {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, hr, 0, Math.PI * 2);
      ctx.clip();
      oval(ctx, 1.6, 3.8, 6, 4, 0, '#eef0f2');
      ctx.restore();
      for (const dx of [-2, 0, 2]) curve(ctx, dx, -6.8, dx * 0.8, -5.5, dx * 0.6, -4.2, 1.1);
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(q * 1.2, -1);
        ctx.lineTo(q * 4.6, -2.4);
        ctx.lineTo(q * 4, -0.2);
        ctx.closePath();
        ctx.fillStyle = WHITE;
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = CINNABAR;
        ctx.stroke();
        dot(ctx, q * 3.2, -1.1, 0.8, INK);
      }
      dot(ctx, 4.6, 2.2, 1.1, INK);
      curve(ctx, -1, 4.8, 2, 4.9, 4.6, 4.2, 0.9);
      break;
    }
    case 'bear':
    case 'blackBear': {
      const black = kind === 'blackBear';
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(q * 2.8, -1.2, 2.4, Math.PI * 1.1, Math.PI * 1.9);
        ctx.lineWidth = black ? 1.8 : 1.4;
        ctx.strokeStyle = '#f4ecd8';
        ctx.stroke();
        oval(ctx, q * 2.8, 0, 1.2, black ? 0.8 : 1.1, 0, '#f2c14e');
        if (black) oval(ctx, q * 2.8 + 0.2, 0, 0.35, 0.8, 0, INK);
      }
      oval(ctx, 0.6, 3.2, 3.4, 2.4, 0, black ? '#e8e0cc' : '#8a6a4a');
      dot(ctx, 0.8, 2.3, 1.05, INK);
      if (black) fangs(ctx, 4.4, 2);
      break;
    }
    case 'spider':
      for (const [x, y, r] of [
        [-2.4, -0.8, 1.3],
        [2.4, -0.8, 1.3],
        [-1, -2.6, 0.8],
        [1.4, -2.6, 0.8],
      ] as const)
        dot(ctx, x, y, r, '#ff5a3a');
      ctx.fillStyle = WHITE;
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(q * 1.6, 2);
        ctx.lineTo(q * 1, 4.2);
        ctx.lineTo(q * 0.4, 2);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case 'bat':
      oval(ctx, 0, -0.6, 6.2, 2.4, 0, '#1e1428');
      for (const q of [-1, 1]) dot(ctx, q * 2.6, -0.6, 1.1, '#f2c14e');
      ctx.fillStyle = WHITE;
      ctx.fillRect(-1.4, 2.4, 0.9, 1.4);
      ctx.fillRect(0.5, 2.4, 0.9, 1.4);
      break;
    case 'chick':
      for (const q of [-1, 1]) {
        oval(ctx, q * 2.6, -0.8, 1.9, 2.1, 0, WHITE, 0.8);
        dot(ctx, q * 2.6 + 0.6, -0.6, 1, INK);
      }
      ctx.beginPath();
      ctx.moveTo(2.2, 1.4);
      ctx.lineTo(8.4, 2.6);
      ctx.lineTo(2.2, 4.4);
      ctx.closePath();
      ctx.fillStyle = '#e2722a';
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = INK;
      ctx.stroke();
      cheeks(ctx, 'rgba(240,120,80,0.5)');
      break;
    case 'elite': {
      // Lightning brows in black, a gold mark on the forehead, white eyes and a fanged scowl.
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(q * 0.6, -2.2);
        ctx.lineTo(q * 2.6, -4.6);
        ctx.lineTo(q * 3.6, -3);
        ctx.lineTo(q * 6.2, -5.6);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      eyes(ctx, 2.4, 1.6, 0.35, INK, 0.8);
      dot(ctx, 0, -4.6, 1, GOLD);
      fangs(ctx, 3.8, 2.8);
      for (const q of [-1, 1]) curve(ctx, q * 3.6, 2.6, q * 5, 4.6, q * 4.4, 6.4, 1.1);
      break;
    }
    case 'thief':
      oval(ctx, 0.4, -0.8, 6.8, 2.4, 0, '#161210');
      for (const q of [-1, 1]) {
        oval(ctx, q * 2.7, -0.8, 1.5, 1, 0, WHITE);
        dot(ctx, q * 2.7 + 0.5, -0.8, 0.6, INK);
      }
      curve(ctx, -2, 3.2, 0.6, 5, 3.4, 3, 1.1);
      ctx.fillStyle = GOLD;
      ctx.fillRect(0.6, 3.6, 1.1, 1.1);
      break;
    case 'skull':
      // 白骨精: hollow black sockets with red sparks, a thin nose, red lips, cheekbones in fine ink.
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(q * 1, -2.6);
        ctx.quadraticCurveTo(q * 5, -3.6, q * 4.6, 0.4);
        ctx.quadraticCurveTo(q * 2.4, 1.2, q * 1, -2.6);
        ctx.fillStyle = '#1a1414';
        ctx.fill();
        dot(ctx, q * 3 + 0.4, -1, 0.75, '#ff4a3a');
        curve(ctx, q * 4.4, 1.8, q * 5.6, 3, q * 4.6, 4.6, 0.7, ink(0.6));
      }
      curve(ctx, 0.4, 0.6, 1.2, 1.8, 0.6, 2.6, 0.8);
      oval(ctx, 0.5, 4.4, 1.8, 0.9, 0, '#c8322a');
      break;
    case 'wind':
      // 黄风怪: wind spirals on the cheeks, a pink nose, beady eyes and whiskers.
      for (const q of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const a = (i / 12) * Math.PI * 2.2;
          const rr = 0.4 + (i / 12) * 2.4;
          const x = q * 4 + Math.cos(a) * rr * q;
          const y = 2.2 + Math.sin(a) * rr * 0.8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = '#7a4a1a';
        ctx.stroke();
        oval(ctx, q * 2.6, -1, 1.5, 1.2, 0, WHITE, 0.6);
        dot(ctx, q * 2.6 + 0.5, -0.9, 0.7, INK);
      }
      brows(ctx, 1.2, 0.4);
      dot(ctx, 1.6, 1.8, 1, '#e07a8a');
      for (const dy of [-0.6, 0.8]) curve(ctx, 3, 2.4 + dy, 6, 2 + dy * 1.6, 8, 2.8 + dy * 2, 0.6);
      break;
    case 'gold': {
      // 金角大王: a gold face split by a cinnabar stripe, framed eyes and swirling brows, a dark beard.
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(-1.1, -2);
      ctx.lineTo(0, 1);
      ctx.lineTo(1.1, -2);
      ctx.closePath();
      ctx.fillStyle = CINNABAR;
      ctx.fill();
      for (const q of [-1, 1]) {
        oval(ctx, q * 3.1, -0.2, 2.6, 1.9, q * 0.35, WHITE, 1.2);
        dot(ctx, q * 3.1, 0, 0.9, INK);
        ctx.beginPath();
        ctx.moveTo(q * 0.8, -3);
        ctx.bezierCurveTo(q * 3, -6.2, q * 6.2, -5.4, q * 6.6, -2.2);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-3.4, 3);
      ctx.quadraticCurveTo(0, 6.4, 3.4, 3);
      ctx.closePath();
      ctx.fillStyle = MOUTH;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-3.4, 5.4);
      ctx.quadraticCurveTo(0, 11.5, 3.4, 5.4);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
      break;
    }
    case 'child':
      // 红孩儿: big round eyes under frowning brows, red cheeks, a flame on the forehead and a cheeky grin.
      for (const q of [-1, 1]) {
        oval(ctx, q * 2.8, -0.2, 2, 2.2, 0, WHITE, 0.8);
        dot(ctx, q * 2.8 + 0.7, 0, 1.1, INK);
        dot(ctx, q * 2.8 + 1.1, -0.5, 0.35, WHITE);
      }
      brows(ctx, 1.3, 0.6);
      flameMark(ctx, -4);
      cheeks(ctx, 'rgba(230,70,60,0.7)');
      curve(ctx, -2.2, 3.6, 0.4, 5.6, 3, 3.4, 1.1);
      break;
    case 'fish':
      // 灵感大王: orange scales over the brow, round gold eyes, long curling whiskers.
      for (let row = 0; row < 2; row++) {
        for (let i = -2; i <= 2; i++) {
          if (row === 1 && i === 2) continue;
          ctx.beginPath();
          ctx.arc(i * 2.2 + row * 1.1, -5.4 + row * 1.8, 1.2, 0, Math.PI);
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = '#f08a3a';
          ctx.stroke();
        }
      }
      for (const q of [-1, 1]) {
        oval(ctx, q * 2.9, -0.4, 2, 2, 0, '#f2c14e', 0.9);
        dot(ctx, q * 2.9 + 0.5, -0.3, 1, INK);
      }
      for (const q of [-1, 1]) curve(ctx, q * 1.6, 2.8, q * 6, 3.4, q * 7.4, 7, 0.8);
      oval(ctx, 0.6, 3.4, 1.6, 0.8, 0, MOUTH);
      break;
    case 'web':
      // 蜘蛛精: a web spun from between the eyes, slanted made-up eyes, red lips.
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = ink(0.75);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        ctx.moveTo(0, -1.6);
        ctx.lineTo(Math.cos(a) * hr * 0.95, -1.6 + Math.sin(a) * hr * 0.95);
      }
      ctx.stroke();
      for (const k of [2.6, 4.8]) {
        ctx.beginPath();
        ctx.arc(0, -1.6, k, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const q of [-1, 1]) {
        oval(ctx, q * 2.9, -0.2, 2.3, 1.2, q * 0.4, WHITE);
        curve(ctx, q * 0.8, 0.2, q * 3, -1.6, q * 5.4, -1.2, 1.1);
        dot(ctx, q * 2.9 + 0.4, -0.1, 0.75, '#7a1a5a');
      }
      oval(ctx, 0.5, 4, 1.7, 0.9, 0, '#c8322a');
      break;
    case 'bull': {
      // 牛魔王: a white band down the middle widening to the muzzle, a gold nose ring, red eyes under fierce brows.
      ctx.beginPath();
      ctx.moveTo(-1.2, -6.4);
      ctx.lineTo(1.2, -6.4);
      ctx.lineTo(2.2, 1);
      ctx.quadraticCurveTo(4.6, 5.6, 0, 6.6);
      ctx.quadraticCurveTo(-4.6, 5.6, -2.2, 1);
      ctx.closePath();
      ctx.fillStyle = '#efe6d2';
      ctx.fill();
      for (const q of [-1, 1]) {
        oval(ctx, q * 3.6, -1, 1.9, 1.3, q * 0.3, WHITE, 0.8);
        dot(ctx, q * 3.6 + 0.4, -0.9, 0.8, '#d02a1a');
        dot(ctx, q * 1.2, 4.4, 0.6, INK);
      }
      brows(ctx, 1.7, 0.8);
      ctx.beginPath();
      ctx.arc(0, 5.6, 1.8, 0.1, Math.PI - 0.1);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = GOLD;
      ctx.stroke();
      break;
    }
    case 'roc':
      // 金翅大鹏: feather marks on the cheeks, fierce red-pupilled eyes and a hooked beak.
      for (const q of [-1, 1]) {
        for (let i = 0; i < 3; i++) curve(ctx, q * (3 + i * 1.2), 2 + i * 0.8, q * (4.4 + i), 3.4 + i, q * (3.6 + i * 1.2), 4.4 + i * 0.6, 0.7, '#a8641a');
        oval(ctx, q * 2.8, -0.8, 2, 1.4, q * 0.4, WHITE, 0.9);
        dot(ctx, q * 2.8 + 0.6, -0.8, 0.8, '#c8221a');
      }
      brows(ctx, 1.4, 0.8);
      ctx.beginPath();
      ctx.moveTo(1.4, 0.8);
      ctx.quadraticCurveTo(7.8, 0.6, 8.4, 3.4);
      ctx.quadraticCurveTo(6.6, 2.8, 5.6, 4.4);
      ctx.quadraticCurveTo(3, 4.2, 1.4, 3);
      ctx.closePath();
      ctx.fillStyle = '#d9822a';
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = INK;
      ctx.stroke();
      break;
    case 'brows':
      // 黄眉大王: two long yellow brows drooping past the cheeks, small sly eyes, a smug smile.
      for (const q of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(q * 0.8, -2.8);
        ctx.bezierCurveTo(q * 4, -5, q * 7.4, -3, q * 7.6, 3.6);
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#ffd23a';
        ctx.stroke();
        curve(ctx, q * 1.6, -0.4, q * 2.8, -1.4, q * 4, -0.4, 1.1);
      }
      curve(ctx, -2.2, 3.4, 0.4, 5.2, 3, 3.4, 1.1);
      cheeks(ctx, 'rgba(230,140,90,0.5)');
      break;
  }
  ctx.restore();
}
