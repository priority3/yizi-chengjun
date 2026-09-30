// Procedural cartoon monsters: every enemy is assembled from a body, eyes, mouth, horns/ears and one extra.
// Sprites are cached per radius; a white silhouette copy is used for the hit flash.
import { ENEMIES } from '../config/enemies.ts';
import { COLORS } from './draw.ts';
import { sprites } from './sprites.ts';

type Extra = 'bones' | 'wind' | 'flame' | 'legs' | 'wings' | 'gourd' | 'ring' | 'brows' | 'fins';

interface Look {
  body: string;
  belly?: string;
  shape: 'round' | 'tall' | 'wide';
  horns?: 'small' | 'big' | 'bull' | 'gold';
  ears?: 'pointy' | 'round';
  eyes: 'angry' | 'round' | 'hollow' | 'glow';
  mouth: 'fang' | 'grin' | 'beak' | 'teeth';
  extra?: Extra;
}

const LOOKS: Record<string, Look> = {
  妖: { body: '#5b3a7c', belly: '#8563a8', shape: 'round', horns: 'small', eyes: 'angry', mouth: 'fang' },
  狼: { body: '#676b78', belly: '#a9adb6', shape: 'round', ears: 'pointy', eyes: 'angry', mouth: 'teeth' },
  熊: { body: '#6a4526', belly: '#a0703f', shape: 'wide', ears: 'round', eyes: 'round', mouth: 'grin' },
  蛛: { body: '#2c2338', belly: '#4a3a5c', shape: 'round', eyes: 'glow', mouth: 'fang', extra: 'legs' },
  魔: { body: '#7c1f25', belly: '#a8433f', shape: 'tall', horns: 'big', eyes: 'glow', mouth: 'teeth' },
  白骨精: { body: '#efe9da', belly: '#d9d0bb', shape: 'tall', eyes: 'hollow', mouth: 'teeth', extra: 'bones' },
  黄风怪: { body: '#c8983a', belly: '#e9c86c', shape: 'round', ears: 'pointy', eyes: 'angry', mouth: 'fang', extra: 'wind' },
  金角大王: { body: '#3f6d3a', belly: '#6a9a5a', shape: 'wide', horns: 'gold', eyes: 'angry', mouth: 'grin', extra: 'gourd' },
  红孩儿: { body: '#f2b68c', belly: '#f8d2b2', shape: 'round', eyes: 'round', mouth: 'grin', extra: 'flame' },
  黑熊精: { body: '#2c2420', belly: '#4b3a30', shape: 'wide', ears: 'round', eyes: 'glow', mouth: 'teeth' },
  灵感大王: { body: '#d45c34', belly: '#f2a26a', shape: 'round', eyes: 'round', mouth: 'beak', extra: 'fins' },
  蜘蛛精: { body: '#5c2a60', belly: '#8a4a8e', shape: 'round', horns: 'small', eyes: 'glow', mouth: 'fang', extra: 'legs' },
  牛魔王: { body: '#3b2a22', belly: '#5e4636', shape: 'wide', horns: 'bull', eyes: 'glow', mouth: 'teeth', extra: 'ring' },
  金翅大鹏: { body: '#d9a53a', belly: '#f3d27a', shape: 'round', eyes: 'angry', mouth: 'beak', extra: 'wings' },
  黄眉大王: { body: '#caa66a', belly: '#e8cd96', shape: 'wide', eyes: 'angry', mouth: 'grin', extra: 'brows' },
};

function bodySize(look: Look, r: number): { rx: number; ry: number } {
  if (look.shape === 'tall') return { rx: r * 0.86, ry: r * 1.08 };
  if (look.shape === 'wide') return { rx: r * 1.12, ry: r * 0.9 };
  return { rx: r, ry: r };
}

function inkStroke(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.lineWidth = Math.max(1.4, r * 0.1);
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
}

