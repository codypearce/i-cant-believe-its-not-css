#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function fail(msg) {
  console.error('[verify-dist] ' + msg);
  process.exit(1);
}

(async function main() {
  const root = process.cwd();
  const mustExist = [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/cli/index.js',
  ];
  for (const rel of mustExist) {
    const p = path.join(root, rel);
    if (!exists(p)) fail('Missing ' + rel);
  }
  // Import ESM build and check named exports
  let api;
  try {
    const url = pathToFileURL(path.join(root, 'dist/index.js')).href;
    api = await import(url);
  } catch (e) {
    fail('Cannot import dist/index.js: ' + (e && e.message));
  }
  const requiredFns = ['compileToCss', 'parseICBINCSS', 'icbincssVitePlugin', 'withICBINCSS'];
  for (const fn of requiredFns) {
    if (!(fn in api)) fail('Missing export: ' + fn);
  }
  console.log('[verify-dist] OK');
})();

