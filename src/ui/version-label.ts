// The version label shared by the title screen (faint, bottom right) and the 关于 screen's 版本与联系方式.
import { siteHost } from '../platform/site.ts';

/**
 * Version, build commit and host, e.g. "v0.8.0 · 3d2f262 · zidou-xiyou.vercel.app"; parts that are empty are left out.
 * Reason: the host tells apart the entry points (vercel.app, a custom domain, localhost) when a player reports a bug.
 */
export function versionLabel(host = siteHost()): string {
  return [`v${__APP_VERSION__}`, __APP_BUILD__, host].filter((s) => s !== '').join(' · ');
}
