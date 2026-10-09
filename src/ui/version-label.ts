// The version label shared by the title screen (faint, bottom right) and the 关于 screen's 版本与联系方式.
import { platform } from '../platform/env.ts';

/**
 * Version, build commit and host, e.g. "v0.8.0 · 3d2f262 · zidou-xiyou.vercel.app"; parts that are empty are left out.
 * Reason: the host tells apart the entry points (vercel.app, a custom domain, localhost) when a player reports a bug;
 * it comes from the platform (platform/env.ts host), so a mini-game build names itself there instead.
 */
export function versionLabel(host = platform().host()): string {
  return [`v${__APP_VERSION__}`, __APP_BUILD__, host].filter((s) => s !== '').join(' · ');
}
