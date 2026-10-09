// The generated service worker (build/sw-template.js), run against in-memory fakes of the worker globals.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPrecache, renderServiceWorker } from '../build/precache.ts';

const ORIGIN = 'https://game.test';
/** Served from a sub-path, like any static host may do: every URL must resolve against the worker's own. */
const at = (path: string) => `${ORIGIN}/zdxy/${path}`;
const PRECACHE = buildPrecache(
  [
    { name: 'index.html', source: 'html' },
    { name: 'assets/index-abc.js', source: 'js' },
    { name: 'fonts/zdxy-brush.woff2', source: 'font' },
  ],
  '0.6.0',
);
const SOURCE = renderServiceWorker(readFileSync(new URL('../build/sw-template.js', import.meta.url), 'utf8'), PRECACHE);

type Handler = (event: unknown) => void;
/** What the worker reads from a request (Node's Request can't be built with mode 'navigate'). */
interface FakeRequest {
  url: string;
  method: string;
  mode: string;
}
type Stored = Response | { redirected: boolean; body: ReadableStream | null; status: number; statusText: string; headers: Headers };

/** Cache Storage in memory: cache name -> URL -> response. */
class FakeCaches {
  readonly stores = new Map<string, Map<string, Stored>>();
  /** Every request handed to cache.addAll. */
  readonly added: Request[] = [];
  /** The options of every cache.match call. */
  readonly matchOptions: unknown[] = [];

  async open(name: string) {
    const store = this.stores.get(name) ?? new Map<string, Stored>();
    this.stores.set(name, store);
    return {
      addAll: async (requests: Request[]) => {
        this.added.push(...requests);
        for (const r of requests) store.set(r.url, new Response(`cached ${r.url}`));
      },
      match: async (key: string | FakeRequest, options?: unknown) => {
        this.matchOptions.push(options);
        return store.get(typeof key === 'string' ? key : key.url);
      },
    };
  }

  async keys() {
    return [...this.stores.keys()];
  }

  async delete(name: string) {
    return this.stores.delete(name);
  }
}

