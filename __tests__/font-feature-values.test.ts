import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parseICBINCSS } from '../src/parser/index';
import { compileToCss, compileDbToCss } from '../src/compiler/index';
import { ensureDb, initEmptyDb, loadDb } from '../src/db/store';
import { applyMigrationFile } from '../src/migrate/engine';

function mkproj(prefix = 'icbincss-ffv-test-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'up'));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'down'));
  return dir;
}

describe('@font-feature-values (Font Features)', () => {
  it('emits @font-feature-values with @swash block', () => {
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Fancy Font' (",
      '  swash_fancy = 1',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-feature-values "Fancy Font" {');
    expect(css).toContain('  @swash {');
    expect(css).toContain('    fancy: 1;');
    expect(css).toContain('  }');
    expect(css).toContain('}');
  });

  it('emits @font-feature-values with @styleset block', () => {
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'My Font' (",
      '  styleset_nice = 12,',
      '  styleset_cool = 14',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-feature-values "My Font" {');
    expect(css).toContain('  @styleset {');
    expect(css).toContain('    nice: 12;');
    expect(css).toContain('    cool: 14;');
  });

  it('emits @font-feature-values with multiple block types', () => {
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Complex Font' (",
      '  swash_fancy = 1,',
      '  styleset_double_W = 14,',
      '  styleset_sharp_terminals = 16,',
      '  ornaments_fleurons = 1',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-feature-values "Complex Font" {');
    expect(css).toContain('  @swash {');
    expect(css).toContain('    fancy: 1;');
    expect(css).toContain('  @styleset {');
    expect(css).toContain('    double_W: 14;');
    expect(css).toContain('    sharp_terminals: 16;');
    expect(css).toContain('  @ornaments {');
    expect(css).toContain('    fleurons: 1;');
  });

  it('emits @font-feature-values with @annotation block', () => {
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Annotated Font' (",
      '  annotation_circled = 1',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-feature-values "Annotated Font" {');
    expect(css).toContain('  @annotation {');
    expect(css).toContain('    circled: 1;');
  });

  it('emits @font-feature-values with @stylistic block', () => {
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Styled Font' (",
      '  stylistic_alt = 5',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-feature-values "Styled Font" {');
    expect(css).toContain('  @stylistic {');
    expect(css).toContain('    alt: 5;');
  });

  it('emits @font-feature-values with @character-variant block', () => {
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Variant Font' (",
      '  character_variant_alpha = 1',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-feature-values "Variant Font" {');
    expect(css).toContain('  @character {');
    expect(css).toContain('    variant_alpha: 1;');
  });

  it('handles DROP FONT_FEATURE_VALUES', () => {
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Font A' (",
      '  swash_x = 1',
      ');',
      "DROP FONT_FEATURE_VALUES 'Font A';",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).not.toContain('@font-feature-values "Font A"');
    expect(css).not.toContain('swash');
  });

  it('DROP FONT_FEATURE_VALUES only removes the matching font family', () => {
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Font A' (",
      '  swash_x = 1',
      ');',
      "CREATE FONT_FEATURE_VALUES 'Font B' (",
      '  swash_y = 2',
      ');',
      "DROP FONT_FEATURE_VALUES 'Font A';",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    // Font A should be removed
    expect(css).not.toContain('@font-feature-values "Font A"');
    // Font B should still exist
    expect(css).toContain('@font-feature-values "Font B" {');
    expect(css).toContain('  @swash {');
    expect(css).toContain('    y: 2;');
  });

  it('emits multiple @font-feature-values for different fonts', () => {
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Font One' (",
      '  swash_a = 1',
      ');',
      "CREATE FONT_FEATURE_VALUES 'Font Two' (",
      '  styleset_b = 2',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-feature-values "Font One" {');
    expect(css).toContain('@font-feature-values "Font Two" {');
    expect(css).toContain('  @swash {');
    expect(css).toContain('    a: 1;');
    expect(css).toContain('  @styleset {');
    expect(css).toContain('    b: 2;');
  });

  it('persists font feature values in DB and compiles equivalently', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__ffv.sql');
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Test Font' (",
      '  swash_fancy = 1,',
      '  styleset_nice = 12',
      ');',
      "CREATE SELECTOR text AS C('text');",
      'CREATE STYLE SELECTOR text ( font_family = "Test Font" );',
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

  it('stores font feature values in database with correct fields', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__test.sql');
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Font One' (",
      '  swash_x = 1',
      ');',
      "CREATE FONT_FEATURE_VALUES 'Font Two' (",
      '  styleset_a = 2,',
      '  styleset_b = 3,',
      '  swash_y = 4',
      ');',
    ].join('\n');
    fs.writeFileSync(upPath, sql, 'utf8');
    ensureDb(root);
    initEmptyDb(root);
    await applyMigrationFile(root, upPath, 'up');

    const db = loadDb(root);
    expect(db.font_feature_values).toHaveLength(2);

    // First font feature values
    expect(db.font_feature_values[0].family).toBe('Font One');
    expect(JSON.parse(db.font_feature_values[0].features_json)).toEqual([
      { name: 'swash_x', value: '1' }
    ]);

    // Second font feature values
    expect(db.font_feature_values[1].family).toBe('Font Two');
    expect(JSON.parse(db.font_feature_values[1].features_json)).toEqual([
      { name: 'styleset_a', value: '2' },
      { name: 'styleset_b', value: '3' },
      { name: 'swash_y', value: '4' }
    ]);
  });

  it('supports underscores in feature names', () => {
    const sql = [
      "CREATE FONT_FEATURE_VALUES 'Font' (",
      '  styleset_double_W = 14,',
      '  styleset_sharp_terminals = 16',
      ');',
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@font-feature-values "Font" {');
    expect(css).toContain('  @styleset {');
    expect(css).toContain('    double_W: 14;');
    expect(css).toContain('    sharp_terminals: 16;');
  });
});
