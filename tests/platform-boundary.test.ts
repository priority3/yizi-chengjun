// The platform boundary (plan.md v1.0 step 1, src/platform/env.ts): the game reaches the device only through
// platform(), so a mini-game build can install its own platform without touching render/, ui/ or core/.
// 1. Only the web entry and the browser half of src/platform/ (WEB_PLATFORM) may use browser globals such as document,
//    window, location, localStorage or navigator. That is stricter than "outside src/platform/": the shared platform
//    modules (env, audio, music, save, progress, today) run on mini-games too. setTimeout, setInterval, console, Date
//    and Math stay allowed: both mini-game runtimes have them.
// 2. Nothing a mini-game build starts from (src/boot.ts) imports a web-only module, so the map editor, offline play,
//    the save-image overlay and the icon painter stay out of its bundle.
// Files are read with the TypeScript parser, so comments, strings, property names (this.history) and declarations
// don't count; only code that reads a global does.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/** Browser globals the game reaches only through the platform. */
const BROWSER_GLOBALS = new Set([
  // The page and the browser window.
  'window', 'self', 'globalThis', 'document', 'location', 'history', 'navigator', 'screen', 'visualViewport',
  'devicePixelRatio', 'innerWidth', 'innerHeight', 'matchMedia', 'getComputedStyle', 'ResizeObserver',
  'addEventListener', 'removeEventListener', 'alert', 'confirm', 'prompt',
  // Storage and network.
  'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'WebSocket',
  // Frames and the clock (a mini-game's performance clock may tick in other units).
  'requestAnimationFrame', 'cancelAnimationFrame', 'performance',
  // Canvases, images, fonts, sound and files.
  'OffscreenCanvas', 'Image', 'createImageBitmap', 'FontFace', 'AudioContext', 'webkitAudioContext', 'Audio',
  'Blob', 'File', 'URL', 'atob', 'btoa',
]);

/** The files that may use them (paths under src/): the web entry and the browser half of the platform. */
const WEB_PLATFORM = ['main.ts', 'platform/web.ts', 'platform/web-input.ts', 'platform/share.ts', 'platform/pwa.ts', 'platform/editor-io.ts'];

/** Web-only modules a mini-game build leaves out: the browser platform, the map editor and the app icon painter. */
const isWebOnly = (file: string): boolean =>
  WEB_PLATFORM.includes(file) || /^ui\/editor-[\w-]+\.ts$/.test(file) || file === 'render/editor-draw.ts' || file === 'render/app-icon.ts';

const SRC = new URL('../src/', import.meta.url);

/** Every .ts file under src/, as paths relative to it with forward slashes. */
function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .map((f) => f.split('\\').join('/'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort();
}

function parse(name: string, text: string): ts.SourceFile {
  return ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Whether `id` reads a variable, rather than naming a property or something declared, or sitting in a type. */
function readsVariable(id: ts.Identifier): boolean {
  const p = id.parent;
  // obj.history, obj?.document: a property of something else.
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isQualifiedName(p) && p.right === id) return false;
  // `const { performance: p } = globalThis`, `import { history as h }`: the key names a property (globalThis is caught).
  if ((ts.isBindingElement(p) || ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) && p.propertyName === id) return false;
  // { location: … }, class fields, methods, parameters, variables, imports: names being declared.
  const declares =
    ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) ||
    ts.isMethodSignature(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p) || ts.isParameter(p) ||
    ts.isVariableDeclaration(p) || ts.isBindingElement(p) || ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) ||
    ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isEnumMember(p) || ts.isImportSpecifier(p) ||
    ts.isExportSpecifier(p);
  if (declares && (p as ts.NamedDeclaration).name === id) return false;
  // Reason: types are erased by the compiler; `ctx: AudioContext` reaches nothing at run time.
  for (let n: ts.Node = p; !ts.isSourceFile(n); n = n.parent) if (ts.isTypeNode(n)) return false;
  return true;
}

/** The browser globals the code of `text` reads, as "line: name". */
function globalReads(name: string, text: string): string[] {
  const sf = parse(name, text);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && BROWSER_GLOBALS.has(node.text) && readsVariable(node)) {
      found.push(`${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** The src/ modules `file` loads at run time: imports, re-exports and import() calls, but not `import type`. */
function runtimeImports(file: string, text: string): string[] {
  const out: string[] = [];
  const add = (spec: ts.Expression | undefined) => {
    if (spec && ts.isStringLiteral(spec) && spec.text.startsWith('.')) out.push(normalize(join(dirname(file), spec.text)).split('\\').join('/'));
  };
  const visit = (node: ts.Node): void => {
    // Reason: with verbatimModuleSyntax, `import { type X }` still loads the module; only `import type` is dropped.
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) add(node.moduleSpecifier);
    else if (ts.isExportDeclaration(node) && !node.isTypeOnly) add(node.moduleSpecifier);
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(parse(file, text));
  return out;
}

/** Every module `entry` loads at run time, itself included. */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...runtimeImports(file, readFileSync(new URL(file, SRC), 'utf8')));
  }
  return seen;
}

describe('platform boundary', () => {
  it('finds code that reads a browser global, and only that', () => {
    const sample = [
      '// window.alert in a comment, and document.title in a string:',
      "const s = 'document.title';",
      'this.history.push(1);',
      'class A { private readonly history = 1; location() {} }',
      'const o = { location: 1, navigator: 2 };',
      'let ctx: AudioContext | null = null;',
      "document.createElement('canvas');",
      "if (typeof window !== 'undefined') ctx = null;",
      'const w = (window as unknown as { a: number }).a;',
      'const { performance: p } = globalThis;',
      "localStorage.getItem('k');",
      'requestAnimationFrame(() => {});',
      "const o2 = { document };",
    ].join('\n');
    expect(globalReads('sample.ts', sample)).toEqual([
      '7: document',
      '8: window',
      '9: window',
      '10: globalThis',
      '11: localStorage',
      '12: requestAnimationFrame',
      '13: document',
    ]);
  });

  it('keeps browser globals in the web entry and the browser half of src/platform/', () => {
    const files = sourceFiles();
    expect(files).toContain('ui/scenes.ts');
    for (const file of WEB_PLATFORM) expect(files, file).toContain(file);
    const offenders = files
      .filter((file) => !WEB_PLATFORM.includes(file))
      .flatMap((file) => globalReads(file, readFileSync(new URL(file, SRC), 'utf8')).map((hit) => `src/${file}:${hit}`));
    expect(offenders).toEqual([]);
    // Reason: proves the scan reads real files: the web platform does use the browser.
    expect(globalReads('platform/web.ts', readFileSync(new URL('platform/web.ts', SRC), 'utf8')).length).toBeGreaterThan(5);
  });

  it('starts the game (boot.ts) without loading any web-only module', () => {
    const shared = reachable('boot.ts');
    // The whole game is in there: every screen, the renderer, the simulation and the shared platform modules.
    for (const file of ['ui/scenes.ts', 'ui/game-scene.ts', 'render/renderer.ts', 'core/game.ts', 'platform/env.ts', 'platform/audio.ts', 'platform/progress.ts']) {
      expect(shared, file).toContain(file);
    }
    expect([...shared].filter(isWebOnly)).toEqual([]);
    // Reason: proves the walk follows imports: the web entry does reach the editor and the web platform.
    const web = reachable('main.ts');
    for (const file of ['boot.ts', 'ui/editor-scene.ts', 'render/editor-draw.ts', 'platform/web.ts', 'platform/web-input.ts', 'platform/pwa.ts', 'platform/share.ts']) {
      expect(web, file).toContain(file);
    }
  });
});