/** Loads the worker script with fake globals; `network` answers its fetch() calls. */
function boot() {
  const handlers = new Map<string, Handler>();
  const self = {
    location: new URL(at('sw.js')),
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) },
  };
  const caches = new FakeCaches();
  const network = vi.fn(async (r: FakeRequest) => new Response(`network ${r.url}`));
  new Function('self', 'caches', 'fetch', SOURCE)(self, caches, network);
  const extendable = async (type: string) => {
    let done: Promise<unknown> = Promise.resolve();
    handlers.get(type)?.({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  };
  /** Dispatches a fetch event; `response` stays undefined when the worker leaves the request to the browser. */
  const request = (url: string, mode = 'cors', method = 'GET') => {
    let response: Promise<Response> | undefined;
    handlers.get('fetch')?.({ request: { url, mode, method }, respondWith: (p: Promise<Response>) => (response = p) });
    return response;
  };
  return { handlers, self, caches, network, extendable, request };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('service worker lifecycle', () => {
  it('precaches every listed file under its own sub-path, bypassing the HTTP cache', async () => {
    const sw = boot();
    await sw.extendable('install');
    expect([...(sw.caches.stores.get(PRECACHE.cacheName)?.keys() ?? [])].sort()).toEqual(PRECACHE.urls.map(at));
    expect(sw.caches.added.every((r) => r.cache === 'reload')).toBe(true);
    // Reason: it must wait for the go-ahead (the title screen banner), never take over on its own.
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('on activation drops older zdxy caches, keeps other apps\' caches and takes over open pages', async () => {
    const sw = boot();
    for (const name of ['zdxy-0.5.0-0123456789', PRECACHE.cacheName, 'other-app']) await sw.caches.open(name);
    await sw.extendable('activate');
    expect(await sw.caches.keys()).toEqual([PRECACHE.cacheName, 'other-app']);
    expect(sw.self.clients.claim).toHaveBeenCalledOnce();
  });

  it('skips waiting only when the page asks', () => {
    const sw = boot();
    sw.handlers.get('message')?.({ data: { type: 'hello' } });
    sw.handlers.get('message')?.({ data: null });
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    sw.handlers.get('message')?.({ data: { type: 'SKIP_WAITING' } });
    expect(sw.self.skipWaiting).toHaveBeenCalledOnce();
  });
});

describe('service worker fetch', () => {
  it('leaves non-GET, cross-origin and unlisted requests to the network', () => {
    const sw = boot();
    expect(sw.request(at('assets/index-abc.js'), 'cors', 'POST')).toBeUndefined();
    expect(sw.request('https://cdn.example.com/zdxy/assets/index-abc.js')).toBeUndefined();
    expect(sw.request(at('assets/index-old.js'))).toBeUndefined();
    expect(sw.request(`${ORIGIN}/assets/index-abc.js`)).toBeUndefined();
  });

  it('serves precached files from the cache, and from the network if the cache lost them', async () => {
    const sw = boot();
    await sw.extendable('install');
    expect(await (await sw.request(at('fonts/zdxy-brush.woff2')))?.text()).toBe(`cached ${at('fonts/zdxy-brush.woff2')}`);
    expect(sw.network).not.toHaveBeenCalled();
    sw.caches.stores.get(PRECACHE.cacheName)?.delete(at('assets/index-abc.js'));
    expect(await (await sw.request(at('assets/index-abc.js')))?.text()).toBe(`network ${at('assets/index-abc.js')}`);
  });

  it('loads pages from the network first', async () => {
    const sw = boot();
    await sw.extendable('install');
    expect(await (await sw.request(at(''), 'navigate'))?.text()).toBe(`network ${at('')}`);
  });

  it('falls back to the cached index.html offline, for any page in scope', async () => {
    const sw = boot();
    await sw.extendable('install');
    sw.network.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await (await sw.request(at('?from=homescreen'), 'navigate'))?.text()).toBe(`cached ${at('index.html')}`);
    await sw.request(at('fonts/zdxy-brush.woff2'));
    // Reason: a Vary header from the host (Accept, ...) must never make a precached file miss offline.
    expect(sw.caches.matchOptions).toEqual([{ ignoreVary: true }, { ignoreVary: true }]);
  });

  it('falls back to the cached index.html when the network takes longer than 3 s', async () => {
    vi.useFakeTimers();
    const sw = boot();
    await sw.extendable('install');
    sw.network.mockReturnValue(new Promise<Response>(() => {}));
    let body = '';
    void sw.request(at(''), 'navigate')?.then(async (r) => (body = await r.text()));
    await vi.advanceTimersByTimeAsync(2900);
    expect(body).toBe('');
    await vi.advanceTimersByTimeAsync(200);
    expect(body).toBe(`cached ${at('index.html')}`);
  });

  it('with nothing cached, offline is the browser\'s usual error', async () => {
    const sw = boot();
    sw.network.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(sw.request(at(''), 'navigate')).rejects.toThrow('Failed to fetch');
  });

  it('answers a navigation with a clean copy of a redirected cached page', async () => {
    const sw = boot();
    await sw.extendable('install');
    // Hosts with clean URLs redirect /index.html to /, and the cached copy remembers that redirect.
    const page = new Response('<!doctype html>', { status: 200, statusText: 'OK', headers: { 'content-type': 'text/html' } });
    sw.caches.stores.get(PRECACHE.cacheName)?.set(at('index.html'), { redirected: true, body: page.body, status: 200, statusText: 'OK', headers: page.headers });
    sw.network.mockRejectedValue(new TypeError('Failed to fetch'));
    const res = await sw.request(at(''), 'navigate');
    expect(res?.redirected).toBe(false);
    expect(res?.headers.get('content-type')).toBe('text/html');
    expect(await res?.text()).toBe('<!doctype html>');
  });
});
