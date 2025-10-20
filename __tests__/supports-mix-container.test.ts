import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ensureDb, initEmptyDb, loadDb } from '../src/db/store';
import { applyMigrationFile } from '../src/migrate/engine';
import { compileDbToCss, compileToCss } from '../src/compiler/index';
import { parseICBINCSS } from '../src/parser/index';

function mkproj(prefix = 'icbincss-supports-container-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'up'));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'down'));
  return dir;
}

describe('supports() mixed with container queries', () => {
  it('persists supports_condition in DB and emits nested @supports with @container', async () => {
    const root = mkproj();
    const up = path.join(root, 'icbincss', 'migrations', 'up', '20251018_000001__supports_container.sql');
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "ALTER STYLE SELECTOR card",
      "  WHERE supports(display: grid) AND container main > 600px",
      "  SET display = grid;",
    ].join('\n');
    fs.writeFileSync(up, sql, 'utf8');
    ensureDb(root);
    initEmptyDb(root);
    await applyMigrationFile(root, up, 'up');

    const db = loadDb(root);
    // Check DB row
    const row = db.styles.find(r => r.prop === 'display');
    expect(row).toBeTruthy();
    expect(row?.resp_kind).toBe('container');
    expect(row?.container_name).toBe('main');
    expect(row?.resp_min).toBe('600px');
    expect((row as any)?.supports_condition).toBe('(display: grid)');

    // CSS from DB and direct compile both produce correct output
    const cssDb = compileDbToCss(db as any);
    const cssDirect = compileToCss(parseICBINCSS(sql));

    // Both should contain the nested structure
    expect(cssDb).toContain('@supports (display: grid)');
    expect(cssDb).toContain('@container main (min-width: 600px)');
    expect(cssDb).toContain('display: grid;');

    expect(cssDirect).toContain('@supports (display: grid)');
    expect(cssDirect).toContain('@container main (min-width: 600px)');
    expect(cssDirect).toContain('display: grid;');

    // Verify proper nesting (supports wraps container)
    const supportsIndex = cssDb.indexOf('@supports');
    const containerIndex = cssDb.indexOf('@container');
    expect(supportsIndex).toBeLessThan(containerIndex);
  });
});

