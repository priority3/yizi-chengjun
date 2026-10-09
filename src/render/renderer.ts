// Composes one frame: the map through the camera (roads, pads, cards, monsters, effects), then the HUD,
// the shop or battle bar, the dragged card and any banner or modal in screen space.
import { unlockCost } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { SLOT_NAME } from '../config/maps.ts';
import { UNITS } from '../config/units.ts';
import { pathDir, type Pt } from '../core/map.ts';
import { routeOf } from '../core/monsters.ts';
import { padAllows, padRange, slotRange } from '../core/slots.ts';
import { isRooted } from '../core/status.ts';
import type { Enemy, EnemyDef, GameState, Tile, UnitId } from '../core/types.ts';
import type { Stage } from '../platform/web.ts';
import type { Camera } from './camera.ts';
import { CARD, cardSprite } from './cards.ts';
import { drawBar, drawCoin, drawStar, outlined, roundRect, text } from './draw.ts';
import { drawEncounterPanel } from './encounter-panel.ts';
import { brush, sans } from './fonts.ts';
import { drawNetOver, drawPoisonBubbles } from './fx-cards.ts';
import { L, viewRect, W, type Rect } from './layout.ts';
import { drawMap, PAD_R } from './map-art.ts';
import { FLY_LIFT, FOOT, makePose, monsterPose, type Gait, type MonsterPose } from './monster-pose.ts';
import { monsterSprite } from './monsters-art.ts';
import { drawBanner, drawBattleBar, drawHud, drawShop, type PanelUi } from './panels.ts';
import { drawAimBadge, drawPadLabel, drawRuneRings, PAD_TAG_COLOR } from './slot-marks.ts';
import { blit } from './sprites.ts';
import type { Vfx } from './vfx.ts';

/** A small drawn snowflake (no emoji: they render differently on every phone). */
function snowflake(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.strokeStyle = '#dff6ff';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}

