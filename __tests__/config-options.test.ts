import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { listSqlFiles } from '../src/cli/fileDiscovery';
import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Config options', () => {
  it('listSqlFiles honors include/exclude globs and ordering', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icbincss-test-'));
    const root = tmp;
    const icb = path.join(root, 'icbincss');
    const mig = path.join(icb, 'migrations');
    const exp = path.join(mig, 'experimental');
    fs.ensureDirSync(exp);
    // create files
    fs.writeFileSync(path.join(icb, 'tokens.sql'), '-- tokens');
    fs.writeFileSync(path.join(icb, 'selectors.sql'), '-- selectors');
    fs.writeFileSync(path.join(mig, '001_init.sql'), '-- 001');
    fs.writeFileSync(path.join(mig, '002_more.sql'), '-- 002');
    fs.writeFileSync(path.join(exp, 'alpha.sql'), '-- experimental');

    // include only migrations and tokens; exclude experimental
    const cfg = {
      includeGlobs: ['icbincss/tokens.sql', 'icbincss/migrations/**/*.sql'],
      excludeGlobs: ['icbincss/migrations/experimental/*.sql'],
    };
    const files = listSqlFiles(root, cfg);
    const rel = (p: string) => p.split(path.sep).join('/').slice(root.length + 1);
    expect(files.map(rel)).toEqual([
      'icbincss/tokens.sql',
      'icbincss/migrations/001_init.sql',
      'icbincss/migrations/002_more.sql',
    ]);
  });

  it('compiler honors ICBINCSS_DEFAULT_LAYERS for emission order', () => {
    const sql = [
      "SET LAYER = components;",
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card ( color = blue );",
    ].join('\n');
    const prev = process.env.ICBINCSS_DEFAULT_LAYERS;
    process.env.ICBINCSS_DEFAULT_LAYERS = 'base,components,overrides';
    try {
      const css = compileToCss(parseICBINCSS(sql));
      const expected = [
        '@layer components {',
        '.card {',
        '  color: blue;',
        '}',
        '',
        '}',
        '',
      ].join('\n');
      expect(css).toBe(expected);
    } finally {
      if (prev == null) delete process.env.ICBINCSS_DEFAULT_LAYERS; else process.env.ICBINCSS_DEFAULT_LAYERS = prev;
    }
  });

  it('compiler honors ICBINCSS_TOKEN_PREFIX for token var names', () => {
    const sql = [
      "CREATE TOKEN 'brand/500' VALUE #2266ee;",
      "CREATE SELECTOR btn AS E('button');",
      "CREATE STYLE SELECTOR btn ( background = token('brand/500') );",
    ].join('\n');
    const prev = process.env.ICBINCSS_TOKEN_PREFIX;
    process.env.ICBINCSS_TOKEN_PREFIX = 'ux-';
    try {
      const css = compileToCss(parseICBINCSS(sql));
      const expected = [
        ':root {',
        '  --ux-brand-500: #2266ee;',
        '}',
        '',
        'button {',
        '  background: var(--ux-brand-500);',
        '}',
        '',
      ].join('\n');
      expect(css).toBe(expected);
    } finally {
      if (prev == null) delete process.env.ICBINCSS_TOKEN_PREFIX; else process.env.ICBINCSS_TOKEN_PREFIX = prev;
    }
  });
});

