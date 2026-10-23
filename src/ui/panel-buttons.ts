// The buttons of the chapter screen's pause and result panels for the run they belong to (kept apart from the scene
// so game-scene.ts stays small). The scene hands over what the buttons do.
import { CHAPTERS } from '../config/chapters.ts';
import type { GameState } from '../core/types.ts';
import { canSwitchLang, tr } from '../i18n/lang.ts';
import { langSwitchLabel, switchLang } from '../platform/lang-choice.ts';
import type { OverlayButton } from './game-overlays.ts';

/** What the panels' buttons do: the scene's own actions. */
export interface PanelActions {
  resume(): void;
  toggleMusic(): void;
  /** Starts this run's kind afresh (game-scene.ts restart). */
  restart(): void;
  /** Gives the run up: the chapter screen, or the editor after a 试玩. */
  abandon(): void;
  play(chapter: number): void;
  treasures(): void;
  chapters(): void;
}

/** 继续, the music switch, the language switch where the build has one (the web version), 重新开始 and the way out. */
export function pauseButtons(music: boolean, test: boolean, a: PanelActions): OverlayButton[] {
  return [
    { label: tr('继续', 'Resume'), go: () => a.resume() },
    { label: music ? tr('音乐：开', 'Music: On') : tr('音乐：关', 'Music: Off'), go: () => a.toggleMusic() },
    ...(canSwitchLang() ? [{ label: langSwitchLabel(), go: () => switchLang() }] : []),
    { label: tr('重新开始', 'Restart'), go: () => a.restart() },
    { label: test ? '返回编辑' : tr('返回选章', 'Chapters'), go: () => a.abandon() },
  ];
}

/** The result panel's buttons when run `g` of `chapter` has ended (`test`: the map editor's 试玩). */
export function resultButtons(g: GameState, chapter: number, test: boolean, a: PanelActions): OverlayButton[] {
  // A 试玩: play the edited map again, or go back to editing it.
  if (test) return [{ label: '再来一次', go: () => a.restart() }, { label: '返回编辑', go: () => a.abandon() }];
  const out: OverlayButton[] = [];
  const again = tr('再来一次', 'Play again');
  // An endless or daily run: 再来一次 and 返回选章 (below).
  if (g.mode !== 'chapter') out.push({ label: again, go: () => a.restart() });
  else if (g.phase === 'won') {
    if (chapter < CHAPTERS.length) out.push({ label: tr('下一章', 'Next chapter'), go: () => a.play(chapter + 1) });
    out.push({ label: again, go: () => a.play(chapter) });
  } else {
    out.push({ label: again, go: () => a.play(chapter) });
    out.push({ label: tr('法宝炼器', 'Craft relics'), go: () => a.treasures() });
  }
  out.push({ label: tr('返回选章', 'Chapters'), go: () => a.chapters() });
  return out;
}
