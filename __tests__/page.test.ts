import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parseICBINCSS } from '../src/parser/index';
import { compileToCss, compileDbToCss } from '../src/compiler/index';
import { ensureDb, initEmptyDb, loadDb } from '../src/db/store';
import { applyMigrationFile } from '../src/migrate/engine';

function mkproj(prefix = 'icbincss-page-test-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'up'));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'down'));
  return dir;
}

describe('@page (Print Styling)', () => {
  it('emits @page with default page margins', () => {
    const sql = [
      'CREATE PAGE (',
      '  margin = 2cm',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@page {');
    expect(css).toContain('  margin: 2cm;');
    expect(css).toContain('}');
  });

  it('emits @page with :first pseudo-class', () => {
    const sql = [
      "CREATE PAGE ':first' (",
      '  margin_top = 5cm',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@page :first {');
    expect(css).toContain('  margin-top: 5cm;');
  });

  it('emits @page with :left pseudo-class', () => {
    const sql = [
      "CREATE PAGE ':left' (",
      '  margin_left = 3cm',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@page :left {');
    expect(css).toContain('  margin-left: 3cm;');
  });

  it('emits @page with :right pseudo-class', () => {
    const sql = [
      "CREATE PAGE ':right' (",
      '  margin_right = 3cm',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@page :right {');
    expect(css).toContain('  margin-right: 3cm;');
  });

  it('emits multiple @page rules', () => {
    const sql = [
      'CREATE PAGE (',
      '  size = A4 portrait,',
      '  margin = 2cm',
      ');',
      "CREATE PAGE ':first' (",
      '  margin_top = 5cm',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@page {');
    expect(css).toContain('  size: A4 portrait;');
    expect(css).toContain('  margin: 2cm;');
    expect(css).toContain('@page :first {');
    expect(css).toContain('  margin-top: 5cm;');
  });

  it('handles DROP PAGE to remove default page', () => {
    const sql = [
      'CREATE PAGE (',
      '  margin = 2cm',
      ');',
      'DROP PAGE;',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).not.toContain('@page {');
    expect(css).not.toContain('margin: 2cm');
  });

  it('handles DROP PAGE with pseudo-class', () => {
    const sql = [
      "CREATE PAGE ':first' (",
      '  margin_top = 5cm',
      ');',
      "DROP PAGE ':first';",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).not.toContain('@page :first');
    expect(css).not.toContain('margin-top: 5cm');
  });

  it('DROP PAGE only removes the matching pseudo-class', () => {
    const sql = [
      'CREATE PAGE (',
      '  margin = 2cm',
      ');',
      "CREATE PAGE ':first' (",
      '  margin_top = 5cm',
      ');',
      "DROP PAGE ':first';",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    // Default page should still exist
    expect(css).toContain('@page {');
    expect(css).toContain('  margin: 2cm;');
    // :first should be removed
    expect(css).not.toContain('@page :first');
    expect(css).not.toContain('margin-top');
  });

  it('persists pages in DB and compiles equivalently', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__pages.sql');
    const sql = [
      'CREATE PAGE (',
      '  size = A4,',
      '  margin = 2cm',
      ');',
      "CREATE PAGE ':first' (",
      '  margin_top = 5cm',
      ');',
      "CREATE SELECTOR card AS C('card');",
      'CREATE STYLE SELECTOR card ( padding = 16px );',
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

  it('stores pages in database with correct fields', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__test.sql');
    const sql = [
      'CREATE PAGE (',
      '  margin = 2cm',
      ');',
      "CREATE PAGE ':first' (",
      '  margin_top = 5cm',
      ');',
      "CREATE PAGE ':left' (",
      '  margin_left = 3cm',
      ');',
    ].join('\n');
    fs.writeFileSync(upPath, sql, 'utf8');
    ensureDb(root);
    initEmptyDb(root);
    await applyMigrationFile(root, upPath, 'up');

    const db = loadDb(root);
    expect(db.pages).toHaveLength(3);

    // Default page (no pseudo)
    expect(db.pages[0].pseudo).toBe('');
    expect(JSON.parse(db.pages[0].props_json)).toEqual([
      { name: 'margin', value: '2cm' }
    ]);

    // :first page
    expect(db.pages[1].pseudo).toBe(':first');
    expect(JSON.parse(db.pages[1].props_json)).toEqual([
      { name: 'margin_top', value: '5cm' }
    ]);

    // :left page
    expect(db.pages[2].pseudo).toBe(':left');
    expect(JSON.parse(db.pages[2].props_json)).toEqual([
      { name: 'margin_left', value: '3cm' }
    ]);
  });

  it('supports complex page properties', () => {
    const sql = [
      'CREATE PAGE (',
      '  size = A4 landscape,',
      '  margin_top = 2.5cm,',
      '  margin_bottom = 2.5cm,',
      '  margin_left = 2cm,',
      '  margin_right = 2cm',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@page {');
    expect(css).toContain('  size: A4 landscape;');
    expect(css).toContain('  margin-top: 2.5cm;');
    expect(css).toContain('  margin-bottom: 2.5cm;');
    expect(css).toContain('  margin-left: 2cm;');
    expect(css).toContain('  margin-right: 2cm;');
  });
});
