import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { parseICBINCSS } from '../src/parser/index';
import { compileToCss, compileDbToCss } from '../src/compiler/index';
import { ensureDb, initEmptyDb, loadDb, saveDb } from '../src/db/store';
import { applyMigrationFile, rebuildDbFromFiles } from '../src/migrate/engine';

function mkproj(prefix = 'icbincss-dbtest-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'up'));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'down'));
  return dir;
}

describe('DB pipeline', () => {
  it('applies an UP migration and compiles from DB equal to direct compile', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_000000__bootstrap.sql');
    const sql = [
      "CREATE TOKEN 'brand/500' VALUE #2266ee;",
      "CREATE SELECTOR btn AS AND(E('button'), C('primary'));",
      "CREATE STYLE SELECTOR btn (",
      "  background = token('brand/500'),",
      "  color = #fff",
      ");",
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

  it('persists font-face, keyframes, and RAW into DB and compiles equivalently', async () => {
    const root = mkproj();
    const upPath = path.join(root, 'icbincss', 'migrations', 'up', '20240904_010000__assets.sql');
    const sql = [
      "CREATE FONT_FACE family 'Inter' ( src = url('inter.woff2'), font_weight = 400 );",
      "CREATE KEYFRAMES fade (",
      "  '0%' ( opacity = 0 ),",
      "  '100%' ( opacity = 1 )",
      ");",
      "RAW '@supports (display: grid) { .grid { display: grid; } }'",
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

  it('rebuilds DB from migrations history to the same CSS', async () => {
    const root = mkproj();
    const up1 = path.join(root, 'icbincss', 'migrations', 'up', '20240904_020000__one.sql');
    const up2 = path.join(root, 'icbincss', 'migrations', 'up', '20240904_030000__two.sql');
    const sql1 = [
      "CREATE TOKEN 't/1' VALUE 10px;",
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card ( padding = token('t/1') );",
    ].join('\n');
    const sql2 = [
      "ALTER STYLE SELECTOR card SET padding = 12px;",
    ].join('\n');
    fs.writeFileSync(up1, sql1, 'utf8');
    fs.writeFileSync(up2, sql2, 'utf8');
    ensureDb(root);
    initEmptyDb(root);
    await applyMigrationFile(root, up1, 'up');
    await applyMigrationFile(root, up2, 'up');

    // CSS before rebuild
    let db = loadDb(root);
    const before = compileDbToCss(db as any);

    // Simulate fresh DB and rebuild from history
    saveDb(root, { migrations: db.migrations, tokens: [], selectors: [], layers: [], styles: [], font_faces: [], keyframes: [], raw_blocks: [], imports: [], pages: [], counter_styles: [], font_feature_values: [], font_palette_values: [], starting_styles: [] } as any);
    rebuildDbFromFiles(root);
    db = loadDb(root);
    const after = compileDbToCss(db as any);
    expect(after).toBe(before);
  });
});

