#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chokidar from 'chokidar';
import chalk from 'chalk';
import { spawnSync } from 'child_process';
import { parseICBINCSS, parseICBINCSSWithSource } from '../parser/index.js';
import { compileDbToCss, buildRulesFromDb, selectorToCss } from '../compiler/index.js';
import type { RulePlan } from '../compiler/index.js';
import { ensureDb, initEmptyDb, loadDb, saveDb } from '../db/store.js';
import { nextPendingUp, matchingDownPath, applyMigrationFile, lastAppliedId, computeAppliedStack, listUpMigrations, applyAstIntoDb, rebuildDbFromFiles } from '../migrate/engine.js';
import crypto from 'crypto';
import { generateSchema, generateInserts, parsePostgresConnectionString, buildPostgresConnectionString } from '../db/dialects.js';

type IcbincConfig = {
  outFile?: string;
  strictSemicolons?: boolean;
  // New options
  includeGlobs?: string[]; // limit parsed SQL files (relative to project root)
  excludeGlobs?: string[]; // exclude patterns (relative to project root)
  defaultLayers?: string[]; // declare default layer order when none declared in SQL
  tokenVarPrefix?: string; // prefix for CSS custom properties from tokens
};

function loadConfig(cwd: string): IcbincConfig {
  const p = path.join(cwd, 'icbincss.config.json');
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const cfg = JSON.parse(raw);
      return cfg || {};
    }
  } catch {
    // ignore and use defaults
  }
  return {};
}

//


function formatPeggyError(err: any, file?: string) {
  const loc = err?.location?.start;
  const where = file ? `${file}${loc ? `:${loc.line}:${loc.column}` : ''}` : '';
  const msg = err?.message || String(err);
  return where ? `${where} - ${msg}` : msg;
}

function sanitizeForSemicolonCheck(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  let inS = false, inD = false, inLC = false, inBC = false;
  while (i < n) {
    const c = src[i];
    const nxt = i + 1 < n ? src[i + 1] : '';
    if (!inS && !inD && !inBC && c === '-' && nxt === '-') { inLC = true; out += ' '; i += 2; continue; }
    if (inLC) { if (c === '\n' || c === '\r') { inLC = false; out += c; } else out += ' '; i++; continue; }
    if (!inS && !inD && !inLC && c === '/' && nxt === '*') { inBC = true; out += '  '; i += 2; continue; }
    if (inBC) { if (c === '*' && nxt === '/') { inBC = false; out += '  '; i += 2; } else out += ' '; continue; }
    if (!inD && c === '\'' ) { inS = !inS; out += ' '; i++; continue; }
    if (!inS && c === '"') { inD = !inD; out += ' '; i++; continue; }
    if (inS || inD) { out += ' '; i++; continue; }
    out += c; i++;
  }
  return out;
}

function enforceSemicolonsIfStrict(src: string, file: string, strict?: boolean) {
  if (!strict) return null;
  const s = sanitizeForSemicolonCheck(src);
  const stmtRegex = /(^|[\s;])(CREATE|ALTER|DELETE|DROP|SET|INSERT|UPDATE|RAW|BEGIN|COMMIT|ROLLBACK|SELECT|DESCRIBE)\b/gi;
  const semicolons = (s.match(/;/g) || []).length;
  let count = 0; while (stmtRegex.exec(s)) count++;
  if (count > semicolons) {
    return `${file} - strictSemicolons: expected ${count} ';' but found ${semicolons}`;
  }
  return null;
}

function computeSpecificity(selector: string): [number, number, number] {
  // Rough CSS specificity: a (IDs), b (classes, attrs, pseudo-classes), c (elements, pseudo-elements)
  let a = 0, b = 0, c = 0;
  // Remove strings inside :not(...) for simplicity? We'll just count tokens across the string.
  // Count IDs
  a += (selector.match(/#[a-zA-Z0-9_-]+/g) || []).length;
  // Classes
  b += (selector.match(/\.[a-zA-Z0-9_-]+/g) || []).length;
  // Attributes
  b += (selector.match(/\[[^\]]+\]/g) || []).length;
  // Pseudo-elements (::before)
  c += (selector.match(/::[a-zA-Z0-9_-]+/g) || []).length;
  // Pseudo-classes (:(?!:))
  b += (selector.match(/:(?!:)[a-zA-Z0-9_-]+(\([^)]*\))?/g) || []).length;
  // Elements: match tag names not preceded by [#.:] and not empty
  const elementTokens = selector.split(/[^a-zA-Z0-9_-]+/).filter(Boolean).filter(tok => !/^([#.]:?)/.test(tok));
  // A naive filter: ignore tokens that are obviously class/id/pseudo already counted
  // Better approach: count occurrences of E('...') were compiled; here we just approximate by scanning selector
  // Reduce over matches of leading element names in segments separated by spaces/combinators
  const elementMatches = (selector.match(/(^|[\s>+~])([a-zA-Z][a-zA-Z0-9_-]*)/g) || []).length;
  c += elementMatches;
  return [a, b, c];
}

const program = new Command();

program
  .name('icbincss')
  .description('I Can’t Believe It’s Not CSS: SQL → CSS compiler')
  .version('0.1.0');

function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  const YYYY = d.getUTCFullYear();
  const MM = pad(d.getUTCMonth() + 1);
  const DD = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${YYYY}${MM}${DD}${hh}${mm}${ss}`; // UTC
}

program
  .command('init')
  .description('Scaffold /icbincss directory')
  .action(async () => {
    const root = process.cwd();
    const icbDir = path.join(root, 'icbincss');
    const migDir = path.join(icbDir, 'migrations');
    const distDir = path.join(root, 'dist');
    fs.ensureDirSync(icbDir);
    fs.ensureDirSync(migDir);
    fs.ensureDirSync(path.join(migDir, 'up'));
    fs.ensureDirSync(path.join(migDir, 'down'));
    ensureDb(root);
    fs.ensureDirSync(distDir);

    const files: Array<{ p: string; c: string }> = [
      {
        p: path.join(migDir, 'up', `${nowTimestamp()}__bootstrap.sql`),
        c: [
          "-- Bootstrap migration (pure SQL): tokens, selectors, and styles",
          "CREATE TOKEN 'brand/500' VALUE #2266ee;",
          "CREATE TOKEN 'space/4' VALUE 16px;",
          "",
          "CREATE SELECTOR card AS C('card');",
          "CREATE SELECTOR btn AS AND(E('button'), C('primary'));",
          "",
          "CREATE STYLE SELECTOR card (",
          "  background = #fff,",
          "  padding = token('space/4')",
          ");",
          "",
          "CREATE STYLE SELECTOR btn (",
          "  background = token('brand/500'),",
          "  color = #fff",
          ");",
          "",
        ].join('\n'),
      },
      {
        p: path.join(root, 'icbincss.config.json'),
        c: JSON.stringify({ outFile: 'dist/icbincss.css' }, null, 2) + '\n',
      },
    ];

    for (const f of files) {
      if (!fs.existsSync(f.p)) fs.writeFileSync(f.p, f.c, 'utf8');
    }

    initEmptyDb(root);
    console.log(chalk.green('Scaffolded icbincss project.'));
    console.log('- icbincss/migrations/<timestamp>__bootstrap.sql');
    console.log('- icbincss.config.json');
  });

program
  .command('build')
  .description('Compile DB (CSV) → dist/icbincss.css')
  .option('--butter <mode>', "Override butter mode (thin_spread|medium_spread|thick_smear)")
  .action(async (opts) => {
    const root = process.cwd();
    const icbDir = path.join(root, 'icbincss');
    const cfg = loadConfig(root);
    if (cfg.tokenVarPrefix) process.env.ICBINCSS_TOKEN_PREFIX = String(cfg.tokenVarPrefix);
    if (cfg.defaultLayers && cfg.defaultLayers.length) process.env.ICBINCSS_DEFAULT_LAYERS = cfg.defaultLayers.join(',');
    if (opts?.butter) process.env.ICBINCSS_BUTTER = String(opts.butter);
    const outPath = cfg.outFile || 'dist/icbincss.css';
    const outFile = path.isAbsolute(outPath) ? outPath : path.join(root, outPath);
    const distDir = path.dirname(outFile);

    if (!fs.existsSync(icbDir)) {
      console.error(chalk.red('Missing ./icbincss. Run `icbincss init` first.'));
      process.exit(1);
    }

    console.log(chalk.blue('Loading DB and compiling to CSS...'));
    let css = '';
    try {
      ensureDb(root);
      const db = loadDb(root);
      css = compileDbToCss(db as any);
    } catch (e: any) {
      console.error(chalk.red('Build failed during compile:'), e?.message || e);
      process.exit(1);
      return;
    }
    fs.ensureDirSync(distDir);
    fs.writeFileSync(outFile, css, 'utf8');
    console.log(chalk.green(`Wrote ${outFile}`));
  });

// Migration helper: generate paired up/down files with a timestamp
const migrate = program.command('migrate').description('Migration utilities');

migrate
  .command('create')
  .requiredOption('--name <name>', 'Base migration name, e.g., style.sql or add_button_color')
  .action(async (opts) => {
    const root = process.cwd();
    const icbDir = path.join(root, 'icbincss');
    const migDir = path.join(icbDir, 'migrations');
    const upDir = path.join(migDir, 'up');
    const downDir = path.join(migDir, 'down');
    fs.ensureDirSync(upDir);
    fs.ensureDirSync(downDir);
    const rawName = String(opts.name || '').trim();
    if (!rawName) { console.error(chalk.red('Missing --name')); process.exit(1); }
    const baseNoSql = rawName.endsWith('.sql') ? rawName.slice(0, -4) : rawName;
    const safe = baseNoSql.replace(/[^a-zA-Z0-9_-]+/g, '_');
    const ts = nowTimestamp();
    const upPath = path.join(upDir, `${ts}__${safe}.sql`);
    const downPath = path.join(downDir, `${ts}__${safe}.sql`);
    if (fs.existsSync(upPath) || fs.existsSync(downPath)) {
      console.error(chalk.red('Migration already exists with timestamp ' + ts));
      process.exit(1);
    }
    const upScaffold = [
      `-- UP migration: ${safe} @ ${ts} (UTC)`,
      `-- Add forward style changes below`,
      `-- Example:`,
      `-- ALTER STYLE SELECTOR btn SET color = #fff;`,
      ``,
    ].join('\n');
    const downScaffold = [
      `-- DOWN migration: ${safe} @ ${ts} (UTC)`,
      `-- Revert the changes from the UP migration`,
      `-- Example:`,
      `-- DELETE FROM style_props WHERE selector = btn AND prop = 'color';`,
      ``,
    ].join('\n');
    fs.writeFileSync(upPath, upScaffold, 'utf8');
    fs.writeFileSync(downPath, downScaffold, 'utf8');
    console.log(chalk.green('Created:'));
    console.log(' - ' + path.relative(root, upPath));
    console.log(' - ' + path.relative(root, downPath));
  });

