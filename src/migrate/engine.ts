import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { parseICBINCSSWithSource } from '../parser/index.js';
import type { DbTables, LayerRow, SelectorRow, StyleRow, TokenRow, MigrationRow, FontFaceRow, KeyframesRow, RawBlockRow, PropertyRow, ImportRow, PageRow, CounterStyleRow, FontFeatureValuesRow, FontPaletteValuesRow, StartingStyleRow } from '../db/schema.js';
import { ensureDb, loadDb, saveDb } from '../db/store.js';
import {
  generateTokenId,
  generateSelectorId,
  generateLayerId,
  generateStyleId,
  generatePropertyId,
  generateFontFaceId,
  generateKeyframesId,
  generateRawBlockId,
  generateImportId,
  generatePageId,
  generateCounterStyleId,
  generateFontFeatureValuesId,
  generateFontPaletteValuesId,
  generateStartingStyleId,
} from '../db/id-generator.js';

export type Direction = 'up' | 'down';

export function listUpMigrations(root: string): string[] {
  const dir = path.join(root, 'icbincss', 'migrations', 'up');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.sql')).sort();
}

export function listDownMigrations(root: string): string[] {
  const dir = path.join(root, 'icbincss', 'migrations', 'down');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.sql')).sort();
}

function migrationIdFromFilename(name: string): string {
  const m = name.match(/^(\d{8,}__[^.]+)\.sql$/);
  return m ? m[1] : name.replace(/\.sql$/,'');
}

export function computeAppliedStack(db: DbTables): string[] {
  const stack: string[] = [];
  for (const row of db.migrations) {
    if (row.direction === 'up') stack.push(row.id);
    else if (row.direction === 'down') stack.pop();
  }
  return stack;
}

export function nextPendingUp(root: string, db: DbTables): { id: string, file: string } | null {
  const ups = listUpMigrations(root);
  const applied = new Set(computeAppliedStack(db));
  const next = ups.find(f => !applied.has(migrationIdFromFilename(f)));
  if (!next) return null;
  return { id: migrationIdFromFilename(next), file: path.join(root, 'icbincss', 'migrations', 'up', next) };
}

export function lastAppliedId(db: DbTables): string | null {
  const stack = computeAppliedStack(db);
  return stack.length ? stack[stack.length - 1] : null;
}

export function matchingDownPath(root: string, id: string): string | null {
  const downs = listDownMigrations(root);
  const name = downs.find(f => migrationIdFromFilename(f) === id);
  return name ? path.join(root, 'icbincss', 'migrations', 'down', name) : null;
}

export async function applyMigrationFile(root: string, filePath: string, direction: Direction): Promise<MigrationRow> {
  ensureDb(root);
  const db = loadDb(root);
  const id = migrationIdFromFilename(path.basename(filePath));
  const src = fs.readFileSync(filePath, 'utf8');
  const checksum = crypto.createHash('sha1').update(src).digest('hex');
  const t0 = Date.now();
  const ast = parseICBINCSSWithSource(src, filePath) as any[];
  applyAstIntoDb(db, ast, { migrationId: id, file: filePath });
  saveDb(root, db);
  const dur = Date.now() - t0;
  const row: MigrationRow = {
    id,
    filename: path.basename(filePath),
    direction,
    checksum,
    applied_at_iso: new Date().toISOString(),
    duration_ms: String(dur),
    status: 'ok',
  };
  db.migrations.push(row);
  saveDb(root, db);
  return row;
}

type Ctx = {
  migrationId: string;
  file: string;
};

function nowIso() { return new Date().toISOString(); }

function findSelector(db: DbTables, name: string): SelectorRow | undefined {
  return db.selectors.find(s => s.name === name);
}

function ensureSelector(db: DbTables, name: string, def: any | undefined, ctx: Ctx): SelectorRow {
  let row = findSelector(db, name);
  if (!row) {
    row = {
      id: generateSelectorId(name),  // UUID based on name
      name,
      def_json: def ? JSON.stringify(def) : JSON.stringify(null),
      source_file: ctx.file,
      created_at_iso: nowIso(),
      updated_at_iso: nowIso(),
      created_in_migration: ctx.migrationId,
      deleted_at_iso: ''
    };
    db.selectors.push(row);
  } else if (def) {
    row.def_json = JSON.stringify(def);
    row.updated_at_iso = nowIso();
  }
  return row;
}