/** Darkens the corners of the world viewport (the boss entrance); `alpha` is the opacity reached at the corners. */
function drawVignette(ctx: CanvasRenderingContext2D, view: Rect, alpha: number): void {
  const cx = view.x + view.w / 2;
  const cy = view.y + view.h / 2;
  const g = ctx.createRadialGradient(cx, cy, Math.min(view.w, view.h) * 0.3, cx, cy, Math.hypot(view.w, view.h) / 2);
  g.addColorStop(0, 'rgba(24,6,2,0)');
  g.addColorStop(1, `rgba(24,6,2,${alpha.toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
}

/** Which way a monster faced last frame (for the flip hysteresis) and the frame it was last drawn (for pruning). */
interface Facing {
  left: boolean;
  seen: number;
}

/** A card being dragged, in screen coordinates. */
export interface DragUi {
  kind: 'shop' | 'cell';
  index: number;
  unit: UnitId;
  level: number;
  divine: boolean;
  x: number;
  y: number;
}

export interface GameUi extends PanelUi {
  drag: DragUi | null;
  /** Slot under the dragged card, or -1. */
  hoverCell: number;
  /** Whether dropping on hoverCell would do something. */
  hoverValid: boolean;
  /** Tapped tile whose range is shown, or -1. */
  selected: number;
  /** What releasing on hoverCell does when it combines (merge / awaken / 神), shown next to the slot. */
  hoverHint: string | null;
  /** What the special pad under the dragged card does (法阵 / 高台 / 泥沼); shown when there is no hoverHint. */
  hoverPad: string | null;
}

export class GameRenderer {
  private readonly stage: Stage;
  /** Enemy uid -> its remembered facing; one entry per monster on the field, pruned once it is gone. */
  private readonly facing = new Map<number, Facing>();
  /** Counts drawn frames, to tell which facings are still in use. */
  private frame = 0;
  /** Reason: one scratch pose refilled for every monster, so posing them allocates nothing per frame. */
  private readonly pose: MonsterPose = makePose();

  constructor(stage: Stage) {
    this.stage = stage;
  }

  draw(ctx: CanvasRenderingContext2D, g: GameState, ui: GameUi, vfx: Vfx, time: number, cam: Camera): void {
    const view = viewRect(g.phase);
    ctx.fillStyle = '#2b1e14';
    ctx.fillRect(0, 0, W, L.H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x, view.y, view.w, view.h);
    ctx.clip();
    if (vfx.shake > 0) ctx.translate((Math.random() - 0.5) * vfx.shake, (Math.random() - 0.5) * vfx.shake);
    cam.apply(ctx, view);
    drawMap(ctx, g.map, cam.zoom, this.stage.pixelRatio);
    this.drawSlots(ctx, g, ui, time, 1 / cam.zoom);
    this.drawTiles(ctx, g, ui, vfx, time);
    this.drawEnemies(ctx, g, vfx, time);
    vfx.trail(g.projectiles);
    vfx.drawProjectiles(ctx, g.projectiles);
    vfx.drawWorld(ctx);
    vfx.drawFloaters(ctx, 1 / cam.zoom);
    ctx.restore();
    // Boss entrance: painted after the clip and shake are gone, so the darkened corners stay put on screen.
    const dim = vfx.introDim();
    if (dim > 0) drawVignette(ctx, view, dim);
    drawHud(ctx, g, ui, vfx);
    if (g.phase === 'build') drawShop(ctx, g, ui);
    else drawBattleBar(ctx, g, ui);
    if (ui.drag) this.drawDragged(ctx, ui.drag);
    if (vfx.banner) drawBanner(ctx, vfx.banner);
    if (g.encounter) drawEncounterPanel(ctx, g.encounter, ui.pressed);
  }

  /** Locked pads with their price, the range preview and the drop target. `k` = 1 / zoom keeps labels readable. */
  private drawSlots(ctx: CanvasRenderingContext2D, g: GameState, ui: GameUi, time: number, k: number): void {
    const price = unlockCost(g.unlockCount);
    drawRuneRings(ctx, g, PAD_R + 4, time);
    g.map.slots.forEach((p, i) => {
      if (g.unlocked[i]) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PAD_R - 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(45,28,12,0.6)';
      ctx.fill();
      // A locked special pad says what it is where a plain one shows its "+".
      const kind = g.map.slotKind[i];
      if (kind === 'plain') text(ctx, '+', p.x, p.y - 6 * k, sans(Math.round(18 * k), 800), PAD_TAG_COLOR.plain);
      else text(ctx, SLOT_NAME[kind], p.x, p.y - 6 * k, sans(Math.round(10 * k), 800), PAD_TAG_COLOR[kind]);
      drawCoin(ctx, p.x - 8 * k, p.y + 9 * k, 4 * k);
      text(ctx, String(price), p.x - 3 * k, p.y + 9.5 * k, sans(Math.round(9 * k), 800), g.gongde >= price ? '#ffe9b0' : 'rgba(255,200,190,0.85)', 'left');
    });
    // Range preview for the dragged card (over a slot) or a tapped tile.
    let ringCell = -1;
    let ringRange = 0;
    if (ui.drag && ui.hoverCell >= 0) {
      ringCell = ui.hoverCell;
      const t: Tile = { uid: 0, id: ui.drag.unit, level: ui.drag.level, divine: ui.drag.divine, cd: 0, invested: 0, rage: 0 };
      // The reach the card would have on that pad (a 高台 adds to it); none where it can't stand (a 泥沼).
      const kind = g.map.slotKind[ringCell];
      ringRange = padAllows(kind, t.id) ? padRange(t, kind, g.mods) : 0;
    } else if (ui.selected >= 0 && g.slots[ui.selected]) {
      ringCell = ui.selected;
      ringRange = slotRange(g, g.slots[ui.selected] as Tile, ui.selected);
    }
    if (ringCell >= 0 && ringRange > 0 && Number.isFinite(ringRange)) {
      const p = g.map.slots[ringCell];
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringRange, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,245,210,0.12)';
      ctx.fill();
      ctx.setLineDash([6 * k, 5 * k]);
      ctx.lineWidth = 1.5 * k;
      ctx.strokeStyle = 'rgba(255,245,210,0.75)';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (ui.drag && ui.hoverCell >= 0) {
      const p = g.map.slots[ui.hoverCell];
      if (ui.hoverHint) this.drawCombineHint(ctx, p, ui.hoverHint, time, k);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PAD_R + 3, 0, Math.PI * 2);
        ctx.lineWidth = 3 * k;
        ctx.strokeStyle = ui.hoverValid ? '#7dff9a' : '#ff6a5a';
        ctx.stroke();
        if (ui.hoverPad) drawPadLabel(ctx, p, ui.hoverPad, ui.hoverValid, PAD_R, k);
      }
    }
  }

  /** A spinning golden ring around the target card plus a label saying what releasing will do. */
  private drawCombineHint(ctx: CanvasRenderingContext2D, p: Pt, hint: string, time: number, k: number): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, PAD_R + 6, 0, Math.PI * 2);
    ctx.setLineDash([9 * k, 7 * k]);
    ctx.lineDashOffset = -time * 45 * k;
    ctx.lineWidth = 3.5 * k;
    ctx.strokeStyle = '#ffd166';
    ctx.shadowColor = 'rgba(255,200,60,0.9)';
    ctx.shadowBlur = (10 + Math.sin(time * 8) * 4) * k;
    ctx.stroke();
    ctx.restore();
    const cy = p.y - PAD_R - 16 * k;
    ctx.font = sans(Math.round(10 * k), 800);
    const w = ctx.measureText(hint).width + 18 * k;
    roundRect(ctx, p.x - w / 2, cy - 10 * k, w, 20 * k, 10 * k);
    ctx.fillStyle = 'rgba(28,14,6,0.9)';
    ctx.fill();
    ctx.lineWidth = 1.5 * k;
    ctx.strokeStyle = '#ffd166';
    ctx.stroke();
    text(ctx, hint, p.x, cy + 0.5 * k, sans(Math.round(10 * k), 800), '#ffe9a8');
  }

  private drawTiles(ctx: CanvasRenderingContext2D, g: GameState, ui: GameUi, vfx: Vfx, time: number): void {
    g.slots.forEach((t, i) => {
      if (!t) return;
      const p = g.map.slots[i];
      const x = p.x;
      // Reason: cards stand a little above the pad's centre so the pad shows underneath like a plinth.
      const y = p.y - 6;
      const shake = vfx.shakes[i] > 0 ? Math.sin(vfx.shakes[i] * 80) * 3 : 0;
      const scale = 1 + vfx.pops[i] * 0.9 + vfx.recoil[i] * 0.7;
      const { img, size } = cardSprite(t.id, t.level, t.divine);
      const dragging = ui.drag?.kind === 'cell' && ui.drag.index === i;
      const hero = UNITS[t.id].kind === 'hero';
      const ready = hero && t.rage >= 1;
      ctx.save();
      if (dragging) ctx.globalAlpha = 0.3;
      if (ready) {
        // Full rage: the card glows until the next attack unleashes the ultimate.
        ctx.shadowColor = 'rgba(255,200,60,1)';
        ctx.shadowBlur = 16 + Math.sin(time * 9) * 6;
        roundRect(ctx, x - CARD / 2, y - CARD / 2, CARD, CARD, 9);
        ctx.fillStyle = 'rgba(255,215,90,0.8)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      blit(ctx, img, x + shake, y, size, size, scale);
      if (hero) drawBar(ctx, x - 19, y + CARD / 2 - 5, 38, 4.5, t.rage, ready ? '#ffd166' : '#ff7a2a');
      // 瞄准 other than 打最前: a badge on the bottom-right corner, clear of the level badge and the 神 seal up top.
      if (t.target) drawAimBadge(ctx, t.target, x + shake + 23 * scale, y + 21 * scale, 7.5 * scale);
      ctx.restore();
    });
  }

  /**
   * One monster, back to front: its patch of ground, the posed body, status marks, then the HP bar and name.
   * Only the body faces, leans and squashes; everything else stays upright where the monster stands.
   */
  private drawEnemy(ctx: CanvasRenderingContext2D, g: GameState, e: Enemy, vfx: Vfx, time: number): void {
    const def = ENEMIES[e.def];
    const pose = this.poseOf(g, e, time);
    // Reason: a flyer's body, its status marks and its HP bar all hover FLY_LIFT above its spot; only the shadow stays down.
    const lift = e.air ? FLY_LIFT : 0;
    if (e.air) vfx.air.add(e.uid);
    this.drawGround(ctx, e, def, time);
    this.drawBody(ctx, e, def, pose, vfx, lift);
    this.drawStatus(ctx, e, def, time, lift);
    this.drawTags(ctx, e, def, lift);
  }

  /** This frame's pose of `e` (the shared scratch object), carrying its facing over from the previous frame. */
  private poseOf(g: GameState, e: Enemy, time: number): MonsterPose {
    // A flyer faces along its flight line.
    const dir = pathDir(routeOf(g, e), e.dist);
    let face = this.facing.get(e.uid);
    if (!face) {
      // A newcomer simply faces the way its road heads.
      face = { left: Math.cos(dir) < 0, seen: 0 };
      this.facing.set(e.uid, face);
    }
    face.seen = this.frame;
    // Reason: nobody walks once the battle is over (a lost run freezes the field), a stun stops a dash too, and flyers
    // beat their wings instead of stepping. A monster caught in a net sways in place like a stunned one, struggling.
    const held = e.stunT > 0 || isRooted(e);
    const gait: Gait = g.phase !== 'battle' ? 'idle' : held ? 'stun' : e.air ? 'fly' : e.dashT > 0 ? 'dash' : 'walk';
    monsterPose(this.pose, dir, face.left, gait, time, e.uid);
    face.left = this.pose.flip;
    return this.pose;
  }

  /** Ground shadow and the boss's pulsing aura. */
  private drawGround(ctx: CanvasRenderingContext2D, e: Enemy, def: EnemyDef, time: number): void {
    if (e.air) {
      // A flyer only casts a small, faint shadow, on the ground where its feet would be.
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + def.radius * FOOT, def.radius * 0.6, def.radius * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(40,20,5,0.16)';
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + def.radius * FOOT, def.radius * 0.9, def.radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,20,5,0.25)';
    ctx.fill();
    if (def.boss) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, def.radius * (1.25 + Math.sin(time * 4) * 0.05), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,90,40,0.16)';
      ctx.fill();
    }
  }

  /**
   * The sprite and its hit flash, mirrored, leaned and squashed about the feet so a squash never lifts it off the ground;
   * `lift` raises a flyer's whole body.
   */
  private drawBody(ctx: CanvasRenderingContext2D, e: Enemy, def: EnemyDef, pose: MonsterPose, vfx: Vfx, lift: number): void {
    const { img, flash, box } = monsterSprite(e.def);
    const foot = def.radius * FOOT;
    // Sprite corner relative to the feet: unposed, the sprite is centred on the enemy's position.
    const left = -box / 2;
    const top = -foot - box / 2;
    ctx.save();
    ctx.translate(e.x, e.y + foot - lift);
    // Reason: the rotation sits outside the mirror, so `lean` is in world terms — a monster walking left tips left.
    ctx.rotate(pose.lean);
    ctx.scale(pose.flip ? -pose.sx : pose.sx, pose.sy);
    ctx.drawImage(img, left, top, box, box);
    const f = vfx.flash.get(e.uid);
    if (f !== undefined) {
      ctx.globalAlpha = Math.min(1, f / 0.12) * 0.85;
      ctx.drawImage(flash, left, top, box, box);
    }
    ctx.restore();
  }

  /**
   * Status marks around the feet and over the head (of a flyer's lifted body): the slow ring with its snowflake, the
   * stun stars, a 毒's bubbles and a 网's net.
   */
  private drawStatus(ctx: CanvasRenderingContext2D, e: Enemy, def: EnemyDef, time: number, lift: number): void {
    const x = e.x;
    const y = e.y - lift;
    if (e.slowT > 0) {
      ctx.beginPath();
      ctx.ellipse(x, y + def.radius * 0.9, def.radius * 1.05, def.radius * 0.36, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150,225,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      snowflake(ctx, x + def.radius * 0.9, y - def.radius * 0.9, 5);
    }
    if (e.stunT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * Math.PI * 2) / 3;
        drawStar(ctx, x + Math.cos(a) * def.radius * 0.8, y - def.radius * 1.2 + Math.sin(a) * 3, 3.5, '#ffe45a');
      }
    }
    if (isRooted(e)) drawNetOver(ctx, x, y, def.radius, time, e.uid);
    if (e.poison) drawPoisonBubbles(ctx, x, y, def.radius, e.poison.stacks, time, e.uid);
  }

  /** HP bar above the monster (a flyer's lifted body), plus the name under bosses and elites. */
  private drawTags(ctx: CanvasRenderingContext2D, e: Enemy, def: EnemyDef, lift: number): void {
    const barW = Math.max(22, def.radius * 2);
    const y = e.y - lift;
    drawBar(ctx, e.x - barW / 2, y - def.radius - 9, barW, 4, e.hp / e.maxHp, def.boss ? '#ff5a3a' : '#6fdc5a');
    if (def.boss || def.elite) {
      outlined(ctx, def.name, e.x, y + def.radius + 12, brush(def.boss ? 14 : 12), def.boss ? '#ffd166' : '#ffb0a0', 'rgba(20,10,4,0.9)', 3);
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, g: GameState, vfx: Vfx, time: number): void {
    // Reason: draw in y order so monsters further down overlap the ones behind them; flyers go over everyone on the ground.
    const list = g.enemies.filter((e) => !e.gone).sort((a, b) => Number(a.air) - Number(b.air) || a.y - b.y);
    // Fresh corpses lie on the ground, under everyone still walking.
    vfx.drawCorpses(ctx);
    this.frame++;
    // Refilled by drawEnemy, so hit sparks and shots aimed at a flyer can rise to its body.
    vfx.air.clear();
    for (const e of list) this.drawEnemy(ctx, g, e, vfx, time);
    // Every monster drawn has a facing, so any surplus belongs to the dead or to those that reached the camp.
    if (this.facing.size > list.length) this.facing.forEach(this.forgetStale);
  }

  /** forEach callback, bound once so pruning allocates nothing: drops facings not refreshed this frame. */
  private readonly forgetStale = (face: Facing, uid: number): void => {
    if (face.seen !== this.frame) this.facing.delete(uid);
  };

  private drawDragged(ctx: CanvasRenderingContext2D, d: DragUi): void {
    const { img, size } = cardSprite(d.unit, d.level, d.divine);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    blit(ctx, img, d.x, d.y, size, size, 1.12);
    ctx.restore();
    if (UNITS[d.unit].kind === 'fragment') outlined(ctx, '拖到另一半上', d.x, d.y + CARD * 0.78, sans(10, 700), '#fff4d6');
  }
}
