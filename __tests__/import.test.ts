import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parseICBINCSS } from '../src/parser/index';
import { compileToCss, compileDbToCss } from '../src/compiler/index';
import { ensureDb, initEmptyDb, loadDb } from '../src/db/store';
import { applyMigrationFile } from '../src/migrate/engine';

function mkproj(prefix = 'icbincss-import-test-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'up'));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'down'));
  return dir;
}

describe('@import support', () => {
  it('emits @import for CSS imports without media', () => {
    const sql = "IMPORT CSS 'styles.css';";
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain("@import url('styles.css');");
  });

  it('emits @import for CSS imports with media query', () => {
    const sql = "IMPORT CSS 'print.css' media print;";
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain("@import url('print.css') print;");
  });

  it('does not emit SQL imports in CSS output', () => {
    const sql = "IMPORT 'base.sql';";
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).not.toContain('base.sql');
    expect(css).not.toContain('@import');
  });

  it('emits multiple CSS imports', () => {
    const sql = [
      "IMPORT CSS 'reset.css';",
      "IMPORT CSS 'theme.css';",
      "IMPORT CSS 'print.css' media print;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain("@import url('reset.css');");
    expect(css).toContain("@import url('theme.css');");
    expect(css).toContain("@import url('print.css') print;");
  });

  it('emits @import at the very top before all other rules', () => {
    const sql = [
      "CREATE TOKEN 'primary-color' VALUE #3b82f6;",
      "IMPORT CSS 'base.css';",
      "CREATE PROPERTY '--spacing' (",
      "  syntax = '<length>',",
      "  inherits = true,",
      "  initial_value = 16px",
      ");",
      "CREATE SELECTOR button AS C('button');",
      "CREATE STYLE SELECTOR button ( background = blue );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));

    // @import should be first
    const importIndex = css.indexOf("@import url('base.css')");
    const rootIndex = css.indexOf(':root');
    const propertyIndex = css.indexOf('@property');
    const buttonIndex = css.indexOf('.button');

    expect(importIndex).toBeGreaterThan(-1);
    expect(importIndex).toBeLessThan(rootIndex);
    if (propertyIndex !== -1) {
      expect(importIndex).toBeLessThan(propertyIndex);
    }
    expect(importIndex).toBeLessThan(buttonIndex);
  });

  it('mixes SQL imports and CSS imports', () => {
    const sql = [
      "IMPORT 'base.sql';",
      "IMPORT CSS 'fonts.css';",
      "CREATE TOKEN 'color-primary' VALUE red;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));

    // CSS import should appear
    expect(css).toContain("@import url('fonts.css');");
    // SQL import should not appear
    expect(css).not.toContain('base.sql');
    // Token should still work
    expect(css).toContain('--color-primary: red');
  });

  it('handles imports with various media types', () => {
    const sql = [
      "IMPORT CSS 'screen.css' media screen;",
      "IMPORT CSS 'print.css' media print;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain("@import url('screen.css') screen;");
    expect(css).toContain("@import url('print.css') print;");
  });

  it('persists imports in DB and compiles equivalently', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__imports.sql');
    const sql = [
      "IMPORT CSS 'base.css';",
      "IMPORT CSS 'print.css' media print;",
      "IMPORT 'utilities.sql';",
      "CREATE TOKEN 'primary' VALUE blue;",
      "CREATE SELECTOR btn AS C('btn');",
      "CREATE STYLE SELECTOR btn ( color = blue );",
    ].join('\n');
    fs.writeFileSync(upPath, sql, 'utf8');
    ensureDb(root);
    initEmptyDb(root);
    await applyMigrationFile(root, upPath, 'up');

    const db = loadDb(root);
    const cssFromDb = compileDbToCss(db as any);
    const cssDirect = compileToCss(parseICBINCSS(sql));
    expect(cssFromDb).toBe(cssDirect);
  });

  it('stores imports in database with correct fields', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__test.sql');
    const sql = [
      "IMPORT CSS 'fonts.css';",
      "IMPORT CSS 'print.css' media print;",
      "IMPORT 'base.sql';",
    ].join('\n');
    fs.writeFileSync(upPath, sql, 'utf8');
    ensureDb(root);
    initEmptyDb(root);
    await applyMigrationFile(root, upPath, 'up');

    const db = loadDb(root);
    expect(db.imports).toHaveLength(3);

    // CSS import without media
    expect(db.imports[0].import_type).toBe('css');
    expect(db.imports[0].path).toBe('fonts.css');
    expect(db.imports[0].media).toBe('');

    // CSS import with media
    expect(db.imports[1].import_type).toBe('css');
    expect(db.imports[1].path).toBe('print.css');
    expect(db.imports[1].media).toBe('print');

    // SQL import
    expect(db.imports[2].import_type).toBe('sql');
    expect(db.imports[2].path).toBe('base.sql');
    expect(db.imports[2].media).toBe('');
  });
});
