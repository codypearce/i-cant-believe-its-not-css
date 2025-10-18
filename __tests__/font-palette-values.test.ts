import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parseICBINCSS } from '../src/parser/index';
import { compileToCss, compileDbToCss } from '../src/compiler/index';
import { ensureDb, initEmptyDb, loadDb } from '../src/db/store';
import { applyMigrationFile } from '../src/migrate/engine';

function mkproj(prefix = 'icbincss-fpv-test-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'up'));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'down'));
  return dir;
}

describe('@font-palette-values (Color Fonts)', () => {
  it('emits @font-palette-values with font-family', () => {
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--my-palette' (",
      "  font_family = 'Noto Color Emoji'",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-palette-values --my-palette {');
    expect(css).toContain("  font-family: 'Noto Color Emoji';");
    expect(css).toContain('}');
  });

  it('emits @font-palette-values with base-palette', () => {
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--theme-dark' (",
      "  font_family = 'Bigelow Rules',",
      '  base_palette = 2',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-palette-values --theme-dark {');
    expect(css).toContain("  font-family: 'Bigelow Rules';");
    expect(css).toContain('  base-palette: 2;');
  });

  it('emits @font-palette-values with override-colors', () => {
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--custom-colors' (",
      "  font_family = 'MyFont',",
      "  override_colors = '0 #ff0000, 1 #00ff00, 2 #0000ff'",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-palette-values --custom-colors {');
    expect(css).toContain("  font-family: 'MyFont';");
    expect(css).toContain("  override-colors: '0 #ff0000, 1 #00ff00, 2 #0000ff';");
  });

  it('emits @font-palette-values with all descriptors', () => {
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--complete' (",
      "  font_family = 'Color Font',",
      '  base_palette = 3,',
      "  override_colors = '0 red, 1 blue'",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-palette-values --complete {');
    expect(css).toContain("  font-family: 'Color Font';");
    expect(css).toContain('  base-palette: 3;');
    expect(css).toContain("  override-colors: '0 red, 1 blue';");
  });

  it('handles DROP FONT_PALETTE_VALUES', () => {
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--palette-a' (",
      "  font_family = 'Font A'",
      ');',
      "DROP FONT_PALETTE_VALUES '--palette-a';",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).not.toContain('@font-palette-values --palette-a');
    expect(css).not.toContain("font-family: 'Font A'");
  });

  it('DROP FONT_PALETTE_VALUES only removes the matching palette', () => {
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--palette-a' (",
      "  font_family = 'Font A'",
      ');',
      "CREATE FONT_PALETTE_VALUES '--palette-b' (",
      "  font_family = 'Font B'",
      ');',
      "DROP FONT_PALETTE_VALUES '--palette-a';",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    // Palette A should be removed
    expect(css).not.toContain('@font-palette-values --palette-a');
    expect(css).not.toContain("font-family: 'Font A'");
    // Palette B should still exist
    expect(css).toContain('@font-palette-values --palette-b {');
    expect(css).toContain("  font-family: 'Font B';");
  });

  it('emits multiple @font-palette-values declarations', () => {
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--palette-one' (",
      "  font_family = 'Font One',",
      '  base_palette = 1',
      ');',
      "CREATE FONT_PALETTE_VALUES '--palette-two' (",
      "  font_family = 'Font Two',",
      '  base_palette = 2',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-palette-values --palette-one {');
    expect(css).toContain("  font-family: 'Font One';");
    expect(css).toContain('  base-palette: 1;');
    expect(css).toContain('@font-palette-values --palette-two {');
    expect(css).toContain("  font-family: 'Font Two';");
    expect(css).toContain('  base-palette: 2;');
  });

  it('supports kebab-case conversion for property names', () => {
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--test' (",
      "  font_family = 'Test',",
      '  base_palette = 1,',
      "  override_colors = '0 red'",
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    // Verify underscores are converted to kebab-case
    expect(css).toContain('font-family:');
    expect(css).toContain('base-palette:');
    expect(css).toContain('override-colors:');
    expect(css).not.toContain('font_family');
    expect(css).not.toContain('base_palette');
    expect(css).not.toContain('override_colors');
  });

  it('persists font palette values in DB and compiles equivalently', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__fpv.sql');
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--emoji' (",
      "  font_family = 'Noto Color Emoji',",
      '  base_palette = 1,',
      "  override_colors = '0 #ff6b6b'",
      ');',
      "CREATE SELECTOR text AS C('text');",
      'CREATE STYLE SELECTOR text ( font_palette = "--emoji" );',
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

  it('stores font palette values in database with correct fields', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__test.sql');
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--palette-one' (",
      "  font_family = 'Font One'",
      ');',
      "CREATE FONT_PALETTE_VALUES '--palette-two' (",
      "  font_family = 'Font Two',",
      '  base_palette = 2,',
      "  override_colors = '0 red, 1 blue'",
      ');',
    ].join('\n');
    fs.writeFileSync(upPath, sql, 'utf8');
    ensureDb(root);
    initEmptyDb(root);
    await applyMigrationFile(root, upPath, 'up');

    const db = loadDb(root);
    expect(db.font_palette_values).toHaveLength(2);

    // First font palette values
    expect(db.font_palette_values[0].name).toBe('--palette-one');
    expect(JSON.parse(db.font_palette_values[0].props_json)).toEqual([
      { name: 'font_family', value: "'Font One'" }
    ]);

    // Second font palette values
    expect(db.font_palette_values[1].name).toBe('--palette-two');
    expect(JSON.parse(db.font_palette_values[1].props_json)).toEqual([
      { name: 'font_family', value: "'Font Two'" },
      { name: 'base_palette', value: '2' },
      { name: 'override_colors', value: "'0 red, 1 blue'" }
    ]);
  });

  it('handles quoted palette names', () => {
    const sql = [
      "CREATE FONT_PALETTE_VALUES '--my-custom-palette' (",
      "  font_family = 'Emoji Font',",
      '  base_palette = dark',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-palette-values --my-custom-palette {');
    expect(css).toContain("  font-family: 'Emoji Font';");
    expect(css).toContain('  base-palette: dark;');
  });
});
