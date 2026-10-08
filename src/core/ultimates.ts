// Hero ultimates (大招). Rage builds with normal attacks; a full bar turns the next attack into the ultimate.
import { RAGE_DIVINE_MUL, RAGE_PER_HIT, ULTIMATES } from '../config/ultimates.ts';
import { applySlow, applyStun, damage, dist2, knock } from './effects.ts';
import { pathDir } from './map.ts';
import { tileDamage, tileRange } from './stats.ts';
import type { Enemy, GameState, HeroId, RunMods, Tile } from './types.ts';

/** Rage a hero gains per normal attack. */
export function rageGain(t: Tile, mods: RunMods): number {
  return RAGE_PER_HIT * (t.divine ? RAGE_DIVINE_MUL : 1) * mods.rageMul;
}

export function isUltimateReady(t: Tile): boolean {
  return t.rage >= 1;
}

/** Casts the hero's ultimate on/around `target`; the caller resets rage and cooldown. */
export function castUltimate(g: GameState, t: Tile, cell: number, target: Enemy): void {
  const hero = t.id as HeroId;
  const u = ULTIMATES[hero];
  const p = g.map.slots[cell];
  const dmg = tileDamage(t, g.mods) * u.dmgMul;
  const targets: Array<{ x: number; y: number }> = [];
  const hit = (e: Enemy, amount: number) => {
    targets.push({ x: e.x, y: e.y });
    damage(g, e, amount, t.id);
  };
  switch (hero) {
    case '悟空':
      // The staff sweeps a long stretch of the target's road, ahead and behind it.
      for (const e of g.enemies) {
        if (e.hp <= 0 || e.gone || e.path !== target.path || Math.abs(e.dist - target.dist) > u.reach) continue;
        hit(e, dmg);
        knock(g, e, u.knockback);
      }
      break;
    case '八戒': {
      const r2 = u.radius * u.radius;
      for (const e of g.enemies) {
        if (e.hp <= 0 || e.gone || dist2(e, target.x, target.y) > r2) continue;
        hit(e, dmg);
        applyStun(e, u.stun * g.mods.stunMul);
        knock(g, e, u.knockback);
      }
      break;
    }
    case '沙僧': {
      // Chain-slash the weakest enemies in range; finish those below the execute line.
      const r = tileRange(t, g.mods);
      const r2 = r * r;
      const weakest = g.enemies
        .filter((e) => e.hp > 0 && !e.gone && dist2(e, p.x, p.y) <= r2)
        .sort((a, b) => a.hp - b.hp || a.uid - b.uid)
        .slice(0, u.count);
      const line = u.executePct + g.mods.executeBonus;
      for (const e of weakest) {
        hit(e, dmg);
        if (e.hp > 0 && e.hp < e.maxHp * line) {
          e.hp = 0;
          g.events.push({ t: 'execute', x: e.x, y: e.y });
        }
      }
      break;
    }
    case '白龙':
      for (const e of g.enemies) {
        if (e.hp <= 0 || e.gone) continue;
        hit(e, dmg);
        knock(g, e, u.knockback);
        applySlow(e, u.slowPct, u.slowDur);
      }
      break;
  }
  const dir = pathDir(g.map.paths[target.path], target.dist);
  g.events.push({ t: 'ultimate', hero, cell, x: p.x, y: p.y, tx: target.x, ty: target.y, path: target.path, dir, targets });
}