function parseIdAndName(file: string): { id: string, base: string } {
  const name = path.basename(file);
  const m = name.match(/^(\d{8,}__[^.]+)\.(?:up|down)\.sql$/) || name.match(/^(\d{8,}__[^.]+)\.sql$/);
  if (!m) return { id: name.replace(/\.sql$/,'').replace(/\.(up|down)$/,'') || name, base: name.replace(/\.sql$/,'') };
  return { id: m[1], base: m[1] };
}

migrate
  .command('up')
  .description('Apply the next up migration into the DB (CSV) and log it')
  .action(async () => {
    const root = process.cwd();
    ensureDb(root);
    const db = loadDb(root);
    const next = nextPendingUp(root, db);
    if (!next) { console.log(chalk.yellow('No pending up migrations.')); return; }
    const row = await applyMigrationFile(root, next.file, 'up');
    console.log(chalk.green('Applied up:'), row.filename);
  });

migrate
  .command('status')
  .description('Show applied (from DB) vs pending (from migrations/up)')
  .option('--strict', 'Exit with non-zero code if checksum drift is detected')
  .action(async (opts) => {
    const root = process.cwd();
    ensureDb(root);
    const db = loadDb(root);
    const appliedStack = computeAppliedStack(db);
    const appliedSet = new Set(appliedStack);
    const ups = listUpMigrations(root).map(f => f.replace(/\.sql$/,''));
    const pending = ups.filter(id => !appliedSet.has(id));
    console.log(chalk.blue('Applied (top → bottom):'));
    if (appliedStack.length === 0) console.log('  (none)');
    for (const id of appliedStack.slice().reverse()) console.log('  ' + id);
    console.log('');
    console.log(chalk.blue('Pending:'));
    if (pending.length === 0) console.log('  (none)');
    for (const id of pending) console.log('  ' + id);

    // Checksum drift warnings for applied set (latest UP per id)
    if (appliedStack.length) {
      console.log('');
      console.log(chalk.blue('Warnings:'));
      let warned = 0;
      // Build latest-up row per id
      const rowsById = new Map<string, any[]>();
      for (const m of db.migrations) {
        const arr = rowsById.get(m.id) || [];
        arr.push(m);
        rowsById.set(m.id, arr);
      }
      for (const id of appliedStack) {
        const rows = (rowsById.get(id) || []).filter(r => r.direction === 'up');
        rows.sort((a,b) => String(a.applied_at_iso).localeCompare(String(b.applied_at_iso)));
        const latest = rows[rows.length - 1];
        if (!latest) continue;
        const upPath = path.join(root, 'icbincss', 'migrations', 'up', latest.filename);
        if (!fs.existsSync(upPath)) {
          console.log(chalk.yellow(`  ${latest.filename} is missing on disk (applied ${latest.applied_at_iso})`));
          warned++;
          continue;
        }
        const src = fs.readFileSync(upPath, 'utf8');
        const sha1 = crypto.createHash('sha1').update(src).digest('hex');
        if (sha1 !== latest.checksum) {
          console.log(chalk.yellow(`  ${latest.filename} (applied ${latest.applied_at_iso}) ⚠ CHECKSUM MISMATCH`));
          console.log(chalk.gray(`    Current:  ${sha1}`));
          console.log(chalk.gray(`    Expected: ${latest.checksum}`));
          warned++;
        }
      }
      if (warned === 0) console.log('  (none)');
      if (warned > 0 && opts?.strict) process.exit(1);
    }
  });

const dbCmd = program.command('db').description('DB utilities (CSV-backed)');

dbCmd
  .command('rebuild')
  .description('Rebuild DB CSVs from tokens/selectors plus applied migrations history')
  .action(async () => {
    const root = process.cwd();
    try {
      rebuildDbFromFiles(root);
      console.log(chalk.green('DB rebuilt from source files.'));
    } catch (e: any) {
      console.error(chalk.red('DB rebuild failed:'), e?.message || e);
      process.exit(1);
    }
  });

