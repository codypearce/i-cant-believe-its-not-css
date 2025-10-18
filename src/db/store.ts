import path from 'path';
import fs from 'fs-extra';
import { readCsv, writeCsv } from './csv.js';
import type { DbTables } from './schema.js';
import { Headers } from './schema.js';

export function ensureDb(root: string) {
  fs.ensureDirSync(path.join(root, 'icbincss', 'db'));
}

export function loadDb(root: string): DbTables {
  const dbDir = path.join(root, 'icbincss', 'db');
  const read = (name: string) => readCsv(path.join(dbDir, `${name}.csv`));
  return {
    migrations: read('migrations') as any,
    tokens: read('tokens') as any,
    selectors: read('selectors') as any,
    layers: read('layers') as any,
    styles: read('styles') as any,
    properties: read('properties') as any,
    font_faces: read('font_faces') as any,
    keyframes: read('keyframes') as any,
    raw_blocks: read('raw_blocks') as any,
    imports: read('imports') as any,
    pages: read('pages') as any,
    counter_styles: read('counter_styles') as any,
    font_feature_values: read('font_feature_values') as any,
    font_palette_values: read('font_palette_values') as any,
    starting_styles: read('starting_styles') as any,
  };
}

export function saveDb(root: string, db: DbTables) {
  const dbDir = path.join(root, 'icbincss', 'db');
  const write = (name: keyof DbTables, rows: any[], headers: readonly string[]) => {
    writeCsv(path.join(dbDir, `${name}.csv`), rows as any, headers as any);
  };
  write('migrations', db.migrations, Headers.migrations);
  write('tokens', db.tokens, Headers.tokens);
  write('selectors', db.selectors, Headers.selectors);
  write('layers', db.layers, Headers.layers);
  write('styles', db.styles, Headers.styles);
  write('properties', db.properties || [], Headers.properties);
  write('font_faces', db.font_faces, Headers.font_faces);
  write('keyframes', db.keyframes, Headers.keyframes);
  write('raw_blocks', db.raw_blocks, Headers.raw_blocks);
  write('imports', db.imports, Headers.imports);
  write('pages', db.pages, Headers.pages);
  write('counter_styles', db.counter_styles, Headers.counter_styles);
  write('font_feature_values', db.font_feature_values, Headers.font_feature_values);
  write('font_palette_values', db.font_palette_values, Headers.font_palette_values);
  write('starting_styles', db.starting_styles, Headers.starting_styles);
}

export function initEmptyDb(root: string) {
  ensureDb(root);
  saveDb(root, { migrations: [], tokens: [], selectors: [], layers: [], styles: [], properties: [], font_faces: [], keyframes: [], raw_blocks: [], imports: [], pages: [], counter_styles: [], font_feature_values: [], font_palette_values: [], starting_styles: [] });
}
