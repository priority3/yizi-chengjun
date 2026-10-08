// 法宝 tokens and the 灵石 icon, drawn by code like everything else.
import { TREASURES, type Rarity, type TreasureId } from '../config/treasures.ts';
import { drawStar, outlined } from './draw.ts';
import { brush } from './fonts.ts';

export const RARITY_STYLE: Record<Rarity, { inner: string; outer: string; edge: string; glow: string }> = {
  common: { inner: '#dcefd4', outer: '#5f9e63', edge: '#2f5c33', glow: 'rgba(0,0,0,0)' },
  rare: { inner: '#dcebff', outer: '#4f86d8', edge: '#214a8a', glow: 'rgba(110,160,255,0.75)' },
  epic: { inner: '#fff0c8', outer: '#e08a2a', edge: '#7a3a08', glow: 'rgba(255,170,60,0.95)' },
};

/** A round medallion with the treasure's two-character name and one star per tier. */
export function drawTreasureToken(ctx: CanvasRenderingContext2D, id: TreasureId, tier: number, x: number, y: number, r: number, dim = false): void {
  const def = TREASURES[id];
  const st = RARITY_STYLE[def.rarity];
  ctx.save();
  if (dim) ctx.globalAlpha = 0.4;
  if (!dim && def.rarity !== 'common') {
    ctx.shadowColor = st.glow;
    ctx.shadowBlur = r * 0.55;
  }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.15, x, y, r);
  g.addColorStop(0, st.inner);
  g.addColorStop(1, st.outer);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = dim ? '#8a8078' : g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.strokeStyle = dim ? '#4a4440' : st.edge;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.stroke();
  outlined(ctx, def.short, x, y - r * 0.04, brush(Math.round(r * 0.74)), '#fff8e8', dim ? '#2a2a2a' : st.edge, Math.max(2, r * 0.12));
  for (let i = 0; i < tier; i++) drawStar(ctx, x + (i - (tier - 1) / 2) * r * 0.4, y + r * 0.62, r * 0.17, '#ffe27a');
  ctx.restore();
}

/** 灵石: a hexagonal jade gem. */
export function drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, '#c0f4dc');
  g.addColorStop(0.5, '#3fbf8f');
  g.addColorStop(1, '#1b7a5a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.strokeStyle = '#0f4a36';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.45, y - r * 0.05);
  ctx.lineTo(x - r * 0.1, y - r * 0.62);
  ctx.lineTo(x + r * 0.18, y - r * 0.3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.restore();
}