function ensureLayer(db: DbTables, name: string): LayerRow {
  let row = db.layers.find(l => l.name === name);
  if (!row) {
    row = {
      id: generateLayerId(name),  // UUID based on name
      name,
      order_index: String(db.layers.length),
      source_file: ''
    };
    db.layers.push(row);
  }
  return row;
}

function ensureToken(db: DbTables, name: string, value: string, ctx: Ctx): TokenRow {
  let row = db.tokens.find(t => t.name === name);
  if (!row) {
    row = {
      id: generateTokenId(name),  // UUID based on name
      name,
      value,
      source_file: ctx.file,
      created_in_migration: ctx.migrationId,
      deleted_at_iso: ''
    };
    db.tokens.push(row);
  } else {
    row.value = value;
  }
  return row;
}

function sameBucket(a: Pick<StyleRow,'selector_id'|'layer_id'|'scope_root_id'|'scope_limit_id'|'resp_kind'|'resp_min'|'resp_max'|'resp_axis'|'container_name'|'condition'>, b: Pick<StyleRow,'selector_id'|'layer_id'|'scope_root_id'|'scope_limit_id'|'resp_kind'|'resp_min'|'resp_max'|'resp_axis'|'container_name'|'condition'>) {
  return a.selector_id === b.selector_id && (a.layer_id || '') === (b.layer_id || '') && (a.scope_root_id || '') === (b.scope_root_id || '') && (a.scope_limit_id || '') === (b.scope_limit_id || '') && (a.resp_kind || '') === (b.resp_kind || '') && (a.resp_min || '') === (b.resp_min || '') && (a.resp_max || '') === (b.resp_max || '') && (a.resp_axis || '') === (b.resp_axis || '') && (a.container_name || '') === (b.container_name || '') && (a.condition || '') === (b.condition || '');
}

function respFromNode(r: any): { kind?: string; min?: string; max?: string; axis?: string; container?: string; condition?: string; features?: string[]; supports?: string } {
  if (!r) return {} as any;
  if (r.type === 'WidthBetween') return { kind: 'media', min: r.min, max: r.max } as any;
  if (r.type === 'WidthMin') return { kind: 'media', min: r.min } as any;
  if (r.type === 'WidthMax') return { kind: 'media', max: r.max } as any;
  if (r.type === 'Container') return { kind: 'container', container: r.container, min: (r as any).min, max: (r as any).max, axis: (r as any).axis, supports: (r as any).supports } as any;
  if ((r as any).type === 'ContainerStyle') return { kind: 'container-style', container: (r as any).container, condition: (r as any).condition } as any;
  if (r.type === 'MediaFeature') return { kind: 'media', features: [`(${r.feature}: ${r.value})`] } as any;
  if (r.type === 'MediaBundle') return { kind: 'media', min: r.min, max: r.max, features: r.features, supports: (r as any).supports } as any;
  if ((r as any).type === 'Supports') return { kind: 'supports', condition: (r as any).condition, supports: (r as any).condition } as any;
  return {} as any;
}

function applyToBucket(db: DbTables, key: Pick<StyleRow,'selector_id'|'layer_id'|'scope_root_id'|'scope_limit_id'|'resp_kind'|'resp_min'|'resp_max'|'resp_axis'|'container_name'|'condition'|'supports_condition'>, prop: string, value: string, ctx: Ctx, action: 'SET'|'ADD') {
  const rows = db.styles;
  const idx = rows.findIndex(r => sameBucket(r, key) && r.prop === prop);
  if (idx === -1) {
    if (action === 'SET' || action === 'ADD') {
      const row: StyleRow = {
        id: generateStyleId(ctx.migrationId, rows.length + 1),  // UUID based on migration + sequence
        selector_id: key.selector_id,
        layer_id: key.layer_id || '',
        scope_root_id: key.scope_root_id || '',
        scope_limit_id: key.scope_limit_id || '',
        prop,
        value,
        resp_kind: key.resp_kind || '',
        resp_min: key.resp_min || '',
        resp_max: key.resp_max || '',
        resp_axis: key.resp_axis || '',
        container_name: key.container_name || '',
        condition: key.condition || '',
        supports_condition: key.supports_condition || '',
        origin_file: ctx.file,
        migration_id: ctx.migrationId,
      };
      rows.push(row);
    }
  } else {
    if (action === 'SET') rows[idx].value = value;
    // ADD does nothing if present
  }
}

