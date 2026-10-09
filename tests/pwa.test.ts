// The update flow behind the title screen's 有新版本 banner (platform/pwa.ts), with fake service worker objects.
import { describe, expect, it, vi } from 'vitest';
import { SKIP_WAITING, UpdateFlow } from '../src/platform/pwa.ts';

class FakeWorker extends EventTarget {
  state: ServiceWorkerState;
  readonly messages: unknown[] = [];

  constructor(state: ServiceWorkerState = 'installing') {
    super();
    this.state = state;
  }

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  /** The browser moves the worker on to `state`. */
  to(state: ServiceWorkerState): void {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;

  /** The browser found a changed sw.js and starts installing it. */
  found(worker: FakeWorker): void {
    this.installing = worker;
    this.dispatchEvent(new Event('updatefound'));
  }
}

class FakeContainer extends EventTarget {
  controller: FakeWorker | null = null;

  /** A worker takes control of the page (skipWaiting + clients.claim, here or in another tab). */
  takeOver(worker: FakeWorker): void {
    this.controller = worker;
    this.dispatchEvent(new Event('controllerchange'));
  }
}

/** A flow watching a fresh registration; `controlled` = an older build's worker already serves the page. */
function setup(controlled: boolean, waiting: FakeWorker | null = null) {
  const reload = vi.fn();
  const flow = new UpdateFlow(reload);
  const container = new FakeContainer();
  if (controlled) container.controller = new FakeWorker('activated');
  const reg = new FakeRegistration();
  reg.waiting = waiting;
  flow.watch(container as unknown as ServiceWorkerContainer, reg as unknown as ServiceWorkerRegistration);
  return { flow, reload, container, reg };
}

describe('service worker updates', () => {
  it('does not offer the very first install as an update', () => {
    const { flow, reload, container, reg } = setup(false);
    const worker = new FakeWorker();
    reg.found(worker);
    worker.to('installed');
    expect(flow.ready).toBe(false);
    worker.to('activated');
    // Reason: clients.claim() on the first install fires controllerchange; that must not reload the page.
    container.takeOver(worker);
    expect(reload).not.toHaveBeenCalled();
  });

  it('offers a new build once it has installed beside the one serving the page', () => {
    const { flow, reg } = setup(true);
    const worker = new FakeWorker();
    reg.found(worker);
    expect(flow.ready).toBe(false);
    worker.to('installed');
    expect(flow.ready).toBe(true);
    expect(flow.applying).toBe(false);
  });

  it('offers a build that was already waiting from an earlier visit', () => {
    expect(setup(true, new FakeWorker('installed')).flow.ready).toBe(true);
  });

  it('on the go-ahead asks the worker to skip waiting and reloads once it controls the page', () => {
    const worker = new FakeWorker('installed');
    const { flow, reload, container } = setup(true, worker);
    flow.apply();
    expect(worker.messages).toEqual([SKIP_WAITING]);
    expect(flow.applying).toBe(true);
    expect(reload).not.toHaveBeenCalled();
    worker.to('activated');
    container.takeOver(worker);
    container.takeOver(worker);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not reload when another tab switched versions, but reloads straight away on a later tap', () => {
    const worker = new FakeWorker('installed');
    const { flow, reload, container } = setup(true, worker);
    worker.to('activated');
    container.takeOver(worker);
    expect(reload).not.toHaveBeenCalled();
    flow.apply();
    expect(worker.messages).toEqual([]);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does nothing on a tap when no update waits', () => {
    const { flow, reload } = setup(true);
    flow.apply();
    expect(flow.applying).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