dbCmd
  .command('verify')
  .description('Verify database integrity: referential checks, JSON validity, checksum drift')
  .action(async () => {
    const root = process.cwd();
    ensureDb(root);
    const db = loadDb(root);

    let errors = 0;
    let warnings = 0;

    const err = (msg: string) => { errors++; console.log(chalk.red('✗ ERROR:'), msg); };
    const warn = (msg: string) => { warnings++; console.log(chalk.yellow('⚠ WARNING:'), msg); };
    const ok = (msg: string) => { console.log(chalk.green('✓'), msg); };

    // Build lookup maps
    const selectors = new Set(db.selectors.map(s => s.id));
    const layers = new Set(db.layers.map(l => l.id));
    const tokens = new Map(db.tokens.map(t => [t.name, t as any]));

    // 1) Referential Integrity: styles
    let unknownSelectors = 0, unknownLayers = 0, unknownTokens = 0;
    const tokenRe = /token\((['"])(.+?)\1\)/g;
    for (const s of db.styles) {
      if (!selectors.has(s.selector_id)) {
        unknownSelectors++;
        err(`Style references unknown selector '${s.selector_id}' (style id=${s.id})`);
      }
      if (s.layer_id && !layers.has(s.layer_id)) {
        unknownLayers++;
        err(`Style references unknown layer '${s.layer_id}' (style id=${s.id})`);
      }
      // Check token() refs in value
      const m = String(s.value || '').matchAll(tokenRe);
      for (const g of m) {
        const tname = g[2];
        const tok = tokens.get(tname);
        if (!tok || (tok as any).deleted_at_iso) {
          unknownTokens++;
          err(`Style references unknown token '${tname}' (style id=${s.id})`);
        }
      }
    }
    if (unknownSelectors === 0 && unknownLayers === 0 && unknownTokens === 0) ok('Referential integrity: styles → selectors/layers/tokens');

    // 2) Orphaned Records
    const usedSelectors = new Set<string>();
    for (const s of db.styles) usedSelectors.add(s.selector_id);
    for (const s of db.styles) { if (s.scope_root_id) usedSelectors.add(s.scope_root_id); if (s.scope_limit_id) usedSelectors.add(s.scope_limit_id); }
    for (const ss of (db as any).starting_styles || []) usedSelectors.add(ss.selector_id);
    const orphanSelectors = db.selectors.filter(s => !usedSelectors.has(s.id));
    if (orphanSelectors.length) warn(`${orphanSelectors.length} selector(s) defined but never used: ${orphanSelectors.slice(0,5).map(s=>s.id).join(', ')}${orphanSelectors.length>5?' …':''}`);
    else ok('No orphaned selectors');

    const usedLayers = new Set(db.styles.map(s => s.layer_id).filter(Boolean) as string[]);
    const orphanLayers = db.layers.filter(l => !usedLayers.has(l.id));
    if (orphanLayers.length) warn(`${orphanLayers.length} layer(s) defined but never used: ${orphanLayers.map(l=>l.id).join(', ')}`);
    else ok('No orphaned layers');

    // Token usage: scan style values for token('...')
    const usedTokens = new Set<string>();
    for (const s of db.styles) {
      const m2 = String(s.value || '').matchAll(tokenRe);
      for (const g of m2) usedTokens.add(g[2]);
    }
    const orphanTokens = db.tokens.filter(t => !usedTokens.has(t.name));
    if (orphanTokens.length) warn(`${orphanTokens.length} token(s) defined but never referenced`);
    else ok('No orphaned tokens');

    // 3) JSON Validity
    const jsonChecks: Array<{ table: string; row: any; field: string }> = [];
    for (const r of db.selectors) jsonChecks.push({ table: 'selectors', row: r, field: 'def_json' });
    for (const r of (db as any).font_faces || []) jsonChecks.push({ table: 'font_faces', row: r, field: 'props_json' });
    for (const r of (db as any).keyframes || []) jsonChecks.push({ table: 'keyframes', row: r, field: 'frames_json' });
    for (const r of (db as any).pages || []) jsonChecks.push({ table: 'pages', row: r, field: 'props_json' });
    for (const r of (db as any).counter_styles || []) jsonChecks.push({ table: 'counter_styles', row: r, field: 'props_json' });
    for (const r of (db as any).font_feature_values || []) jsonChecks.push({ table: 'font_feature_values', row: r, field: 'features_json' });
    for (const r of (db as any).font_palette_values || []) jsonChecks.push({ table: 'font_palette_values', row: r, field: 'props_json' });
    for (const r of (db as any).starting_styles || []) jsonChecks.push({ table: 'starting_styles', row: r, field: 'props_json' });

    let badJson = 0;
    for (const c of jsonChecks) {
      const v = (c.row as any)[c.field];
      if (v && String(v).trim()) {
        try { JSON.parse(String(v)); } catch (e) {
          badJson++;
          err(`Invalid JSON in ${c.table}.${c.field} (id=${(c.row as any).id}): ${(e as any)?.message || e}`);
        }
      }
    }
    if (badJson === 0) ok('JSON columns parse correctly');

    // 4) Duplicate Names
    function dupes<T>(arr: T[], key: (x: T)=>string) {
      const seen = new Set<string>(); const d: string[] = [];
      for (const x of arr) { const k = key(x); if (seen.has(k)) d.push(k); else seen.add(k); }
      return Array.from(new Set(d));
    }
    const dupSelectors = dupes(db.selectors, x => (x as any).name);
    const dupTokens = dupes(db.tokens, x => (x as any).name);
    const dupLayers = dupes(db.layers, x => (x as any).name);
    if (dupSelectors.length) err(`Duplicate selector names: ${dupSelectors.join(', ')}`); else ok('No duplicate selector names');
    if (dupTokens.length) err(`Duplicate token names: ${dupTokens.join(', ')}`); else ok('No duplicate token names');
    if (dupLayers.length) err(`Duplicate layer names: ${dupLayers.join(', ')}`); else ok('No duplicate layer names');

    // 5) Migration checksum drift (applied set only)
    const appliedStack = computeAppliedStack(db as any);
    if (appliedStack.length === 0) ok('No applied migrations');
    const rowsById = new Map<string, any[]>();
    for (const m of db.migrations) {
      const arr = rowsById.get(m.id) || [];
      arr.push(m);
      rowsById.set(m.id, arr);
    }
    for (const id of appliedStack) {
      const rows = (rowsById.get(id) || []).filter(r => r.direction === 'up');
      rows.sort((a,b) => String(a.applied_at_iso).localeCompare(String(b.applied_at_iso)));
      const latest = rows[rows.length - 1];
      if (!latest) continue;
      const upPath = path.join(root, 'icbincss', 'migrations', 'up', latest.filename);
      if (!fs.existsSync(upPath)) {
        warn(`Applied migration missing on disk: ${latest.filename}`);
        continue;
      }
      const src = fs.readFileSync(upPath, 'utf8');
      const sha1 = crypto.createHash('sha1').update(src).digest('hex');
      if (sha1 !== latest.checksum) {
        warn(`Checksum drift for ${latest.filename} (expected ${latest.checksum}, current ${sha1})`);
      }
    }
    if (errors === 0 && warnings === 0) console.log(chalk.green('\n✓ Database verification passed with no issues.'));
    else console.log(chalk.cyan(`\nVerification finished with ${errors} error(s), ${warnings} warning(s).`));
    if (errors > 0) process.exit(1);
  });

dbCmd
  .command('export-sql')
  .description('Generate SQL schema + inserts for current DB (supports --dialect)')
  .option('--dialect <type>', 'Database dialect: sqlite, postgres, or mysql (default: sqlite)', 'sqlite')
  .action(async (opts) => {
    const root = process.cwd();
    ensureDb(root);
    const db = loadDb(root);

    const dialect = opts.dialect?.toLowerCase() || 'sqlite';
    if (!['sqlite', 'postgres', 'mysql'].includes(dialect)) {
      console.error(chalk.red(`Invalid dialect: ${dialect}. Use sqlite, postgres, or mysql.`));
      process.exit(1);
    }

    console.log(chalk.blue(`Generating ${dialect} schema...`));

    const schema = generateSchema(dialect as any);
    const inserts = generateInserts(db as any, dialect as any);
    const sql = schema + '\n\n' + inserts + '\n';

    const fileName = dialect === 'sqlite' ? 'init.sql' : `${dialect}-init.sql`;
    const outPath = path.join(root, 'icbincss', 'db', fileName);
    fs.ensureDirSync(path.dirname(outPath));
    fs.writeFileSync(outPath, sql, 'utf8');

    console.log(chalk.green(`Wrote ${path.relative(root, outPath)}`));

    if (dialect === 'postgres') {
      console.log(chalk.cyan('\nPostgres features:'));
      console.log('  ✓ JSONB columns for fast JSON queries');
      console.log('  ✓ GIN indexes on JSONB fields');
      console.log('  ✓ Indexes on foreign keys and common queries');
      console.log('  ✓ Helpful views: styles_full, styles_with_selectors, styles_with_layers');
    } else if (dialect === 'mysql') {
      console.log(chalk.cyan('\nMySQL features:'));
      console.log('  ✓ JSON columns with utf8mb4 charset');
      console.log('  ✓ Indexes on foreign keys');
      console.log('  ✓ InnoDB engine for ACID compliance');
    }
  });

dbCmd
  .command('init-sqlite')
  .description('Create a local SQLite DB file from the current CSV DB (uses sqlite3 if available)')
  .option('--file <path>', 'SQLite DB file path', path.join(process.cwd(), 'icbincss', 'db', 'icbincss.sqlite'))
  .action(async (opts) => {
    const root = process.cwd();
    ensureDb(root);
    const db = loadDb(root);
    const schema = generateSchema('sqlite');
    const inserts = generateInserts(db as any, 'sqlite');
    const sql = schema + '\n\n' + inserts + '\n';
    const dbFile = path.isAbsolute(opts.file) ? opts.file : path.join(root, opts.file);
    try {
      const res = spawnSync('sqlite3', [dbFile], { input: sql, encoding: 'utf8' });
      if (res.error || res.status !== 0) {
        console.log(chalk.yellow('Could not run sqlite3 automatically. Wrote init SQL to icbincss/db/init.sql.'));
        const outPath = path.join(root, 'icbincss', 'db', 'init.sql');
        fs.ensureDirSync(path.dirname(outPath));
        fs.writeFileSync(outPath, sql, 'utf8');
        console.log(chalk.yellow(`Run manually: sqlite3 ${path.relative(root, dbFile)} < ${path.relative(root, outPath)}`));
      } else {
        console.log(chalk.green(`SQLite DB initialized at ${path.relative(root, dbFile)}`));
      }
    } catch {
      const outPath = path.join(root, 'icbincss', 'db', 'init.sql');
      fs.ensureDirSync(path.dirname(outPath));
      fs.writeFileSync(outPath, sql, 'utf8');
      console.log(chalk.yellow('sqlite3 is not available. Wrote init SQL to icbincss/db/init.sql.'));
      console.log(chalk.yellow(`Run manually: sqlite3 ${path.relative(root, dbFile)} < ${path.relative(root, outPath)}`));
    }
  });

dbCmd
  .command('sync-sqlite')
  .description('Sync current CSV database to a SQLite file (run after migrations)')
  .option('--file <path>', 'SQLite DB file path', path.join(process.cwd(), 'icbincss', 'db', 'icbincss.sqlite'))
  .action(async (opts) => {
    const root = process.cwd();
    ensureDb(root);
    const db = loadDb(root);

    const dbFile = path.isAbsolute(opts.file) ? opts.file : path.join(root, opts.file);
    fs.ensureDirSync(path.dirname(dbFile));

    // Build a sync script: Drop and recreate tables to pick up schema changes, then re-insert
    const dropStatements = [
      'DROP VIEW IF EXISTS applied_migrations;',
      'DROP VIEW IF EXISTS migrations_latest;',
      'DROP TABLE IF EXISTS starting_styles;',
      'DROP TABLE IF EXISTS font_palette_values;',
      'DROP TABLE IF EXISTS font_feature_values;',
      'DROP TABLE IF EXISTS counter_styles;',
      'DROP TABLE IF EXISTS pages;',
      'DROP TABLE IF EXISTS imports;',
      'DROP TABLE IF EXISTS raw_blocks;',
      'DROP TABLE IF EXISTS keyframes;',
      'DROP TABLE IF EXISTS font_faces;',
      'DROP TABLE IF EXISTS properties;',
      'DROP TABLE IF EXISTS styles;',
      'DROP TABLE IF EXISTS layers;',
      'DROP TABLE IF EXISTS selectors;',
      'DROP TABLE IF EXISTS tokens;',
      'DROP TABLE IF EXISTS migrations;'
    ].join('\n');

    const schema = generateSchema('sqlite');
    const inserts = generateInserts(db as any, 'sqlite');
    const sql = `-- Sync CSV to SQLite (recreate schema)\nBEGIN;\n${dropStatements}\n\n${schema}\n\n${inserts}\nCOMMIT;\n`;

    // Write SQL to a file for reference
    const sqlPath = path.join(root, 'icbincss', 'db', 'sqlite-sync.sql');
    fs.ensureDirSync(path.dirname(sqlPath));
    fs.writeFileSync(sqlPath, sql, 'utf8');

    // Execute via sqlite3 if available
    console.log(chalk.blue('Syncing CSV database to SQLite...'));
    console.log(`  File: ${path.relative(root, dbFile)}`);

    const check = spawnSync('sqlite3', ['-version'], { encoding: 'utf8' });
    if (check.error) {
      console.error(chalk.yellow('sqlite3 is not available. Wrote sync SQL to icbincss/db/sqlite-sync.sql.'));
      console.log(chalk.yellow(`Run manually: sqlite3 ${path.relative(root, dbFile)} < ${path.relative(root, sqlPath)}`));
      process.exit(1);
    }

    const execRes = spawnSync('sqlite3', [dbFile], { input: sql, encoding: 'utf8' });
    if (execRes.error || execRes.status !== 0) {
      console.error(chalk.red('Failed to sync SQLite database.'));
      if (execRes.stderr) console.error(execRes.stderr);
      console.log(chalk.yellow(`You can run manually: sqlite3 ${path.relative(root, dbFile)} < ${path.relative(root, sqlPath)}`));
      process.exit(1);
    }

    // Show updated stats
    const countRes = spawnSync('sqlite3', [dbFile, 'SELECT COUNT(*) FROM styles;'], { encoding: 'utf8' });
    const styleCount = (countRes.stdout || '').trim().split(/\s+/).pop() || '?';

    console.log(chalk.green('\n✓ SQLite database synced successfully!'));
    console.log(chalk.cyan('\nUpdated stats:'));
    console.log(`  Styles: ${styleCount}`);
    console.log(`  Selectors: ${db.selectors.length}`);
    console.log(`  Tokens: ${db.tokens.length}`);
    console.log(`  Migrations: ${db.migrations.length}`);
  });

function parsePostgresOptions(opts: any): { connInfo: any; connectionString: string } {
  let connInfo: { user?: string; password?: string; host: string; port: number; database: string };

  if (opts.connection) {
    try {
      connInfo = parsePostgresConnectionString(opts.connection);
    } catch (e: any) {
      console.error(chalk.red('Invalid connection string:'), e.message);
      process.exit(1);
    }
  } else {
    connInfo = {
      database: opts.database || 'icbincss_styles',
      host: opts.host || 'localhost',
      port: opts.port || 5432,
      user: opts.user,
      password: opts.password,
    };
  }

  const connectionString = buildPostgresConnectionString(connInfo);
  return { connInfo, connectionString };
}

dbCmd
  .command('init-postgres')
  .description('Create and initialize a Postgres database from the current CSV DB')
  .option('--connection <url>', 'Postgres connection string (postgresql://user:pass@host:port/database)')
  .option('--database <name>', 'Database name (default: icbincss_styles)')
  .option('--host <host>', 'Database host (default: localhost)')
  .option('--port <port>', 'Database port (default: 5432)', parseInt)
  .option('--user <user>', 'Database user')
  .option('--password <password>', 'Database password')
  .option('--skip-create', 'Skip database creation (assumes database exists)')
  .action(async (opts) => {
    const root = process.cwd();
    ensureDb(root);
    const db = loadDb(root);

    const { connInfo, connectionString } = parsePostgresOptions(opts);

    console.log(chalk.blue('Postgres connection info:'));
    console.log(`  Database: ${connInfo.database}`);
    console.log(`  Host: ${connInfo.host}:${connInfo.port}`);
    if (connInfo.user) console.log(`  User: ${connInfo.user}`);

    // Check if psql is available
    const psqlCheck = spawnSync('psql', ['--version'], { encoding: 'utf8' });
    if (psqlCheck.error) {
      console.error(chalk.red('psql is not available. Please install PostgreSQL client tools.'));
      process.exit(1);
    }

    // Create database if needed
    if (!opts.skipCreate) {
      console.log(chalk.blue(`\nCreating database "${connInfo.database}"...`));

      // Connect to 'postgres' database to create the target database
      const createDbConn = buildPostgresConnectionString({
        ...connInfo,
        database: 'postgres',
      });

      const createDbSql = `CREATE DATABASE ${connInfo.database};`;
      const createRes = spawnSync('psql', [createDbConn, '-c', createDbSql], { encoding: 'utf8' });

      if (createRes.error) {
        console.error(chalk.red('Failed to create database:'), createRes.error.message);
        process.exit(1);
      }

      if (createRes.status !== 0) {
        // Database might already exist - check the error
        if (createRes.stderr && createRes.stderr.includes('already exists')) {
          console.log(chalk.yellow(`Database "${connInfo.database}" already exists, continuing...`));
        } else {
          console.error(chalk.red('Failed to create database:'), createRes.stderr);
          process.exit(1);
        }
      } else {
        console.log(chalk.green(`Database "${connInfo.database}" created successfully.`));
      }
    }

    // Generate Postgres-optimized schema and inserts
    console.log(chalk.blue('\nGenerating Postgres schema with JSONB, indexes, and views...'));
    const schema = generateSchema('postgres');
    const inserts = generateInserts(db as any, 'postgres');
    const sql = schema + '\n\n' + inserts + '\n';

    // Write SQL to file for reference
    const sqlPath = path.join(root, 'icbincss', 'db', 'postgres-init.sql');
    fs.ensureDirSync(path.dirname(sqlPath));
    fs.writeFileSync(sqlPath, sql, 'utf8');
    console.log(chalk.green(`Wrote schema to ${path.relative(root, sqlPath)}`));

    // Execute schema
    console.log(chalk.blue('\nExecuting schema and loading data...'));
    const execRes = spawnSync('psql', [connectionString], { input: sql, encoding: 'utf8' });

    if (execRes.error) {
      console.error(chalk.red('Failed to execute schema:'), execRes.error.message);
      console.log(chalk.yellow(`\nYou can run manually: psql "${connectionString}" < ${path.relative(root, sqlPath)}`));
      process.exit(1);
    }

    if (execRes.status !== 0) {
      console.error(chalk.red('Failed to execute schema:'));
      console.error(execRes.stderr);
      console.log(chalk.yellow(`\nYou can run manually: psql "${connectionString}" < ${path.relative(root, sqlPath)}`));
      process.exit(1);
    }

    // Show stats
    const countRes = spawnSync('psql', [connectionString, '-c', 'SELECT COUNT(*) FROM styles;'], { encoding: 'utf8' });
    const styleCount = countRes.stdout?.match(/\d+/)?.[0] || '?';

    console.log(chalk.green('\n✓ Postgres database initialized successfully!'));
    console.log(chalk.cyan('\nDatabase stats:'));
    console.log(`  Styles loaded: ${styleCount}`);
    console.log(`  Selectors: ${db.selectors.length}`);
    console.log(`  Tokens: ${db.tokens.length}`);
    console.log(`  Layers: ${db.layers.length}`);

    console.log(chalk.cyan('\nConnection string:'));
    console.log(`  ${connectionString}`);

    console.log(chalk.cyan('\nUseful queries:'));
    console.log('  # View all styles with selector names:');
    console.log(`  psql "${connectionString}" -c "SELECT * FROM styles_full LIMIT 10;"`);
    console.log('\n  # Count styles by layer:');
    console.log(`  psql "${connectionString}" -c "SELECT layer_name, COUNT(*) FROM styles_with_layers GROUP BY layer_name;"`);
    console.log('\n  # Query JSON selector definitions:');
    console.log(`  psql "${connectionString}" -c "SELECT name, def_json->>'kind' AS kind FROM selectors LIMIT 5;"`);

    console.log(chalk.cyan('\n💡 Next steps:'));
    console.log('  After running migrations, sync changes with:');
    console.log(chalk.green(`  npx icbincss db sync-postgres --database=${connInfo.database}`));
  });

dbCmd
  .command('sync-postgres')
  .description('Sync current CSV database to Postgres (run after migrations)')
  .option('--connection <url>', 'Postgres connection string (postgresql://user:pass@host:port/database)')
  .option('--database <name>', 'Database name (default: icbincss_styles)')
  .option('--host <host>', 'Database host (default: localhost)')
  .option('--port <port>', 'Database port (default: 5432)', parseInt)
  .option('--user <user>', 'Database user')
  .option('--password <password>', 'Database password')
  .action(async (opts) => {
    const root = process.cwd();
    ensureDb(root);
    const db = loadDb(root);

    const { connInfo, connectionString } = parsePostgresOptions(opts);

    console.log(chalk.blue('Syncing CSV database to Postgres...'));
    console.log(`  Database: ${connInfo.database}`);
    console.log(`  Host: ${connInfo.host}:${connInfo.port}`);

    // Check if psql is available
    const psqlCheck = spawnSync('psql', ['--version'], { encoding: 'utf8' });
    if (psqlCheck.error) {
      console.error(chalk.red('psql is not available. Please install PostgreSQL client tools.'));
      process.exit(1);
    }

    // Generate TRUNCATE statements for all tables
    const truncateStatements = [
      'TRUNCATE TABLE starting_styles CASCADE;',
      'TRUNCATE TABLE font_palette_values CASCADE;',
      'TRUNCATE TABLE font_feature_values CASCADE;',
      'TRUNCATE TABLE counter_styles CASCADE;',
      'TRUNCATE TABLE pages CASCADE;',
      'TRUNCATE TABLE imports CASCADE;',
      'TRUNCATE TABLE raw_blocks CASCADE;',
      'TRUNCATE TABLE keyframes CASCADE;',
      'TRUNCATE TABLE font_faces CASCADE;',
      'TRUNCATE TABLE properties CASCADE;',
      'TRUNCATE TABLE styles CASCADE;',
      'TRUNCATE TABLE layers CASCADE;',
      'TRUNCATE TABLE selectors CASCADE;',
      'TRUNCATE TABLE tokens CASCADE;',
      'TRUNCATE TABLE migrations CASCADE;',
    ].join('\n');

    // Generate fresh inserts
    console.log(chalk.blue('Generating fresh data...'));
    const inserts = generateInserts(db as any, 'postgres');

    // Combine truncate + inserts
    const sql = `-- Sync CSV to Postgres\nBEGIN;\n${truncateStatements}\n\n${inserts}\nCOMMIT;\n`;

    // Write SQL to file for reference
    const sqlPath = path.join(root, 'icbincss', 'db', 'postgres-sync.sql');
    fs.ensureDirSync(path.dirname(sqlPath));
    fs.writeFileSync(sqlPath, sql, 'utf8');

    // Execute sync
    console.log(chalk.blue('Syncing to database...'));
    const execRes = spawnSync('psql', [connectionString], { input: sql, encoding: 'utf8' });

    if (execRes.error) {
      console.error(chalk.red('Failed to sync database:'), execRes.error.message);
      console.log(chalk.yellow(`\nYou can run manually: psql "${connectionString}" < ${path.relative(root, sqlPath)}`));
      process.exit(1);
    }

    if (execRes.status !== 0) {
      console.error(chalk.red('Failed to sync database:'));
      console.error(execRes.stderr);
      console.log(chalk.yellow(`\nYou can run manually: psql "${connectionString}" < ${path.relative(root, sqlPath)}`));
      process.exit(1);
    }

    // Show updated stats
    const countRes = spawnSync('psql', [connectionString, '-c', 'SELECT COUNT(*) FROM styles;'], { encoding: 'utf8' });
    const styleCount = countRes.stdout?.match(/\d+/)?.[0] || '?';

    console.log(chalk.green('\n✓ Database synced successfully!'));
    console.log(chalk.cyan('\nUpdated stats:'));
    console.log(`  Styles: ${styleCount}`);
    console.log(`  Selectors: ${db.selectors.length}`);
    console.log(`  Tokens: ${db.tokens.length}`);
    console.log(`  Migrations: ${db.migrations.length}`);

    console.log(chalk.cyan('\n💡 Tip:'));
    console.log('  Run this command after every `migrate up` or `migrate down` to keep Postgres in sync.');
  });

migrate
  .command('down')
  .description('Revert the last applied migration in the DB (CSV) and log it')
  .action(async () => {
    const root = process.cwd();
    ensureDb(root);
    const db = loadDb(root);
    const last = lastAppliedId(db);
    if (!last) { console.log(chalk.yellow('No applied migrations to revert.')); return; }
    const p = matchingDownPath(root, last);
    if (!p) { console.error(chalk.red(`Missing DOWN migration for ${last}`)); process.exit(1); }
    const row = await applyMigrationFile(root, p, 'down');
    console.log(chalk.green('Applied down:'), row.filename);
  });

// Removed duplicate status command - already defined above at line 280

program
  .command('watch')
  .description('Watch mode (Vite/Next plugin support)')
  .option('--butter <mode>', "Override butter mode (thin_spread|medium_spread|thick_smear)")
  .action(async (opts) => {
    const root = process.cwd();
    const icbDir = path.join(root, 'icbincss');
    const cfg = loadConfig(root);
    if (cfg.tokenVarPrefix) process.env.ICBINCSS_TOKEN_PREFIX = String(cfg.tokenVarPrefix);
    if (cfg.defaultLayers && cfg.defaultLayers.length) process.env.ICBINCSS_DEFAULT_LAYERS = cfg.defaultLayers.join(',');
    if (opts?.butter) process.env.ICBINCSS_BUTTER = String(opts.butter);
    const outPath = cfg.outFile || 'dist/icbincss.css';
    const outFile = path.isAbsolute(outPath) ? outPath : path.join(root, outPath);
    const distDir = path.dirname(outFile);
    const rebuildDb = () => {
      try { rebuildDbFromFiles(root); } catch (e: any) { console.error(chalk.red('DB rebuild failed:'), e?.message || e); }
    };
    const buildOnce = () => {
      try {
        rebuildDb();
        const db = loadDb(root);
        const css = compileDbToCss(db as any);
        fs.ensureDirSync(distDir);
        fs.writeFileSync(outFile, css, 'utf8');
        console.log(chalk.green(`Rebuilt ${outFile}`));
      } catch (e: any) {
        console.error(chalk.red('Build failed:'), e.message || e);
      }
    };
    buildOnce();
    console.log(chalk.yellow('Watching icbincss for changes...'));
    const watcher = chokidar.watch(path.join(icbDir, '**/*'), { ignoreInitial: true });
    let timer: any = null;
    const debounce = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(buildOnce, 100);
    };
    watcher.on('add', debounce).on('change', debounce).on('unlink', debounce);
  });

program
  .command('inspect <selector>')
  .description('Show compiled props + source migrations')
  .option('-f, --final', 'Show final cascaded props')
  .option('--butter <mode>', "Override butter mode (thin_spread|medium_spread|thick_smear)")
  .action(async (selectorArg, opts) => {
    const root = process.cwd();
    const icbDir = path.join(root, 'icbincss');
    const cfg = loadConfig(root);
    if (cfg.tokenVarPrefix) process.env.ICBINCSS_TOKEN_PREFIX = String(cfg.tokenVarPrefix);
    if (cfg.defaultLayers && cfg.defaultLayers.length) process.env.ICBINCSS_DEFAULT_LAYERS = cfg.defaultLayers.join(',');
    if (opts?.butter) process.env.ICBINCSS_BUTTER = String(opts.butter);
    ensureDb(root);
    const db = loadDb(root);
    const plan = buildRulesFromDb(db as any);
    // Determine CSS selector for input: try exact CSS match, else try selector name mapping (with refs)
    let targetCss = selectorArg;
    const selMap = new Map<string, any>();
    for (const s of db.selectors) {
      try { selMap.set(s.name, JSON.parse(s.def_json)); } catch {}
    }
    const foundByName = selMap.get(selectorArg);
    if (foundByName) {
      try {
        targetCss = selectorToCss(foundByName, (n: string) => selMap.get(n));
      } catch { /* ignore */ }
    }
    const matches = plan.rules.filter(r => r.selectorCss === targetCss);
    if (matches.length === 0) {
      console.log(chalk.yellow(`No rules found for ${selectorArg}`));
      return;
    }
    console.log(chalk.magenta(`Rules for ${targetCss}:`));
    for (const r of matches) {
      const layer = r.layer ? ` @layer ${r.layer}` : '';
      let resp = '';
      if (r.responsive?.kind === 'media') {
        const parts: string[] = [];
        if (r.responsive.min && r.responsive.min.toUpperCase() !== 'INF') parts.push(`(min-width: ${r.responsive.min})`);
        if (r.responsive.max && r.responsive.max.toUpperCase() !== 'INF') parts.push(`(max-width: ${r.responsive.max})`);
        if (r.responsive.features) parts.push(...r.responsive.features);
        if (parts.length) resp = ` @media ${parts.join(' and ')}`;
      } else if (r.responsive?.kind === 'container') {
        const parts: string[] = [];
        const axis = (r.responsive as any).axis === 'inline' ? 'inline-size' : 'width';
        if (r.responsive.min && r.responsive.min.toUpperCase() !== 'INF') parts.push(`(min-${axis}: ${r.responsive.min})`);
        if (r.responsive.max && r.responsive.max.toUpperCase() !== 'INF') parts.push(`(max-${axis}: ${r.responsive.max})`);
        const condStr = parts.length ? ' ' + parts.join(' and ') : '';
        resp = ` @container ${r.responsive.name}${condStr}`;
      } else if ((r.responsive as any)?.kind === 'container-style') {
        resp = ` @container ${(r.responsive as any).name} style(${(r.responsive as any).condition.replace(/^\(|\)$/g, '')})`;
      } else if ((r.responsive as any)?.kind === 'supports') {
        resp = ` @supports ${(r.responsive as any).condition}`;
      }
      console.log(chalk.cyan(`-${layer}${resp}`));
      for (const p of r.props) {
        const src = (p as any).origin?.file;
        const origin = src ? `  // ${src}` : '';
        console.log(`  ${p.name}: ${p.value}${origin}`);
      }
    }
    if (opts.final) {
      console.log('');
      console.log(chalk.magenta('Final cascaded props:'));
      const finalMap = new Map<string, string>();
      for (const r of matches) for (const p of r.props) finalMap.set(p.name, p.value as string);
      const sorted = Array.from(finalMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      for (const [name, value] of sorted) console.log(`  ${name}: ${value};`);
    }
  });

program
  .command('doctor')
  .description('Conflict checks, specificity warnings')
  .option('--history', 'History-aware analysis (flag overridden writes across migrations)')
  .option('--butter <mode>', "Override butter mode (thin_spread|medium_spread|thick_smear)")
  .action(async (opts) => {
    const root = process.cwd();
    const icbDir = path.join(root, 'icbincss');
    const cfg = loadConfig(root);
    if (cfg.tokenVarPrefix) process.env.ICBINCSS_TOKEN_PREFIX = String(cfg.tokenVarPrefix);
    if (cfg.defaultLayers && cfg.defaultLayers.length) process.env.ICBINCSS_DEFAULT_LAYERS = cfg.defaultLayers.join(',');
    if (opts?.butter) process.env.ICBINCSS_BUTTER = String(opts.butter);
    ensureDb(root);
    const db = loadDb(root);
    const plan = buildRulesFromDb(db as any);
    console.log(chalk.red('Doctor report:'));
    let issues = 0;
    const buckets = new Map<string, RulePlan[]>();
    for (const r of plan.rules) {
      const key = `${r.selectorCss}||${r.layer ?? ''}||${r.responsive ? JSON.stringify(r.responsive) : ''}`;
      const arr = buckets.get(key) ?? [];
      arr.push(r as any);
      buckets.set(key, arr);
    }
    for (const [key, list] of buckets) {
      const seen = new Map<string, number>();
      for (const r of list) {
        for (const p of r.props) {
          seen.set(p.name, (seen.get(p.name) || 0) + 1);
        }
      }
      const conflicts = [...seen.entries()].filter(([, count]) => count > 1);
      if (conflicts.length) {
        issues++;
        const [selectorCss, layer, resp] = key.split('||');
        const spec = computeSpecificity(selectorCss).join(',');
        console.log(chalk.yellow(`Potential overrides for ${selectorCss} (spec ${spec})${layer ? ` @layer ${layer}` : ''}${resp ? ` ${resp}` : ''}:`));
        for (const [prop, count] of conflicts) {
          console.log(`  - ${prop}: defined ${count} times in this bucket`);
        }
      }

      // Shorthand/longhand conflicts within the same bucket
      const toKebabLocal = (s: string) => s.replace(/_/g, '-');
      const present = new Set<string>();
      for (const [name] of seen) present.add(toKebabLocal(name));
      type Group = { shorthand: string; longhands: string[] };
      const groups: Group[] = [
        { shorthand: 'margin', longhands: ['margin-top','margin-right','margin-bottom','margin-left'] },
        { shorthand: 'padding', longhands: ['padding-top','padding-right','padding-bottom','padding-left'] },
        { shorthand: 'border', longhands: ['border-top','border-right','border-bottom','border-left','border-width','border-style','border-color'] },
        { shorthand: 'border-top', longhands: ['border-top-width','border-top-style','border-top-color'] },
        { shorthand: 'border-right', longhands: ['border-right-width','border-right-style','border-right-color'] },
        { shorthand: 'border-bottom', longhands: ['border-bottom-width','border-bottom-style','border-bottom-color'] },
        { shorthand: 'border-left', longhands: ['border-left-width','border-left-style','border-left-color'] },
        { shorthand: 'background', longhands: ['background-color','background-image','background-size','background-position','background-repeat','background-attachment','background-origin','background-clip'] },
        { shorthand: 'font', longhands: ['font-size','font-family','font-weight','font-style','line-height','font-stretch','font-variant'] },
        { shorthand: 'animation', longhands: ['animation-name','animation-duration','animation-timing-function','animation-delay','animation-iteration-count','animation-direction','animation-fill-mode','animation-play-state'] },
        { shorthand: 'transition', longhands: ['transition-property','transition-duration','transition-timing-function','transition-delay'] },
      ];
      const [selectorCss2, layer2, resp2] = key.split('||');
      const spec2 = computeSpecificity(selectorCss2).join(',');
      for (const g of groups) {
        const sh = g.shorthand;
        const hasSh = present.has(sh);
        const lhPresent = g.longhands.filter(lh => present.has(lh));
        if (hasSh && lhPresent.length > 0) {
          issues++;
          console.log(chalk.yellow(`Shorthand/longhand conflict for ${selectorCss2} (spec ${spec2})${layer2 ? ` @layer ${layer2}` : ''}${resp2 ? ` ${resp2}` : ''}:`));
          console.log(`  - ${sh} with ${lhPresent.join(', ')}`);
        }
      }
    }
    // Cross-bucket conflicts per selectorCss
    const bySelector = new Map<string, RulePlan[]>();
    for (const r of plan.rules) {
      const arr = bySelector.get(r.selectorCss) ?? [];
      arr.push(r as any);
      bySelector.set(r.selectorCss, arr);
    }
    for (const [sel, list] of bySelector) {
      const spec = computeSpecificity(sel).join(',');
      const propCtx = new Map<string, Set<string>>();
      for (const r of list) {
        const ctxParts: string[] = [];
        if (r.layer) ctxParts.push(`@layer ${r.layer}`);
        if (r.responsive?.kind === 'media') {
          const parts: string[] = [];
          if (r.responsive.min && r.responsive.min.toUpperCase() !== 'INF') parts.push(`(min-width: ${r.responsive.min})`);
          if (r.responsive.max && r.responsive.max.toUpperCase() !== 'INF') parts.push(`(max-width: ${r.responsive.max})`);
          if (r.responsive.features) parts.push(...r.responsive.features);
          if (parts.length) ctxParts.push(`@media ${parts.join(' and ')}`);
        } else if (r.responsive?.kind === 'container') {
          const parts: string[] = [];
          const axis = (r.responsive as any).axis === 'inline' ? 'inline-size' : 'width';
          if (r.responsive.min && r.responsive.min.toUpperCase() !== 'INF') parts.push(`(min-${axis}: ${r.responsive.min})`);
          if (r.responsive.max && r.responsive.max.toUpperCase() !== 'INF') parts.push(`(max-${axis}: ${r.responsive.max})`);
          const condStr = parts.length ? ' ' + parts.join(' and ') : '';
          ctxParts.push(`@container ${r.responsive.name}${condStr}`);
        } else if ((r.responsive as any)?.kind === 'container-style') {
          ctxParts.push(`@container ${(r.responsive as any).name} style(${(r.responsive as any).condition.replace(/^\(|\)$/g, '')})`);
        }
        const ctx = ctxParts.join(' ').trim() || '(global)';
        for (const p of r.props) {
          const set = propCtx.get(p.name) ?? new Set<string>();
          set.add(ctx);
          propCtx.set(p.name, set);
        }
      }
      for (const [prop, ctxs] of propCtx) {
        if (ctxs.size > 1) {
          issues++;
          console.log(chalk.yellow(`Cross-context overrides for ${sel} (spec ${spec}) → ${prop}:`));
          for (const c of ctxs) console.log(`  - ${c}`);
        }
      }
    }
    // Token checks: unknown references and unused tokens
    const tokenRegex = /token\((['"])(.+?)\1\)/g;
    const referenced = new Set<string>();
    for (const r of plan.rules) {
      for (const p of r.props) {
        const v = String((p as any).value || '');
        let m;
        while ((m = tokenRegex.exec(v)) !== null) {
          referenced.add(m[2]);
        }
      }
    }
    const tokensByName = new Map(db.tokens.map(t => [t.name, t]));
    // Unknown token references (not in tokens or marked deleted)
    const unknownRefs: Array<{ name: string; suggest?: string }> = [];
    function levenshtein(a: string, b: string): number {
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + cost
          );
        }
      }
      return dp[m][n];
    }
    for (const name of referenced) {
      const tok = tokensByName.get(name);
      const deleted = (tok as any)?.deleted_at_iso && String((tok as any).deleted_at_iso).trim() !== '';
      if (!tok || deleted) {
        // find closest suggestion
        let best: { name: string; d: number } | null = null;
        for (const k of tokensByName.keys()) {
          const d = levenshtein(name, k);
          if (!best || d < best.d) best = { name: k, d };
        }
        const suggest = best && best.d <= 2 ? best.name : undefined;
        unknownRefs.push({ name, suggest });
      }
    }
    if (unknownRefs.length) {
      issues++;
      console.log(chalk.yellow('Unknown token references:'));
      for (const u of unknownRefs) {
        console.log(`  - ${u.name}${u.suggest ? chalk.gray(` (did you mean '${u.suggest}'?)`) : ''}`);
      }
    }
    // Unused tokens: defined but never referenced and not deleted
    const unused = db.tokens
      .filter(t => !(referenced.has(t.name)) && !(t as any).deleted_at_iso)
      .map(t => t.name);
    if (unused.length) {
      console.log(chalk.yellow('Unused tokens:'));
      const preview = unused.slice(0, 10).join(', ');
      console.log(`  - ${preview}${unused.length > 10 ? ' …' : ''}`);
    }

    if (issues === 0 && unknownRefs.length === 0) console.log(chalk.green('No obvious conflicts detected.'));

    // History-aware unreachable rules (earlier writes overridden by later writes in same bucket)
    if (opts?.history) {
      console.log('');
      console.log(chalk.red('History-aware analysis:'));
      type Write = { file: string; selector: string; layer?: string; scopeRoot?: string; scopeLimit?: string; resp?: any };
      const rows = db.migrations.slice().sort((a,b) => String(a.applied_at_iso).localeCompare(String(b.applied_at_iso)));
      const applied = new Map<string, typeof rows[0]>();
      for (const r of rows) {
        if (r.direction === 'up') applied.set(r.id, r); else if (r.direction === 'down') applied.delete(r.id);
      }
      const ups = Array.from(applied.values()).sort((a,b) => String(a.applied_at_iso).localeCompare(String(b.applied_at_iso)));
      const writes = new Map<string, Map<string, Write[]>>(); // bucketKey -> prop -> writes
      let currentLayer: string | undefined;
      const keyFor = (sel: string, layer?: string, sr?: string, sl?: string, resp?: any) => `${sel}||${layer||''}||${sr||''}||${sl||''}||${resp?JSON.stringify(resp):''}`;
      const pushWrite = (sel: string, props: any[], file: string, scopeRoot?: string, scopeLimit?: string, resp?: any) => {
        const key = keyFor(sel, currentLayer, scopeRoot, scopeLimit, resp);
        const m = writes.get(key) || new Map<string, Write[]>();
        for (const p of props) {
          const arr = m.get(p.name) || [];
          arr.push({ file, selector: sel, layer: currentLayer, scopeRoot, scopeLimit, resp });
          m.set(p.name, arr);
        }
        writes.set(key, m);
      };
      for (const u of ups) {
        const p = path.join(root, 'icbincss', 'migrations', 'up', u.filename);
        if (!fs.existsSync(p)) continue;
        let ast: any[] = [];
        try { ast = parseICBINCSSWithSource(fs.readFileSync(p,'utf8'), p) as any[]; } catch { continue; }
        currentLayer = undefined;
        for (const node of ast as any[]) {
          if (node.type === 'SetLayer') { currentLayer = node.layer; continue; }
          if (node.type === 'Style') {
            const sel = node.selector;
            const sr = (node as any).scopeRoot as (string|undefined);
            const sl = (node as any).scopeLimit as (string|undefined);
            const resp = (node as any).responsive;
            pushWrite(sel, node.properties, p, sr, sl, resp);
          } else if (node.type === 'AlterStyle') {
            const sel = node.selector;
            const resp = (node as any).responsive;
            const sr = (node as any).scopeRoot as (string|undefined);
            const sl = (node as any).scopeLimit as (string|undefined);
            if (resp && resp.type === 'MediaOr') {
              for (const opt of resp.options) pushWrite(sel, node.properties, p, sr, sl, opt);
            } else pushWrite(sel, node.properties, p, sr, sl, resp);
          }
        }
      }
      let flagged = 0;
      for (const [bkey, props] of writes) {
        for (const [prop, arr] of props) {
          if (arr.length > 1) {
            // all but last are unreachable
            for (let i = 0; i < arr.length - 1; i++) {
              const w = arr[i];
              flagged++;
              const ctx: string[] = [];
              if (w.layer) ctx.push(`@layer ${w.layer}`);
              if (w.resp && w.resp.type) ctx.push(`WHERE ${JSON.stringify(w.resp)}`);
              if (w.scopeRoot) ctx.push(`SCOPED TO ${w.scopeRoot}${w.scopeLimit?` LIMIT ${w.scopeLimit}`:''}`);
              console.log(chalk.yellow(`Unreachable rule: ${w.selector} → ${prop} in ${w.file}${ctx.length?` (${ctx.join(' ')})`:''}`));
            }
          }
        }
      }
      if (flagged === 0) console.log(chalk.green('No unreachable rules detected across applied migrations.'));
    }
  });

program
  .command('query <sql>')
  .description('Run SQL introspection: SELECT style_props ...; DESCRIBE SELECTOR ...')
  .option('--butter <mode>', "Override butter mode (thin_spread|medium_spread|thick_smear)")
  .action(async (sqlArg, opts) => {
    const root = process.cwd();
    const icbDir = path.join(root, 'icbincss');
    // Build project AST
    const cfg = loadConfig(root);
    if (cfg.tokenVarPrefix) process.env.ICBINCSS_TOKEN_PREFIX = String(cfg.tokenVarPrefix);
    if (cfg.defaultLayers && cfg.defaultLayers.length) process.env.ICBINCSS_DEFAULT_LAYERS = cfg.defaultLayers.join(',');
    if (opts?.butter) process.env.ICBINCSS_BUTTER = String(opts.butter);
    ensureDb(root);
    const db = loadDb(root);
    // Parse the query
    let q;
    try {
      q = parseICBINCSS(sqlArg)[0];
    } catch (e: any) {
      console.error(chalk.red('Query parse error:'), e?.message || e);
      process.exit(1);
      return;
    }
    if (!q) { console.log(chalk.yellow('No query found')); return; }
    if (q.type === 'DescribeSelector') {
      const defRow = db.selectors.find(s => s.name === q.name);
      if (!defRow) { console.log(chalk.yellow('Selector not found: ' + q.name)); return; }
      let def: any = null;
      try { def = JSON.parse(defRow.def_json); } catch {}
      if (!def) { console.log(chalk.yellow('Selector has no definition JSON: ' + q.name)); return; }
      const cssSel = selectorToCss(def, (n: string) => {
        const row = db.selectors.find(s => s.name === n);
        if (!row) return undefined as any;
        try { return JSON.parse(row.def_json); } catch { return undefined as any; }
      });
      console.log(cssSel);
      return;
    }
    if (q.type === 'SelectStyleProps') {
      const plan = buildRulesFromDb(db as any);
      const row = db.selectors.find(s => s.name === q.selector);
      let targetCss = q.selector;
      if (row) {
        try {
          const def = JSON.parse(row.def_json);
          targetCss = selectorToCss(def, (n: string) => {
            const r2 = db.selectors.find(s => s.name === n);
            try { return r2 ? JSON.parse(r2.def_json) : undefined; } catch { return undefined; }
          });
        } catch { /* ignore */ }
      }
      const matches = plan.rules.filter(r => r.selectorCss === targetCss);
      if (matches.length === 0) { console.log(chalk.yellow('No rules for ' + targetCss)); return; }
      for (const r of matches) {
        let cond = '';
        if (r.responsive?.kind === 'media') {
          const parts: string[] = [];
          if (r.responsive.min && r.responsive.min.toUpperCase() !== 'INF') parts.push(`(min-width: ${r.responsive.min})`);
          if (r.responsive.max && r.responsive.max.toUpperCase() !== 'INF') parts.push(`(max-width: ${r.responsive.max})`);
          if (r.responsive.features) parts.push(...r.responsive.features);
          if (parts.length) cond = ` @media ${parts.join(' and ')}`;
        } else if (r.responsive?.kind === 'container') {
          const parts: string[] = [];
          const axis = (r.responsive as any).axis === 'inline' ? 'inline-size' : 'width';
          if (r.responsive.min && r.responsive.min.toUpperCase() !== 'INF') parts.push(`(min-${axis}: ${r.responsive.min})`);
          if (r.responsive.max && r.responsive.max.toUpperCase() !== 'INF') parts.push(`(max-${axis}: ${r.responsive.max})`);
          const condStr = parts.length ? ' ' + parts.join(' and ') : '';
          cond = ` @container ${r.responsive.name}${condStr}`;
        } else if ((r.responsive as any)?.kind === 'container-style') {
          cond = ` @container ${(r.responsive as any).name} style(${(r.responsive as any).condition.replace(/^\(|\)$/g, '')})`;
        } else if ((r.responsive as any)?.kind === 'supports') {
          cond = ` @supports ${(r.responsive as any).condition}`;
        }
        console.log(chalk.cyan(`${targetCss}${cond} {`));
        for (const p of r.props) console.log(`  ${p.name}: ${p.value};`);
        console.log('}');
      }
      return;
    }
    console.log(chalk.yellow('Unsupported query type'));
  });

program.parseAsync(process.argv);
