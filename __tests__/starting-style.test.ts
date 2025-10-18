import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parseICBINCSS } from '../src/parser/index';
import { compileToCss, compileDbToCss } from '../src/compiler/index';
import { ensureDb, initEmptyDb, loadDb } from '../src/db/store';
import { applyMigrationFile } from '../src/migrate/engine';

function mkproj(prefix = 'icbincss-starting-test-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'up'));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'down'));
  return dir;
}

describe('@starting-style (Transition Starting States)', () => {
  it('emits @starting-style with single selector', () => {
    const sql = [
      "CREATE SELECTOR dialog AS C('dialog');",
      'CREATE STARTING_STYLE SELECTOR dialog (',
      '  opacity = 0',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@starting-style {');
    expect(css).toContain('  .dialog {');
    expect(css).toContain('    opacity: 0;');
    expect(css).toContain('  }');
    expect(css).toContain('}');
  });

  it('emits @starting-style with multiple properties', () => {
    const sql = [
      "CREATE SELECTOR modal AS C('modal');",
      'CREATE STARTING_STYLE SELECTOR modal (',
      '  opacity = 0,',
      '  transform = translateY(-20px)',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@starting-style {');
    expect(css).toContain('  .modal {');
    expect(css).toContain('    opacity: 0;');
    expect(css).toContain('    transform: translateY(-20px);');
  });

  it('emits @starting-style with multiple selectors', () => {
    const sql = [
      "CREATE SELECTOR dialog AS C('dialog');",
      "CREATE SELECTOR popover AS C('popover');",
      'CREATE STARTING_STYLE SELECTOR dialog (',
      '  opacity = 0',
      ');',
      'CREATE STARTING_STYLE SELECTOR popover (',
      '  opacity = 0,',
      '  transform = scale(0)',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@starting-style {');
    expect(css).toContain('  .dialog {');
    expect(css).toContain('    opacity: 0;');
    expect(css).toContain('  .popover {');
    expect(css).toContain('    transform: scale(0);');
  });

  it('handles DROP STARTING_STYLE', () => {
    const sql = [
      "CREATE SELECTOR modal AS C('modal');",
      'CREATE STARTING_STYLE SELECTOR modal (',
      '  opacity = 0',
      ');',
      'DROP STARTING_STYLE SELECTOR modal;',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).not.toContain('@starting-style');
    expect(css).not.toContain('opacity: 0');
  });

  it('DROP STARTING_STYLE only removes the matching selector', () => {
    const sql = [
      "CREATE SELECTOR modal AS C('modal');",
      "CREATE SELECTOR dialog AS C('dialog');",
      'CREATE STARTING_STYLE SELECTOR modal (',
      '  opacity = 0',
      ');',
      'CREATE STARTING_STYLE SELECTOR dialog (',
      '  opacity = 0',
      ');',
      'DROP STARTING_STYLE SELECTOR modal;',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    // Modal should be removed
    expect(css).not.toContain('.modal {');
    // Dialog should still exist
    expect(css).toContain('@starting-style {');
    expect(css).toContain('  .dialog {');
    expect(css).toContain('    opacity: 0;');
  });

  it('emits @starting-style for element selectors', () => {
    const sql = [
      "CREATE SELECTOR btn AS E('button');",
      'CREATE STARTING_STYLE SELECTOR btn (',
      '  transform = scale(0.8)',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@starting-style {');
    expect(css).toContain('  button {');
    expect(css).toContain('    transform: scale(0.8);');
  });

  it('emits @starting-style with pseudo selectors', () => {
    const sql = [
      "CREATE SELECTOR popover_open AS P('popover-open');",
      'CREATE STARTING_STYLE SELECTOR popover_open (',
      '  opacity = 0',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@starting-style {');
    expect(css).toContain('  :popover-open {');
    expect(css).toContain('    opacity: 0;');
  });

  it('supports transform properties', () => {
    const sql = [
      "CREATE SELECTOR item AS C('item');",
      'CREATE STARTING_STYLE SELECTOR item (',
      '  transform = translateY(-20px) scale(0.95)',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('transform: translateY(-20px) scale(0.95);');
  });

  it('supports background properties', () => {
    const sql = [
      "CREATE SELECTOR banner AS C('banner');",
      'CREATE STARTING_STYLE SELECTOR banner (',
      '  background_color = transparent',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('background-color: transparent;');
  });

  it('persists starting styles in DB and compiles equivalently', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__starting.sql');
    const sql = [
      "CREATE SELECTOR dialog AS C('dialog');",
      'CREATE STARTING_STYLE SELECTOR dialog (',
      '  opacity = 0,',
      '  transform = translateY(-20px)',
      ');',
      'CREATE STYLE SELECTOR dialog (',
      '  opacity = 1,',
      '  transform = translateY(0),',
      '  transition = all 0.3s',
      ');',
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

  it('stores starting styles in database with correct fields', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__test.sql');
    const sql = [
      "CREATE SELECTOR modal AS C('modal');",
      "CREATE SELECTOR popover AS C('popover');",
      'CREATE STARTING_STYLE SELECTOR modal (',
      '  opacity = 0',
      ');',
      'CREATE STARTING_STYLE SELECTOR popover (',
      '  opacity = 0,',
      '  transform = scale(0.8)',
      ');',
    ].join('\n');
    fs.writeFileSync(upPath, sql, 'utf8');
    ensureDb(root);
    initEmptyDb(root);
    await applyMigrationFile(root, upPath, 'up');

    const db = loadDb(root);
    expect(db.starting_styles).toHaveLength(2);

    // First starting style
    expect(db.starting_styles[0].selector_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const selector1 = db.selectors.find(s => s.id === db.starting_styles[0].selector_id);
    expect(selector1?.name).toBe('modal');
    expect(JSON.parse(db.starting_styles[0].props_json)).toEqual([
      { name: 'opacity', value: '0' }
    ]);

    // Second starting style
    expect(db.starting_styles[1].selector_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const selector2 = db.selectors.find(s => s.id === db.starting_styles[1].selector_id);
    expect(selector2?.name).toBe('popover');
    expect(JSON.parse(db.starting_styles[1].props_json)).toEqual([
      { name: 'opacity', value: '0' },
      { name: 'transform', value: 'scale(0.8)' }
    ]);
  });

  it('works with complex selectors', () => {
    const sql = [
      "CREATE SELECTOR dialog_open AS AND(C('dialog'), P('open'));",
      'CREATE STARTING_STYLE SELECTOR dialog_open (',
      '  opacity = 0',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@starting-style {');
    expect(css).toContain('  .dialog:open {');
    expect(css).toContain('    opacity: 0;');
  });

  it('does not emit @starting-style block when no starting styles defined', () => {
    const sql = [
      "CREATE SELECTOR btn AS C('btn');",
      'CREATE STYLE SELECTOR btn ( color = blue );',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).not.toContain('@starting-style');
  });
});
