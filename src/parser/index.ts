// Parser entry that prefers a precompiled parser (generated.ts) for fast startup.
// Falls back to building the parser from grammar.peggy at runtime when developing/tests.
import type { MigrationFileAST } from './ast.js';
// Use the precompiled parser. Ensure scripts/build-parser.cjs has generated ./generated.ts
// before building or running tests.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as generatedParser from './generated.js';

export function parseICBINCSS(sql: string): MigrationFileAST {
  const src = sql.replace(/\r\n?/g, '\n');
  return (generatedParser as any).parse(src) as MigrationFileAST;
}

export function parseICBINCSSWithSource(sql: string, source?: string): MigrationFileAST {
  const nodes = parseICBINCSS(sql) as unknown as any[];
  if (source) for (const n of nodes) (n as any)._file = source;
  return nodes as MigrationFileAST;
}

// expandMigrationPhase removed; phases are controlled by file layout (up/down)