function paintBehind(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, r: number): void {
  ctx.lineCap = 'round';
  if (look.extra === 'legs') {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const a = -0.6 + i * 0.4;
        ctx.beginPath();
        ctx.moveTo(x + s * r * 0.5, y + a * r * 0.6);
        ctx.quadraticCurveTo(x + s * r * 1.3, y + a * r - r * 0.5, x + s * r * 1.45, y + a * r + r * 0.5);
        ctx.lineWidth = r * 0.13;
        ctx.strokeStyle = COLORS.ink;
        ctx.stroke();
      }
    }
  }
  if (look.extra === 'wings') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.6, y - r * 0.2);
      ctx.quadraticCurveTo(x + s * r * 1.7, y - r * 1.1, x + s * r * 1.6, y + r * 0.4);
      ctx.lineTo(x + s * r * 1.25, y + r * 0.1);
      ctx.lineTo(x + s * r * 1.2, y + r * 0.55);
      ctx.lineTo(x + s * r * 0.7, y + r * 0.3);
      ctx.closePath();
      ctx.fillStyle = '#e8b74a';
      ctx.fill();
      inkStroke(ctx, r);
    }
  }
  if (look.extra === 'wind') {
    ctx.strokeStyle = 'rgba(200,160,70,0.65)';
    ctx.lineWidth = r * 0.12;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x, y + r * 0.1, r * (1.2 + i * 0.18), Math.PI * (0.15 + i * 0.5), Math.PI * (0.85 + i * 0.5));
      ctx.stroke();
    }
  }
  if (look.extra === 'fins') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.8, y);
      ctx.quadraticCurveTo(x + s * r * 1.6, y - r * 0.4, x + s * r * 1.45, y + r * 0.5);
      ctx.closePath();
      ctx.fillStyle = '#f08a4a';
      ctx.fill();
      inkStroke(ctx, r);
    }
  }
  if (look.ears === 'pointy') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.25, y - r * 0.8);
      ctx.lineTo(x + s * r * 0.75, y - r * 1.3);
      ctx.lineTo(x + s * r * 0.85, y - r * 0.45);
      ctx.closePath();
      ctx.fillStyle = look.body;
      ctx.fill();
      inkStroke(ctx, r);
    }
  }
  if (look.ears === 'round') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + s * r * 0.72, y - r * 0.72, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = look.body;
      ctx.fill();
      inkStroke(ctx, r);
    }
  }
}

function paintHorns(ctx: CanvasRenderingContext2D, look: Look, x: number, r: number, top: number): void {
  if (!look.horns) return;
  const color = look.horns === 'gold' ? '#f0c24a' : look.horns === 'bull' ? '#efe3c6' : '#e9dcc0';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (look.horns === 'bull') {
      ctx.moveTo(x + s * r * 0.5, top + r * 0.25);
      ctx.quadraticCurveTo(x + s * r * 1.5, top + r * 0.1, x + s * r * 1.35, top - r * 0.7);
      ctx.quadraticCurveTo(x + s * r * 1.1, top - r * 0.05, x + s * r * 0.35, top + r * 0.45);
    } else {
      const h = look.horns === 'big' ? r * 0.85 : r * 0.45;
      ctx.moveTo(x + s * r * 0.2, top + r * 0.2);
      ctx.quadraticCurveTo(x + s * r * 0.35, top - h * 0.6, x + s * r * 0.55, top - h);
      ctx.lineTo(x + s * r * 0.55, top + r * 0.25);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    inkStroke(ctx, r * 0.8);
  }
}

function paintFace(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, r: number): void {
  const ey = y - r * 0.18;
  const gap = r * 0.36;
  for (const s of [-1, 1]) {
    const ex = x + s * gap;
    ctx.beginPath();
    if (look.eyes === 'hollow') {
      ctx.ellipse(ex, ey, r * 0.2, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1b120c';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex, ey + r * 0.03, r * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3a2a';
      ctx.fill();
      continue;
    }
    const er = look.eyes === 'round' ? r * 0.22 : r * 0.19;
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = look.eyes === 'glow' ? '#ffe45a' : '#ffffff';
    ctx.fill();
    inkStroke(ctx, r * 0.6);
    ctx.beginPath();
    ctx.arc(ex + s * er * 0.1, ey + er * 0.15, er * (look.eyes === 'glow' ? 0.35 : 0.55), 0, Math.PI * 2);
    ctx.fillStyle = look.eyes === 'glow' ? '#c8321a' : '#1b120c';
    ctx.fill();
    if (look.eyes === 'angry') {
      // Slanted brow: inner end low, outer end high.
      ctx.beginPath();
      ctx.moveTo(ex - s * er * 1.1, ey - er * 0.8);
      ctx.lineTo(ex + s * er * 1.2, ey - er * 1.5);
      ctx.lineWidth = r * 0.12;
      ctx.strokeStyle = COLORS.ink;
      ctx.stroke();
    }
  }
  const my = y + r * 0.36;
  ctx.beginPath();
  if (look.mouth === 'beak') {
    ctx.moveTo(x - r * 0.24, my - r * 0.1);
    ctx.lineTo(x + r * 0.24, my - r * 0.1);
    ctx.lineTo(x, my + r * 0.26);
    ctx.closePath();
    ctx.fillStyle = '#f59a2a';
    ctx.fill();
    inkStroke(ctx, r * 0.7);
    return;
  }
  const mw = look.mouth === 'grin' ? r * 0.5 : r * 0.36;
  ctx.moveTo(x - mw, my - r * 0.06);
  ctx.quadraticCurveTo(x, my + r * 0.34, x + mw, my - r * 0.06);
  ctx.closePath();
  ctx.fillStyle = '#3a0e10';
  ctx.fill();
  inkStroke(ctx, r * 0.6);
  ctx.fillStyle = '#fffaf0';
  if (look.mouth === 'fang') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * mw * 0.35, my - r * 0.04);
      ctx.lineTo(x + s * mw * 0.55, my + r * 0.16);
      ctx.lineTo(x + s * mw * 0.72, my - r * 0.04);
      ctx.fill();
    }
  } else {
    const n = look.mouth === 'grin' ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const tx = x - mw * 0.8 + (i + 0.5) * ((mw * 1.6) / n);
      ctx.beginPath();
      ctx.moveTo(tx - r * 0.06, my - r * 0.03);
      ctx.lineTo(tx, my + r * 0.1);
      ctx.lineTo(tx + r * 0.06, my - r * 0.03);
      ctx.fill();
    }
  }
}

