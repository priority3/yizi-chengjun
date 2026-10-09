// 法宝 screen: equip up to three treasures, forge new ones with 灵石, merge three of a kind into a higher tier.
import { EQUIP_SLOTS, FORGE_COST, MERGE_COUNT, RARITY_LABEL, TREASURE_IDS, TREASURES, type TreasureId } from '../config/treasures.ts';
import { effectText, forge, mergeAll, ownedTier, toggleEquip, type Vault } from '../core/treasures.ts';
import type { Stage } from '../platform/env.ts';
import { outlined, roundRect, text } from '../render/draw.ts';
import { brush, sans } from '../render/fonts.ts';
import { inRect, L, W, type Rect } from '../render/layout.ts';
import { drawStone, drawTreasureToken } from '../render/treasure-art.ts';
import { BACK, backdrop, drawButton } from '../render/widgets.ts';
import { Toasts } from './hud.ts';
import type { Pointer } from './input.ts';
import type { Nav, Scene } from './scenes.ts';

const TIER_NAME = ['一', '二', '三'];
const SLOT = 60;
const SLOT_GAP = 14;
const GRID_COLS = 4;
const GRID_W = 84;
const GRID_H = 86;

/** Top of the content; menus get a little extra breathing room on tall phones. */
function top(): number {
  return 66 + Math.max(0, (L.H - 640) * 0.3);
}

function slotRect(i: number): Rect {
  const x0 = (W - (SLOT * EQUIP_SLOTS + SLOT_GAP * (EQUIP_SLOTS - 1))) / 2;
  return { x: x0 + i * (SLOT + SLOT_GAP), y: top() + 22, w: SLOT, h: SLOT };
}

function gridRect(i: number): Rect {
  const x0 = (W - GRID_COLS * GRID_W) / 2;
  return { x: x0 + (i % GRID_COLS) * GRID_W, y: top() + 122 + Math.floor(i / GRID_COLS) * GRID_H, w: GRID_W, h: GRID_H };
}

function forgeRect(): Rect {
  return { x: 20, y: top() + 122 + Math.ceil(TREASURE_IDS.length / GRID_COLS) * GRID_H + 10, w: 150, h: 44 };
}

function mergeRect(): Rect {
  return { ...forgeRect(), x: 190 };
}

/** Copies owned at the treasure's highest tier. */
function countAtTop(v: Vault, id: TreasureId, tier: number): number {
  return v.treasures.reduce((n, s) => (s.id === id && s.tier === tier ? n + s.count : n), 0);
}

function canMerge(v: Vault): boolean {
  return v.treasures.some((s) => s.count >= MERGE_COUNT && s.tier < TIER_NAME.length);
}

export class TreasureScene implements Scene {
  private readonly nav: Nav;
  private readonly stage: Stage;
  private readonly toasts = new Toasts();
  private pressed: string | null = null;

  constructor(nav: Nav, stage: Stage) {
    this.nav = nav;
    this.stage = stage;
  }

  private get vault(): Vault {
    return this.nav.progress.vault;
  }

  update(dt: number): void {
    this.toasts.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const v = this.vault;
    backdrop(ctx, this.stage, 0.62);
    drawButton(ctx, BACK, '返回', 'ghost');
    outlined(ctx, '法宝', W / 2, 33, brush(26), '#ffd66b', 'rgba(40,14,4,0.9)', 4);
    drawStone(ctx, W - 74, 33, 9);
    text(ctx, String(v.stones), W - 60, 34, sans(15, 800), '#bfe8d0', 'left');

    text(ctx, `出战法宝 ${v.equipped.length}/${EQUIP_SLOTS}`, W / 2, top() + 6, sans(11, 700), '#e8d5b0');
    for (let i = 0; i < EQUIP_SLOTS; i++) this.drawSlot(ctx, i, v.equipped[i]);
    text(ctx, '点一下装备或卸下 · 三件同阶可合成', W / 2, top() + 110, sans(10, 600), '#b9a585');
    TREASURE_IDS.forEach((id, i) => this.drawOwned(ctx, id, i));

    const forgeOk = v.stones >= FORGE_COST;
    drawButton(ctx, forgeRect(), '炼器', forgeOk ? 'primary' : 'disabled', `${FORGE_COST} 灵石随机炼一件`, this.pressed === 'forge');
    drawButton(ctx, mergeRect(), '合成', canMerge(v) ? 'jade' : 'disabled', '三件同阶合为高阶', this.pressed === 'merge');
    text(ctx, '通关章节得灵石，首通送法宝 · 高阶法宝效果更强', W / 2, forgeRect().y + 62, sans(10, 500), '#b9a585');
    this.toasts.draw(ctx, L.H - 40);
  }

