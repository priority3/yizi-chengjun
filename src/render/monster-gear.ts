// What the masked monsters carry (monster-figure.ts draws the rest of them): the front arm and hand, and a club,
// claws, a spear, a fire-tipped spear, a trident, a gourd, a bone staff, a copper hammer, an iron staff, a cymbal or a
// sack of loot. Drawn in figure units like the body: feet at the origin, facing right.
import { CINNABAR, INK } from './ink.ts';
import { blob, GOLD, line, outline, SKIN } from './monster-figure.ts';

export type Gear = 'club' | 'claws' | 'spear' | 'trident' | 'gourd' | 'boneStaff' | 'fireSpear' | 'hammer' | 'ironStaff' | 'cymbal' | 'sack' | 'hand';

const WOOD = '#7a5a3a';

/** The hands and what they hold, in front of the body. */
export function paintGear(ctx: CanvasRenderingContext2D, gear: Gear, cloth: string): void {
  const arm = (hx: number, hy: number, sx = 2.6): void => {
    line(ctx, sx, -13.5, hx, hy, 1.8, cloth);
    blob(ctx, hx, hy, 1.3, SKIN, 0);
  };
  switch (gear) {
    case 'club':
      line(ctx, 4, -12, 9.5, -20, 1.6, WOOD);
      blob(ctx, 9.8, -21, 1.9, WOOD, 0.9);
      arm(5.5, -12);
      break;
    case 'claws':
      arm(7.5, -10.5, 3);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(7.5, -10.5);
        ctx.lineTo(10, -12.2 + i * 1.7);
      }
      outline(ctx, 0.9);
      break;
    // Reason: the long weapons stand well forward of the head (whose edge is at x ~8), so they never cover the mask.
    case 'spear':
    case 'fireSpear':
      line(ctx, 9.2, -1, 10.4, -35, 1, WOOD);
      if (gear === 'fireSpear') {
        ctx.beginPath();
        ctx.moveTo(10.4, -34);
        ctx.bezierCurveTo(6.8, -36, 8.3, -41, 10.6, -44);
        ctx.bezierCurveTo(11.8, -40, 14.2, -38, 11.2, -34);
        ctx.closePath();
        ctx.fillStyle = '#e2582f';
        ctx.fill();
        outline(ctx, 0.8);
      } else {
        ctx.beginPath();
        ctx.moveTo(10.5, -41);
        ctx.lineTo(12.1, -35);
        ctx.lineTo(8.9, -35);
        ctx.closePath();
        ctx.fillStyle = '#c9d0d4';
        ctx.fill();
        outline(ctx, 0.8);
        blob(ctx, 10.2, -33.6, 1.5, CINNABAR, 0.6);
      }
      arm(9.6, -13);
      break;
    case 'trident':
      line(ctx, 9.2, -1, 10.4, -33, 0.9, WOOD);
      ctx.beginPath();
      ctx.moveTo(7.2, -38);
      ctx.lineTo(7.4, -33);
      ctx.lineTo(13.4, -33.6);
      ctx.lineTo(13.4, -38.6);
      ctx.moveTo(10.4, -33.4);
      ctx.lineTo(10.5, -39.4);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#c9d0d4';
      ctx.stroke();
      arm(9.6, -13);
      break;
    case 'gourd':
      ctx.save();
      ctx.translate(-7, -8);
      blob(ctx, 0, 1.8, 3, CINNABAR, 1);
      blob(ctx, 0, -2.2, 2, CINNABAR, 1);
      ctx.fillStyle = GOLD;
      ctx.fillRect(-2, -0.6, 4, 1);
      ctx.restore();
      arm(6, -9.5, 3);
      break;
    case 'boneStaff':
      line(ctx, 8.6, -1, 9.6, -31, 1.3, '#efe6d2');
      for (const y of [-31, -1]) {
        blob(ctx, 8.2, y, 1.6, '#efe6d2', 0.8);
        blob(ctx, 11, y, 1.6, '#efe6d2', 0.8);
      }
      arm(9, -13);
      break;
    case 'hammer':
      line(ctx, 8.6, -9, 11, -24, 1, WOOD);
      blob(ctx, 11.6, -27.4, 3.6, '#c9822a', 1.1);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI;
        ctx.moveTo(11.6 + Math.cos(a) * 3.6, -27.4 + Math.sin(a) * 3.6);
        ctx.lineTo(11.6 - Math.cos(a) * 3.6, -27.4 - Math.sin(a) * 3.6);
      }
      outline(ctx, 0.6);
      arm(9, -12.5);
      break;
    case 'ironStaff':
      line(ctx, 9, 1, 11.4, -34, 1.5, '#3a3a40');
      for (const t of [0.15, 0.85]) {
        const x = 9 + 2.4 * t;
        const y = 1 - 35 * t;
        line(ctx, x - 1.2, y + 0.2, x + 1.2, y - 0.2, 1.4, GOLD);
      }
      arm(9.6, -13);
      break;
    case 'cymbal':
      // A golden cymbal held up in front.
      ctx.beginPath();
      ctx.ellipse(10, -16, 2.2, 5.2, 0.25, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
      outline(ctx, 1);
      blob(ctx, 10, -16, 1, '#b07a1a', 0);
      arm(9, -15);
      break;
    case 'sack':
      ctx.beginPath();
      ctx.ellipse(-6.6, -15.4, 5, 4.4, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#b8945e';
      ctx.fill();
      outline(ctx, 1);
      ctx.fillStyle = GOLD;
      ctx.fillRect(-8.4, -16.4, 2.4, 2.4);
      arm(-2.6, -18, 1.4);
      break;
    case 'hand':
      arm(6, -9.5, 3);
      break;
  }
}