export function applyAstIntoDb(db: DbTables, ast: any[], ctx: Ctx) {
  let currentLayer: string | undefined = undefined;
  for (const node of ast) {
    switch (node.type) {
      case 'Token':
        ensureToken(db, node.name, node.value, ctx);
        break;
      case 'DeleteToken': {
        const i = db.tokens.findIndex(t => t.name === node.name);
        if (i !== -1) db.tokens.splice(i, 1);
        break;
      }
      case 'Selector':
        ensureSelector(db, node.name, node.definition, ctx);
        break;
      case 'Layer': {
        let idx = 0;
        for (const name of node.layers) {
          const row = ensureLayer(db, name);
          row.order_index = String(idx++);
        }
        break;
      }
      case 'SetLayer':
        currentLayer = node.layer;
        if (currentLayer) ensureLayer(db, currentLayer);
        break;
      case 'Drop': { // DROP STYLE SELECTOR name
        const sel = findSelector(db, node.selector);
        if (!sel) break;
        for (let i = db.styles.length - 1; i >= 0; i--) {
          if (db.styles[i].selector_id === sel.id) db.styles.splice(i, 1);
        }
        break;
      }
      case 'Delete': { // DELETE FROM style_props WHERE selector = X AND prop = 'p'
        const sel = findSelector(db, node.selector);
        if (!sel) break;
        for (let i = db.styles.length - 1; i >= 0; i--) {
          if (db.styles[i].selector_id === sel.id) {
            if (node.property) {
              if (db.styles[i].prop === node.property) db.styles.splice(i, 1);
            } else db.styles.splice(i, 1);
          }
        }
        break;
      }
      case 'Style': {
        const sel = ensureSelector(db, node.selector, undefined, ctx);
        const layerRow = currentLayer ? ensureLayer(db, currentLayer) : undefined;
        const r = respFromNode((node as any).responsive);
        const scopeRootRow = (node as any).scopeRoot ? ensureSelector(db, (node as any).scopeRoot, undefined, ctx) : undefined;
        const scopeLimitRow = (node as any).scopeLimit ? ensureSelector(db, (node as any).scopeLimit, undefined, ctx) : undefined;
        const keyBase: Pick<StyleRow,'selector_id'|'layer_id'|'scope_root_id'|'scope_limit_id'|'resp_kind'|'resp_min'|'resp_max'|'resp_axis'|'container_name'|'condition'|'supports_condition'> = {
          selector_id: sel.id,
          layer_id: layerRow?.id || '',
          scope_root_id: scopeRootRow?.id || '',
          scope_limit_id: scopeLimitRow?.id || '',
          resp_kind: (r.kind || '') as StyleRow['resp_kind'],
          resp_min: (r.min || '') as string,
          resp_max: (r.max || '') as string,
          resp_axis: (r.axis || '') as StyleRow['resp_axis'],
          container_name: (r.container || '') as string,
          condition: (r.features && r.features.length ? r.features.join(' and ') : r.condition || '') as string,
          supports_condition: (r.supports || '') as string,
        } satisfies Pick<StyleRow,'selector_id'|'layer_id'|'scope_root_id'|'scope_limit_id'|'resp_kind'|'resp_min'|'resp_max'|'resp_axis'|'container_name'|'condition'|'supports_condition'>;
        // MediaOr expansion handled in AlterStyle; CREATE STYLE uses single responsive bucket today
        for (const p of node.properties) applyToBucket(db, keyBase, p.name, p.value, ctx, 'SET');
        break;
      }
      case 'FontFace': {
        const props = (node as any).properties.map((p: any) => ({ name: p.name, value: String(p.value) }));
        const family = (node as any).family;
        const srcProp = props.find((p: any) => p.name === 'src');
        const src = srcProp?.value || family;
        const row: FontFaceRow = {
          id: generateFontFaceId(family, src),
          family: family,
          props_json: JSON.stringify(props),
          origin_file: ctx.file,
          migration_id: ctx.migrationId,
        };
        db.font_faces.push(row);
        break;
      }
      case 'Keyframes': {
        const frames = (node as any).frames.map((f: any) => ({ offset: f.offset, props: f.properties.map((p: any) => ({ name: p.name, value: String(p.value) })) }));
        const row: KeyframesRow = {
          id: generateKeyframesId((node as any).name),
          name: (node as any).name,
          frames_json: JSON.stringify(frames),
          origin_file: ctx.file,
          migration_id: ctx.migrationId,
        };
        db.keyframes.push(row);
        break;
      }
      case 'Property': {
        const props = (node as any).properties;
        const syntax = props.find((p: any) => p.name === 'syntax')?.value || '';
        const inherits = props.find((p: any) => p.name === 'inherits')?.value || '';
        const initialValue = props.find((p: any) => p.name === 'initial_value')?.value || '';
        const row: PropertyRow = {
          id: generatePropertyId((node as any).name),
          name: (node as any).name,
          syntax,
          inherits,
          initial_value: initialValue,
          origin_file: ctx.file,
          migration_id: ctx.migrationId,
        };
        db.properties.push(row);
        break;
      }
      case 'DropProperty': {
        const i = db.properties.findIndex(p => p.name === (node as any).name);
        if (i !== -1) db.properties.splice(i, 1);
        break;
      }
      case 'Raw': {
        const row: RawBlockRow = {
          id: generateRawBlockId(ctx.migrationId, db.raw_blocks.length + 1),
          css: (node as any).css,
          origin_file: ctx.file,
          migration_id: ctx.migrationId,
        };
        db.raw_blocks.push(row);
        break;
      }
      case 'Import': {
        const row: ImportRow = {
          id: generateImportId(ctx.migrationId, db.imports.length + 1),
          import_type: (node as any).importType,
          path: (node as any).path,
          media: (node as any).media || '',
          origin_file: ctx.file,
          migration_id: ctx.migrationId,
        };
        db.imports.push(row);
        break;
      }
      case 'Page': {
        const props = (node as any).properties.map((p: any) => ({ name: p.name, value: String(p.value) }));
        const pseudo = (node as any).pseudo || null;
        const row: PageRow = {
          id: generatePageId(pseudo),
          pseudo: (node as any).pseudo || '',
          props_json: JSON.stringify(props),
          origin_file: ctx.file,
          migration_id: ctx.migrationId,
        };
        db.pages.push(row);
        break;
      }
      case 'DropPage': {
        const pseudo = (node as any).pseudo;
        for (let i = db.pages.length - 1; i >= 0; i--) {
          if ((pseudo && db.pages[i].pseudo === pseudo) || (!pseudo && !db.pages[i].pseudo)) {
            db.pages.splice(i, 1);
          }
        }
        break;
      }
      case 'CounterStyle': {
        const props = (node as any).properties.map((p: any) => ({ name: p.name, value: String(p.value) }));
        const row: CounterStyleRow = {
          id: generateCounterStyleId((node as any).name),
          name: (node as any).name,
          props_json: JSON.stringify(props),
          origin_file: ctx.file,
          migration_id: ctx.migrationId,
        };
        db.counter_styles.push(row);
        break;
      }
      case 'DropCounterStyle': {
        const name = (node as any).name;
        for (let i = db.counter_styles.length - 1; i >= 0; i--) {
          if (db.counter_styles[i].name === name) {
            db.counter_styles.splice(i, 1);
          }
        }
        break;
      }
      case 'FontFeatureValues': {
        const features = (node as any).properties.map((p: any) => ({ name: p.name, value: String(p.value) }));
        const row: FontFeatureValuesRow = {
          id: generateFontFeatureValuesId((node as any).family),
          family: (node as any).family,
          features_json: JSON.stringify(features),
          origin_file: ctx.file,
          migration_id: ctx.migrationId,
        };
        db.font_feature_values.push(row);
        break;
      }
      case 'DropFontFeatureValues': {
        const family = (node as any).family;
        for (let i = db.font_feature_values.length - 1; i >= 0; i--) {
          if (db.font_feature_values[i].family === family) {
            db.font_feature_values.splice(i, 1);
          }
        }
        break;
      }
      case 'FontPaletteValues': {
        const props = (node as any).properties.map((p: any) => ({ name: p.name, value: String(p.value) }));
        const row: FontPaletteValuesRow = {
          id: generateFontPaletteValuesId((node as any).name),
          name: (node as any).name,
          props_json: JSON.stringify(props),
          origin_file: ctx.file,
          migration_id: ctx.migrationId,
        };
        db.font_palette_values.push(row);
        break;
      }
      case 'DropFontPaletteValues': {
        const name = (node as any).name;
        for (let i = db.font_palette_values.length - 1; i >= 0; i--) {
          if (db.font_palette_values[i].name === name) {
            db.font_palette_values.splice(i, 1);
          }
        }
        break;
      }
      case 'StartingStyle': {
        const selectorRow = ensureSelector(db, (node as any).selector, undefined, ctx);
        const props = (node as any).properties.map((p: any) => ({ name: p.name, value: String(p.value) }));
        const row: StartingStyleRow = {
          id: generateStartingStyleId(ctx.migrationId, db.starting_styles.length + 1),
          selector_id: selectorRow.id,
          props_json: JSON.stringify(props),
          origin_file: ctx.file,
          migration_id: ctx.migrationId,
        };
        db.starting_styles.push(row);
        break;
      }
      case 'DropStartingStyle': {
        const selector = (node as any).selector;
        for (let i = db.starting_styles.length - 1; i >= 0; i--) {
          if (db.starting_styles[i].selector_id === selector) {
            db.starting_styles.splice(i, 1);
          }
        }
        break;
      }
      case 'AlterStyle': {
        const sel = ensureSelector(db, node.selector, undefined, ctx);
        const layerRow = currentLayer ? ensureLayer(db, currentLayer) : undefined;
        const r = (node as any).responsive;
        const scopeRootRow = (node as any).scopeRoot ? ensureSelector(db, (node as any).scopeRoot, undefined, ctx) : undefined;
        const scopeLimitRow = (node as any).scopeLimit ? ensureSelector(db, (node as any).scopeLimit, undefined, ctx) : undefined;
        const applyWith = (rr: any) => {
          const rf = respFromNode(rr);
        const keyBase: Pick<StyleRow,'selector_id'|'layer_id'|'scope_root_id'|'scope_limit_id'|'resp_kind'|'resp_min'|'resp_max'|'resp_axis'|'container_name'|'condition'|'supports_condition'> = {
            selector_id: sel.id,
            layer_id: layerRow?.id || '',
            scope_root_id: scopeRootRow?.id || '',
            scope_limit_id: scopeLimitRow?.id || '',
            resp_kind: (rf.kind || '') as StyleRow['resp_kind'],
            resp_min: (rf.min || '') as string,
            resp_max: (rf.max || '') as string,
            resp_axis: (rf.axis || '') as StyleRow['resp_axis'],
            container_name: (rf.container || '') as string,
            condition: (rf.features && rf.features.length ? rf.features.join(' and ') : rf.condition || '') as string,
            supports_condition: (rf.supports || '') as string,
          } satisfies Pick<StyleRow,'selector_id'|'layer_id'|'scope_root_id'|'scope_limit_id'|'resp_kind'|'resp_min'|'resp_max'|'resp_axis'|'container_name'|'condition'|'supports_condition'>;
          for (const p of node.properties) applyToBucket(db, keyBase, p.name, p.value, ctx, node.action);
        };
        if (r?.type === 'MediaOr') {
          for (const opt of r.options) applyWith(opt);
        } else applyWith(r);
        break;
      }
      default:
        // Ignore other statements in DB for now (RAW, keyframes, font-face, queries, transactions)
        break;
    }
  }
}

