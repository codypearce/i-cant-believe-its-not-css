import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { ensureDb, initEmptyDb, loadDb } from '../src/db/store';
import { applyMigrationFile } from '../src/migrate/engine';
import { compileDbToCss } from '../src/compiler/index';

function mkproj(prefix = 'icbincss-migrdown-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'up'));
  fs.ensureDirSync(path.join(dir, 'icbincss', 'migrations', 'down'));
  return dir;
}

describe('migrate up/down roundtrip', () => {
  it('applies up then down and returns to previous CSS', async () => {
    const root = mkproj();
    ensureDb(root);
    initEmptyDb(root);

    const upA = path.join(root, 'icbincss', 'migrations', 'up', '20240905_000000__a.sql');
    const downA = path.join(root, 'icbincss', 'migrations', 'down', '20240905_000000__a.sql');
    const upB = path.join(root, 'icbincss', 'migrations', 'up', '20240905_010000__b.sql');
    const downB = path.join(root, 'icbincss', 'migrations', 'down', '20240905_010000__b.sql');

    const sqlA = [
      "CREATE TOKEN 't/1' VALUE 10px;",
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card ( padding = token('t/1') );",
    ].join('\n');
    const sqlADown = [
      'DROP STYLE SELECTOR card;',
      "DELETE FROM tokens WHERE name = 't/1';",
    ].join('\n');
    const sqlB = [
      'ALTER STYLE SELECTOR card SET padding = 20px;',
    ].join('\n');
    const sqlBDown = [
      "ALTER STYLE SELECTOR card SET padding = token('t/1');",
    ].join('\n');

    fs.writeFileSync(upA, sqlA, 'utf8');
    fs.writeFileSync(downA, sqlADown, 'utf8');
    fs.writeFileSync(upB, sqlB, 'utf8');
    fs.writeFileSync(downB, sqlBDown, 'utf8');

    // Apply A up
    await applyMigrationFile(root, upA, 'up');
    let db = loadDb(root);
    const cssAfterAUp = compileDbToCss(db as any);
    expect(cssAfterAUp).toContain(':root');
    expect(cssAfterAUp).toContain('--t-1: 10px;');
    expect(cssAfterAUp).toContain('.card');
    expect(cssAfterAUp).toContain('padding: var(--t-1);');

    // Apply B up
    await applyMigrationFile(root, upB, 'up');
    db = loadDb(root);
    const cssAfterBUp = compileDbToCss(db as any);
    expect(cssAfterBUp).toContain('padding: 20px;');

    // Apply B down: should revert to A up state
    await applyMigrationFile(root, downB, 'down');
    db = loadDb(root);
    const cssAfterBDown = compileDbToCss(db as any);
    expect(cssAfterBDown).toBe(cssAfterAUp);

    // Apply A down: back to empty CSS
    await applyMigrationFile(root, downA, 'down');
    db = loadDb(root);
    const cssAfterADown = compileDbToCss(db as any);
    expect(cssAfterADown).toBe('');
  });
});
