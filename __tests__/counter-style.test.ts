import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parseICBINCSS } from '../src/parser/index';
import { compileToCss, compileDbToCss } from '../src/compiler/index';
import { ensureDb, initEmptyDb, loadDb } from '../src/db/store';
import { applyMigrationFile } from '../src/migrate/engine';

function mkproj(prefix = 'icbincss-counter-style-test-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'up'));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'down'));
  return dir;
}

describe('@counter-style (Custom List Counters)', () => {
  it('emits @counter-style with numeric system', () => {
    const sql = [
      'CREATE COUNTER_STYLE circled_numbers (',
      '  system = numeric,',
      "  symbols = '①' '②' '③',",
      "  suffix = ' '",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@counter-style circled_numbers {');
    expect(css).toContain('  system: numeric;');
    expect(css).toContain("  symbols: '①' '②' '③';");
    expect(css).toContain("  suffix: ' ';");
    expect(css).toContain('}');
  });

  it('emits @counter-style with cyclic system', () => {
    const sql = [
      'CREATE COUNTER_STYLE custom_bullets (',
      '  system = cyclic,',
      "  symbols = '✓' '✗' '→'",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@counter-style custom_bullets {');
    expect(css).toContain('  system: cyclic;');
    expect(css).toContain("  symbols: '✓' '✗' '→';");
  });

  it('emits @counter-style with multiple properties', () => {
    const sql = [
      'CREATE COUNTER_STYLE fancy (',
      '  system = alphabetic,',
      "  symbols = 'a' 'b' 'c',",
      "  prefix = '(',",
      "  suffix = ')'",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@counter-style fancy {');
    expect(css).toContain('  system: alphabetic;');
    expect(css).toContain("  symbols: 'a' 'b' 'c';");
    expect(css).toContain("  prefix: '(';");
    expect(css).toContain("  suffix: ')';");
  });

  it('emits @counter-style with additive system', () => {
    const sql = [
      'CREATE COUNTER_STYLE roman (',
      '  system = additive,',
      "  additive_symbols = '1000' 'M' '500' 'D' '100' 'C'",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@counter-style roman {');
    expect(css).toContain('  system: additive;');
    expect(css).toContain("  additive-symbols: '1000' 'M' '500' 'D' '100' 'C';");
  });

  it('handles DROP COUNTER_STYLE', () => {
    const sql = [
      'CREATE COUNTER_STYLE foo (',
      '  system = cyclic,',
      "  symbols = 'x'",
      ');',
      'DROP COUNTER_STYLE foo;',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).not.toContain('@counter-style foo');
    expect(css).not.toContain('system: cyclic');
  });

  it('DROP COUNTER_STYLE only removes the matching counter', () => {
    const sql = [
      'CREATE COUNTER_STYLE foo (',
      '  system = cyclic,',
      "  symbols = 'x'",
      ');',
      'CREATE COUNTER_STYLE bar (',
      '  system = numeric,',
      "  symbols = '1' '2'",
      ');',
      'DROP COUNTER_STYLE foo;',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    // foo should be removed
    expect(css).not.toContain('@counter-style foo');
    // bar should still exist
    expect(css).toContain('@counter-style bar {');
    expect(css).toContain('  system: numeric;');
  });

  it('emits multiple @counter-style rules', () => {
    const sql = [
      'CREATE COUNTER_STYLE one (',
      '  system = cyclic,',
      "  symbols = 'a'",
      ');',
      'CREATE COUNTER_STYLE two (',
      '  system = numeric,',
      "  symbols = '1' '2'",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@counter-style one {');
    expect(css).toContain('  system: cyclic;');
    expect(css).toContain('@counter-style two {');
    expect(css).toContain('  system: numeric;');
  });

  it('persists counter styles in DB and compiles equivalently', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__counters.sql');
    const sql = [
      'CREATE COUNTER_STYLE custom (',
      '  system = numeric,',
      "  symbols = '①' '②' '③'",
      ');',
      "CREATE SELECTOR list AS C('list');",
      'CREATE STYLE SELECTOR list ( list_style_type = custom );',
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

  it('stores counter styles in database with correct fields', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__test.sql');
    const sql = [
      'CREATE COUNTER_STYLE one (',
      '  system = cyclic,',
      "  symbols = 'x'",
      ');',
      'CREATE COUNTER_STYLE two (',
      '  system = numeric,',
      "  symbols = '1' '2',",
      "  suffix = '.'",
      ');',
    ].join('\n');
    fs.writeFileSync(upPath, sql, 'utf8');
    ensureDb(root);
    initEmptyDb(root);
    await applyMigrationFile(root, upPath, 'up');

    const db = loadDb(root);
    expect(db.counter_styles).toHaveLength(2);

    // First counter style
    expect(db.counter_styles[0].name).toBe('one');
    expect(JSON.parse(db.counter_styles[0].props_json)).toEqual([
      { name: 'system', value: 'cyclic' },
      { name: 'symbols', value: "'x'" }
    ]);

    // Second counter style
    expect(db.counter_styles[1].name).toBe('two');
    expect(JSON.parse(db.counter_styles[1].props_json)).toEqual([
      { name: 'system', value: 'numeric' },
      { name: 'symbols', value: "'1' '2'" },
      { name: 'suffix', value: "'.'" }
    ]);
  });

  it('supports complex counter style properties', () => {
    const sql = [
      'CREATE COUNTER_STYLE complex (',
      '  system = fixed,',
      "  symbols = '➀' '➁' '➂' '➃' '➄',",
      "  range = '1' '5',",
      "  fallback = decimal,",
      "  prefix = '№',",
      "  suffix = '. ',",
      "  pad = '2' '0',",
      "  speak_as = numbers",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@counter-style complex {');
    expect(css).toContain('  system: fixed;');
    expect(css).toContain("  symbols: '➀' '➁' '➂' '➃' '➄';");
    expect(css).toContain("  range: '1' '5';");
    expect(css).toContain('  fallback: decimal;');
    expect(css).toContain("  prefix: '№';");
    expect(css).toContain("  suffix: '. ';");
    expect(css).toContain("  pad: '2' '0';");
    expect(css).toContain('  speak-as: numbers;');
  });

  it('handles negative property for counter styles', () => {
    const sql = [
      'CREATE COUNTER_STYLE signed (',
      '  system = numeric,',
      "  symbols = '0' '1' '2',",
      "  negative = '-' ''",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@counter-style signed {');
    expect(css).toContain("  negative: '-' '';");
  });
});