// Rebuild the CSV DB from optional catalog files (tokens/selectors) and the applied migrations history
export function rebuildDbFromFiles(root: string) {
  const icbDir = path.join(root, 'icbincss');
  ensureDb(root);
  const existing = loadDb(root);
  const fresh: DbTables = { migrations: existing.migrations.slice(), tokens: [], selectors: [], layers: [], styles: [], properties: [], font_faces: [], keyframes: [], raw_blocks: [], imports: [], pages: [], counter_styles: [], font_feature_values: [], font_palette_values: [], starting_styles: [] } as any;
  const tpath = path.join(icbDir, 'tokens.sql');
  const spath = path.join(icbDir, 'selectors.sql');
  if (fs.existsSync(tpath)) {
    const src = fs.readFileSync(tpath, 'utf8');
    const ast = parseICBINCSSWithSource(src, tpath) as any[];
    applyAstIntoDb(fresh, ast, { migrationId: 'bootstrap', file: tpath });
  }
  if (fs.existsSync(spath)) {
    const src = fs.readFileSync(spath, 'utf8');
    const ast = parseICBINCSSWithSource(src, spath) as any[];
    applyAstIntoDb(fresh, ast, { migrationId: 'bootstrap', file: spath });
  }
  const upDir = path.join(icbDir, 'migrations', 'up');
  const downDir = path.join(icbDir, 'migrations', 'down');
  for (const row of existing.migrations) {
    const dir = row.direction === 'up' ? upDir : downDir;
    const p = path.join(dir, row.filename);
    if (!fs.existsSync(p)) { continue; }
    const src = fs.readFileSync(p, 'utf8');
    const ast = parseICBINCSSWithSource(src, p) as any[];
    applyAstIntoDb(fresh, ast, { migrationId: row.id, file: p });
  }
  saveDb(root, fresh);
}
