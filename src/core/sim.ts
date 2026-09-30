// Headless AI-vs-AI runner shared by the balance tests and `pnpm sim`.
import { createMatch, hashState, step } from './match.ts';
import type { AiKnobs, EndReason, SideId } from './types.ts';

/** 12 simulated minutes; every match must end well before this. */
export const MAX_SIM_TICKS = 12 * 60 * 60;

export interface SimResult {
  winner: SideId | null;
  reason: EndReason | null;
  ticks: number;
  wave: number;
  overtime: number;
  hash: number;
}

export function runMatch(seed: number, level: number, a: AiKnobs, b: AiKnobs, maxTicks = MAX_SIM_TICKS): SimResult {
  const m = createMatch({ seed, level, ai: [a, b] });
  while (m.winner === null && m.tick < maxTicks) step(m);
  return { winner: m.winner, reason: m.endReason, ticks: m.tick, wave: m.wave, overtime: m.overtime, hash: hashState(m) };
}
