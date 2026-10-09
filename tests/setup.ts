// Runs before every test file (vite.config.ts test.setupFiles): installs the web platform, as main.ts does in the
// browser. It reads the browser globals only when called, so tests still stub document, localStorage, AudioContext
// and the like with vi.stubGlobal, and under plain Node it finds none of them (no storage, no font loading, silence).
import { installPlatform } from '../src/platform/env.ts';
import { webPlatform } from '../src/platform/web.ts';

installPlatform(webPlatform());
