// Offline play and updates: registers the service worker that build/sw-plugin.ts writes into production builds
// and notices when a newer build is waiting, so the title screen can offer 有新版本，点此刷新.
// Without service workers (file://, old or in-app browsers, private modes) this does nothing and the game runs online.

/** The message the worker (build/sw-template.js) answers by taking over at once. */
export const SKIP_WAITING = { type: 'SKIP_WAITING' } as const;

/** Follows one registration: a waiting update, the player's go-ahead, and the reload once the new worker controls. */
export class UpdateFlow {
  /** A newer worker that has installed and waits to replace the one serving this page. */
  private waiting: ServiceWorker | null = null;
  /** The player tapped the banner: reload as soon as the new worker has taken over. */
  private requested = false;
  private reloaded = false;
  private readonly reload: () => void;

  constructor(reload: () => void) {
    this.reload = reload;
  }

  /** Starts watching `reg` (a worker already waiting or installing included) and the page's controller. */
  watch(container: ServiceWorkerContainer, reg: ServiceWorkerRegistration): void {
    container.addEventListener('controllerchange', () => this.takeOver());
    const track = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const check = () => {
        // Reason: the very first install also passes 'installed', but then no page runs an older build to replace.
        if (worker.state === 'installed' && container.controller) this.waiting = worker;
      };
      check();
      worker.addEventListener('statechange', check);
    };
    track(reg.waiting);
    track(reg.installing);
    reg.addEventListener('updatefound', () => track(reg.installing));
  }

  /** A newer build is installed and waiting for the go-ahead. */
  get ready(): boolean {
    return this.waiting !== null;
  }

  /** The player asked for the update and the page is about to reload. */
  get applying(): boolean {
    return this.requested;
  }

  /** Lets the waiting worker take over; the page reloads once it controls the page. */
  apply(): void {
    const worker = this.waiting;
    if (!worker) return;
    this.requested = true;
    if (worker.state === 'installed') worker.postMessage(SKIP_WAITING);
    // Reason: another tab already let it take over (or a newer build replaced it); a plain reload picks that up.
    else this.takeOver();
  }

  private takeOver(): void {
    // Reason: controllerchange also fires on the first install and when another tab updates; only reload on request.
    if (!this.requested || this.reloaded) return;
    this.reloaded = true;
    this.reload();
  }
}

const flow = new UpdateFlow(() => location.reload());

/** Registers ./sw.js in production builds. Never in dev: the worker would cache Vite's modules and fight hot reload. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  let container: ServiceWorkerContainer;
  try {
    if (!('serviceWorker' in navigator)) return;
    container = navigator.serviceWorker;
  } catch {
    // Reason: some browsers throw just for touching navigator.serviceWorker (e.g. Firefox with storage blocked).
    return;
  }
  const start = async () => {
    try {
      const reg = await container.register('./sw.js', { updateViaCache: 'none' });
      flow.watch(container, reg);
      // Reason: phones keep a home-screen app open for days; look for a new build whenever it comes back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') Promise.resolve().then(() => reg.update()).catch(() => {});
      });
    } catch {
      // file://, blocked storage, in-app browsers: no offline support; the game itself is unaffected.
    }
  };
  // Reason: let the page's own downloads finish before the worker fetches the whole game a second time.
  if (document.readyState === 'complete') void start();
  else window.addEventListener('load', () => void start(), { once: true });
}

/** A newer build is waiting: the title screen shows its update banner. */
export function pwaUpdateReady(): boolean {
  return flow.ready;
}

/** The banner was tapped and the page reloads as soon as the new build has taken over. */
export function pwaUpdating(): boolean {
  return flow.applying;
}

/** Switches to the waiting build (the banner's tap). */
export function applyPwaUpdate(): void {
  flow.apply();
}
