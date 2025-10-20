import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ensureDb, initEmptyDb, loadDb } from '../src/db/store';
import { applyMigrationFile } from '../src/migrate/engine';
import { compileDbToCss, compileToCss } from '../src/compiler/index';
import { parseICBINCSS } from '../src/parser/index';

function mkproj(prefix = 'icbincss-supports-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'up'));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'down'));
  return dir;
}

describe('supports() mixed with media/container', () => {
  it('persists supports_condition in DB and emits nested @supports with @media', async () => {
    const root = mkproj();
    const up = path.join(root, 'icbincss', 'migrations', 'up', '20251018_000000__supports_mix.sql');
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "ALTER STYLE SELECTOR card",
      "  WHERE supports(display: grid) AND width >= 768px",
      "  SET display = grid;",
    ].join('\n');
    fs.writeFileSync(up, sql, 'utf8');
    ensureDb(root);
    initEmptyDb(root);
    await applyMigrationFile(root, up, 'up');

    const db = loadDb(root);
    // DB should have supports_condition on the row
    const mixed = db.styles.find(r => r.prop === 'display');
    expect(mixed).toBeTruthy();
    expect(mixed?.resp_kind).toBe('media');
    expect(mixed?.resp_min).toBe('768px');
    expect((mixed as any)?.supports_condition).toBe('(display: grid)');

    // CSS from DB and direct compile both produce correct output
    const cssDb = compileDbToCss(db as any);
    const cssDirect = compileToCss(parseICBINCSS(sql));

    // Both should contain the nested structure
    expect(cssDb).toContain('@supports (display: grid)');
    expect(cssDb).toContain('@media (min-width: 768px)');
    expect(cssDb).toContain('display: grid;');

    expect(cssDirect).toContain('@supports (display: grid)');
    expect(cssDirect).toContain('@media (min-width: 768px)');
    expect(cssDirect).toContain('display: grid;');

    // Verify proper nesting (supports wraps media)
    const supportsIndex = cssDb.indexOf('@supports');
    const mediaIndex = cssDb.indexOf('@media');
    expect(supportsIndex).toBeLessThan(mediaIndex);
  });
});