  private drawSlot(ctx: CanvasRenderingContext2D, i: number, id: TreasureId | undefined): void {
    const r = slotRect(i);
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = id ? 'rgba(255,240,210,0.16)' : 'rgba(255,240,210,0.06)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = id ? '#f0c24a' : 'rgba(255,230,190,0.4)';
    if (!id) ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (id) {
      const tier = ownedTier(this.vault, id);
      drawTreasureToken(ctx, id, tier, r.x + r.w / 2, r.y + r.h / 2 - 2, 22);
      outlined(ctx, id, r.x + r.w / 2, r.y + r.h + 10, sans(9, 700), '#fbeed2', 'rgba(20,10,4,0.9)', 3);
    } else {
      text(ctx, '空', r.x + r.w / 2, r.y + r.h / 2 + 1, brush(20), 'rgba(255,230,190,0.4)');
    }
  }

  private drawOwned(ctx: CanvasRenderingContext2D, id: TreasureId, i: number): void {
    const v = this.vault;
    const r = gridRect(i);
    const tier = ownedTier(v, id);
    const owned = tier > 0;
    const equipped = v.equipped.includes(id);
    const dy = this.pressed === `t:${i}` ? 2 : 0;
    roundRect(ctx, r.x + 3, r.y + 3 + dy, r.w - 6, r.h - 6, 10);
    ctx.fillStyle = owned ? 'rgba(255,240,210,0.12)' : 'rgba(255,240,210,0.04)';
    ctx.fill();
    if (equipped) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f0c24a';
      ctx.stroke();
    }
    const cx = r.x + r.w / 2;
    drawTreasureToken(ctx, id, Math.max(1, tier), cx, r.y + 32 + dy, 22, !owned);
    const stack = v.treasures.find((s) => s.id === id && s.count >= MERGE_COUNT && s.tier < TIER_NAME.length);
    if (stack) {
      ctx.beginPath();
      ctx.arc(r.x + r.w - 14, r.y + 14 + dy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#f0c24a';
      ctx.fill();
      text(ctx, '合', r.x + r.w - 14, r.y + 15 + dy, brush(11), '#4a2204');
    }
    outlined(ctx, id, cx, r.y + 62 + dy, sans(id.length > 4 ? 8.5 : 9.5, 700), owned ? '#fbeed2' : '#9a8f80', 'rgba(20,10,4,0.9)', 3);
    const state = owned ? `${TIER_NAME[tier - 1]}阶 ×${countAtTop(v, id, tier)}` : RARITY_LABEL[TREASURES[id].rarity];
    text(ctx, state, cx, r.y + 75 + dy, sans(8.5, 600), owned ? '#ffe9b0' : '#8a8078');
  }

  press(p: Pointer): void {
    this.pressed = null;
    if (inRect(p.x, p.y, forgeRect())) this.pressed = 'forge';
    else if (inRect(p.x, p.y, mergeRect())) this.pressed = 'merge';
    else {
      const i = TREASURE_IDS.findIndex((_, k) => inRect(p.x, p.y, gridRect(k)));
      if (i >= 0) this.pressed = `t:${i}`;
    }
  }

  dragEnd(): void {
    this.pressed = null;
  }

  tap(p: Pointer): void {
    this.pressed = null;
    const v = this.vault;
    if (inRect(p.x, p.y, BACK)) {
      this.nav.chapters();
      return;
    }
    if (inRect(p.x, p.y, forgeRect())) {
      // Reason: the meta game is not part of the deterministic run, so plain Math.random is fine here.
      const id = forge(v, Math.random(), Math.random());
      if (!id) {
        this.toasts.push(`灵石不够：炼器要 ${FORGE_COST}，通关章节可以获得`);
        return;
      }
      this.nav.save();
      this.toasts.push(`炼出 ${RARITY_LABEL[TREASURES[id].rarity]}法宝「${id}」：${effectText(id, 1)}`);
      return;
    }
    if (inRect(p.x, p.y, mergeRect())) {
      const n = mergeAll(v);
      if (n === 0) {
        this.toasts.push('没有可以合成的：三件同名同阶的法宝才能合成');
        return;
      }
      this.nav.save();
      this.toasts.push(`合成了 ${n} 件高阶法宝`);
      return;
    }
    for (let i = 0; i < EQUIP_SLOTS; i++) {
      const id = v.equipped[i];
      if (id && inRect(p.x, p.y, slotRect(i))) {
        toggleEquip(v, id);
        this.nav.save();
        this.toasts.push(`卸下了「${id}」`);
        return;
      }
    }
    const k = TREASURE_IDS.findIndex((_, i) => inRect(p.x, p.y, gridRect(i)));
    if (k < 0) return;
    const id = TREASURE_IDS[k];
    const tier = ownedTier(v, id);
    if (tier === 0) {
      this.toasts.push(`「${id}」还没获得 · ${effectText(id, 1)}`);
      return;
    }
    if (v.equipped.includes(id)) {
      toggleEquip(v, id);
      this.toasts.push(`卸下了「${id}」`);
    } else if (toggleEquip(v, id)) {
      this.toasts.push(`装备了「${id}」：${effectText(id, tier)}`);
    } else {
      this.toasts.push(`最多带 ${EQUIP_SLOTS} 件：先点上面的槽位卸下一件`);
      return;
    }
    this.nav.save();
  }
}
