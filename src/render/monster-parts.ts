// Body parts for the procedural monsters in monsters-art.ts: the shared ink outline, and the parts only the flyers
// wear (the bat's ears, wings and tiny fangs; the chick's stubby wings, crown tuft and big beak). Every part is drawn
// around a body centred at (x, y) and scales with the monster's radius `r`.
import { COLORS } from './draw.ts';

/** The ink outline every monster part gets, a little thicker on bigger monsters. */
export function inkStroke(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.lineWidth = Math.max(1.4, r * 0.1);
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
}

/** Big upright bat ears with a pink inside, much taller than 'pointy' ones; their bases hide behind a 'small' body. */
export function paintBatEars(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.1, y - r * 0.62);
    ctx.lineTo(x + s * r * 0.62, y - r * 1.6);
    ctx.lineTo(x + s * r * 0.74, y - r * 0.32);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    inkStroke(ctx, r);
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.26, y - r * 0.71);
    ctx.lineTo(x + s * r * 0.57, y - r * 1.3);
    ctx.lineTo(x + s * r * 0.64, y - r * 0.53);
    ctx.closePath();
    ctx.fillStyle = '#c47596';
    ctx.fill();
  }
}

/**
 * Leathery bat wings spread out from the shoulders: a leading edge up to the wing tip, then a trailing edge of
 * scallops between the finger tips, with the finger bones showing through the membrane.
 */
export function paintBatWings(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  // The shoulder and the finger tips, in radii from the body centre (right wing; the left one is mirrored).
  const shoulder = [0.55, -0.3];
  const fingers = [
    [1.52, 0.3],
    [1.1, 0.48],
  ];
  for (const s of [-1, 1]) {
    const px = (k: number) => x + s * r * k;
    const py = (k: number) => y + r * k;
    ctx.beginPath();
    ctx.moveTo(px(shoulder[0]), py(shoulder[1]));
    // Reason: the tip stays inside the sprite box (1.7 radii) with its ink outline.
    ctx.quadraticCurveTo(px(1.05), py(-1.15), px(1.62), py(-0.95));
    // Reason: each control point is pulled towards the body, so the edge between two finger tips curves inwards.
    ctx.quadraticCurveTo(px(1.32), py(-0.25), px(fingers[0][0]), py(fingers[0][1]));
    ctx.quadraticCurveTo(px(1.26), py(0.08), px(fingers[1][0]), py(fingers[1][1]));
    ctx.quadraticCurveTo(px(0.92), py(0.16), px(0.7), py(0.35));
    ctx.closePath();
    ctx.fillStyle = '#2b1a3b';
    ctx.fill();
    inkStroke(ctx, r);
    // Finger bones through the membrane, stopping just short of the edge.
    ctx.beginPath();
    for (const [fx, fy] of fingers) {
      ctx.moveTo(px(shoulder[0]), py(shoulder[1]));
      ctx.lineTo(px(shoulder[0] + (fx - shoulder[0]) * 0.9), py(shoulder[1] + (fy - shoulder[1]) * 0.9));
    }
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.strokeStyle = '#7d5b98';
    ctx.stroke();
  }
}

/** A chick's stubby wings, sticking out low on its sides with a feather notch each (drawn over the body). */
export function paintStubWings(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.64, y + r * 0.15);
    ctx.quadraticCurveTo(x + s * r * 1.4, y + r * 0.2, x + s * r * 1.24, y + r * 0.8);
    ctx.quadraticCurveTo(x + s * r * 0.92, y + r * 0.74, x + s * r * 0.68, y + r * 0.6);
    ctx.closePath();
    ctx.fillStyle = '#d39a26';
    ctx.fill();
    inkStroke(ctx, r * 0.8);
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.88, y + r * 0.38);
    ctx.lineTo(x + s * r * 1.1, y + r * 0.6);
    ctx.lineWidth = Math.max(0.8, r * 0.06);
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
  }
}

/** A tuft of three little leaf-shaped feathers fanning out of the crown, `top` being the top of the head. */
export function paintChickTuft(ctx: CanvasRenderingContext2D, x: number, r: number, top: number): void {
  // [tilt from upright (radians), length in radii] per feather.
  for (const [a, len] of [
    [-0.55, 0.5],
    [0, 0.62],
    [0.55, 0.5],
  ]) {
    const bx = x + Math.sin(a) * r * 0.15;
    const by = top + r * 0.2;
    const tx = bx + Math.sin(a) * len * r;
    const ty = by - Math.cos(a) * len * r;
    // The leaf bulges by `w` to either side of its axis, halfway up.
    const w = r * 0.15;
    const mx = (bx + tx) / 2;
    const my = (by + ty) / 2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(mx + Math.cos(a) * w, my + Math.sin(a) * w, tx, ty);
    ctx.quadraticCurveTo(mx - Math.cos(a) * w, my - Math.sin(a) * w, bx, by);
    ctx.closePath();
    ctx.fillStyle = '#f2c94c';
    ctx.fill();
    inkStroke(ctx, r * 0.6);
  }
}

/** A chick's big beak around mouth height `my`: a wide orange upper bill over a smaller lower one, and a nostril. */
export function paintBigBeak(ctx: CanvasRenderingContext2D, x: number, my: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x - r * 0.3, my - r * 0.02);
  ctx.quadraticCurveTo(x, my + r * 0.12, x + r * 0.3, my - r * 0.02);
  ctx.lineTo(x, my + r * 0.36);
  ctx.closePath();
  ctx.fillStyle = '#e07a18';
  ctx.fill();
  inkStroke(ctx, r * 0.7);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.42, my - r * 0.12);
  ctx.quadraticCurveTo(x, my - r * 0.34, x + r * 0.42, my - r * 0.12);
  ctx.quadraticCurveTo(x + r * 0.2, my + r * 0.04, x, my + r * 0.22);
  ctx.quadraticCurveTo(x - r * 0.2, my + r * 0.04, x - r * 0.42, my - r * 0.12);
  ctx.closePath();
  ctx.fillStyle = '#f7a233';
  ctx.fill();
  inkStroke(ctx, r * 0.7);
  ctx.beginPath();
  ctx.arc(x + r * 0.1, my - r * 0.14, r * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.ink;
  ctx.fill();
}

/** A small closed smile around mouth height `my`, with two tiny fangs poking out of it. */
export function paintTinyFangs(ctx: CanvasRenderingContext2D, x: number, my: number, r: number): void {
  ctx.fillStyle = '#fffaf0';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.06, my + r * 0.02);
    ctx.lineTo(x + s * r * 0.13, my + r * 0.26);
    ctx.lineTo(x + s * r * 0.2, my + r * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(x - r * 0.3, my - r * 0.06);
  ctx.quadraticCurveTo(x, my + r * 0.12, x + r * 0.3, my - r * 0.06);
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
}