function paintFront(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, r: number, top: number): void {
  switch (look.extra) {
    case 'bones':
      ctx.strokeStyle = 'rgba(90,70,50,0.55)';
      ctx.lineWidth = r * 0.07;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x, y + r * 0.62 + i * r * 0.16, r * (0.45 - i * 0.06), Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      break;
    case 'flame':
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * r * 0.22 - r * 0.16, top + r * 0.2);
        ctx.quadraticCurveTo(x + i * r * 0.3, top - r * (0.55 + (2 - Math.abs(i)) * 0.2), x + i * r * 0.22 + r * 0.16, top + r * 0.2);
        ctx.fillStyle = i % 2 === 0 ? '#ff6a1a' : '#ffc02a';
        ctx.fill();
      }
      break;
    case 'gourd': {
      const gx = x + r * 0.95;
      const gy = y + r * 0.45;
      ctx.beginPath();
      ctx.arc(gx, gy + r * 0.12, r * 0.28, 0, Math.PI * 2);
      ctx.arc(gx, gy - r * 0.22, r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = '#b8322a';
      ctx.fill();
      inkStroke(ctx, r * 0.6);
      break;
    }
    case 'ring':
      ctx.beginPath();
      ctx.arc(x, y + r * 0.2, r * 0.2, 0, Math.PI * 2);
      ctx.lineWidth = r * 0.1;
      ctx.strokeStyle = '#f0c24a';
      ctx.stroke();
      break;
    case 'brows':
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + s * r * 0.1, y - r * 0.5);
        ctx.quadraticCurveTo(x + s * r * 0.6, y - r * 0.85, x + s * r * 1.05, y - r * 0.35);
        ctx.lineWidth = r * 0.2;
        ctx.strokeStyle = '#f2d23a';
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      break;
    default:
      break;
  }
}

function paintMonster(ctx: CanvasRenderingContext2D, def: string, x: number, y: number, r: number): void {
  const look = LOOKS[def] ?? LOOKS['妖'];
  const { rx, ry } = bodySize(look, r);
  ctx.save();
  ctx.lineJoin = 'round';
  paintBehind(ctx, look, x, y, r);
  const top = y - ry;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = look.body;
  ctx.fill();
  inkStroke(ctx, r);
  if (look.belly) {
    ctx.beginPath();
    ctx.ellipse(x, y + ry * 0.42, rx * 0.62, ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = look.belly;
    ctx.fill();
  }
  // A soft highlight gives the body some volume.
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.35, y - ry * 0.45, rx * 0.28, ry * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();
  paintHorns(ctx, look, x, r, top);
  paintFace(ctx, look, x, y, r);
  paintFront(ctx, look, x, y, r, top);
  ctx.restore();
}

/** Sprite box: wide enough for wings and legs. */
export function monsterBox(r: number): number {
  return Math.ceil(r * 3.4);
}

export function monsterSprite(def: string): { img: HTMLCanvasElement; flash: HTMLCanvasElement; box: number } {
  const r = ENEMIES[def].radius;
  const box = monsterBox(r);
  const img = sprites.get(`mon:${def}`, box, box, (ctx) => paintMonster(ctx, def, box / 2, box / 2 + r * 0.15, r));
  // Reason: a white silhouette of the same sprite makes the hit flash follow the exact outline.
  const flash = sprites.get(`mon:${def}:flash`, box, box, (ctx) => {
    ctx.drawImage(img, 0, 0, box, box);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, box, box);
  });
  return { img, flash, box };
}
