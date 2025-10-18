// Database dialect-specific schema generation
// Optimizes schemas for SQLite, Postgres, and MySQL

import type { DbTables } from './schema.js';
import { Headers } from './schema.js';

export type Dialect = 'sqlite' | 'postgres' | 'mysql';

/**
 * Generate CREATE TABLE statements for a specific dialect
 */
export function generateSchema(dialect: Dialect): string {
  switch (dialect) {
    case 'sqlite':
      return generateSqliteSchema();
    case 'postgres':
      return generatePostgresSchema();
    case 'mysql':
      return generateMysqlSchema();
    default:
      throw new Error(`Unknown dialect: ${dialect}`);
  }
}

/**
 * Generate INSERT statements for database data (dialect-specific)
 */
export function generateInserts(db: DbTables, dialect: Dialect): string {
  const lines: string[] = [];

  // Escape function that handles NULL values properly for each dialect
  const esc = (v: any) => {
    // For NULL/empty values, Postgres needs NULL, SQLite can use ''
    if (v === null || v === undefined || v === '') {
      return dialect === 'postgres' ? 'NULL' : "''";
    }

    // For non-empty values, escape single quotes (and backslashes for Postgres)
    const escaped = String(v).replace(/'/g, "''");
    const finalValue = dialect === 'postgres' ? escaped.replace(/\\/g, '\\\\') : escaped;
    return `'${finalValue}'`;
  };

  const emitInserts = (table: string, headers: string[], rows: any[]) => {
    for (const r of rows) {
      // For Postgres migrations table, exclude 'seq' column (auto-increment)
      let finalHeaders = headers;
      if (dialect === 'postgres' && table === 'migrations') {
        // Exclude 'seq' and 'filename' columns
        finalHeaders = headers.filter(h => h !== 'seq' && h !== 'filename');
      }

      // Map column names for the dialect
      const mappedHeaders = finalHeaders.map(h => {
        if (dialect !== 'postgres') return h;

        // Map timestamp columns
        if (h === 'applied_at_iso') return 'applied_at';
        if (h === 'deleted_at_iso') return 'deleted_at';
        if (h === 'created_at_iso') return 'created_at';
        if (h === 'updated_at_iso') return 'updated_at';

        // Map 'id' to 'migration_id' ONLY for migrations table
        if (h === 'id' && table === 'migrations') return 'migration_id';

        return h;
      });

      const vals = finalHeaders.map(h => esc((r as any)[h]));

      lines.push(`INSERT INTO ${table} (${mappedHeaders.join(', ')}) VALUES (${vals.join(', ')});`);
    }
  };

  emitInserts('migrations', Headers.migrations as any, db.migrations);
  emitInserts('tokens', Headers.tokens as any, db.tokens);
  emitInserts('selectors', Headers.selectors as any, db.selectors);
  emitInserts('layers', Headers.layers as any, db.layers);
  emitInserts('styles', Headers.styles as any, db.styles);
  emitInserts('properties', Headers.properties as any, db.properties || []);
  emitInserts('font_faces', Headers.font_faces as any, db.font_faces || []);
  emitInserts('keyframes', Headers.keyframes as any, db.keyframes || []);
  emitInserts('raw_blocks', Headers.raw_blocks as any, db.raw_blocks || []);
  emitInserts('imports', Headers.imports as any, db.imports || []);
  emitInserts('pages', Headers.pages as any, db.pages || []);
  emitInserts('counter_styles', Headers.counter_styles as any, db.counter_styles || []);
  emitInserts('font_feature_values', Headers.font_feature_values as any, db.font_feature_values || []);
  emitInserts('font_palette_values', Headers.font_palette_values as any, db.font_palette_values || []);
  emitInserts('starting_styles', Headers.starting_styles as any, db.starting_styles || []);

  return lines.join('\n');
}

/**
 * SQLite schema (simple, TEXT for everything)
 */
function generateSqliteSchema(): string {
  return `-- ICBINCSS SQLite Schema

CREATE TABLE IF NOT EXISTS migrations (
  id TEXT NOT NULL,
  filename TEXT NOT NULL,
  direction TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at_iso TEXT NOT NULL,
  duration_ms TEXT,
  status TEXT,
  PRIMARY KEY (id, applied_at_iso)
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  source_file TEXT,
  created_in_migration TEXT,
  deleted_at_iso TEXT
);

CREATE TABLE IF NOT EXISTS selectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  def_json TEXT NOT NULL,
  source_file TEXT,
  created_at_iso TEXT,
  updated_at_iso TEXT,
  created_in_migration TEXT,
  deleted_at_iso TEXT
);

CREATE TABLE IF NOT EXISTS layers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  order_index TEXT NOT NULL,
  source_file TEXT
);

CREATE TABLE IF NOT EXISTS styles (
  id TEXT PRIMARY KEY,
  selector_id TEXT NOT NULL,
  layer_id TEXT,
  scope_root_id TEXT,
  scope_limit_id TEXT,
  prop TEXT NOT NULL,
  value TEXT NOT NULL,
  resp_kind TEXT,
  resp_min TEXT,
  resp_max TEXT,
  resp_axis TEXT,
  container_name TEXT,
  condition TEXT,
  supports_condition TEXT,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  syntax TEXT,
  inherits TEXT,
  initial_value TEXT,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS font_faces (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  props_json TEXT NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS keyframes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  frames_json TEXT NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS raw_blocks (
  id TEXT PRIMARY KEY,
  css TEXT NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL,
  path TEXT NOT NULL,
  media TEXT,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  pseudo TEXT,
  props_json TEXT NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS counter_styles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  props_json TEXT NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS font_feature_values (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  features_json TEXT NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS font_palette_values (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  props_json TEXT NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS starting_styles (
  id TEXT PRIMARY KEY,
  selector_id TEXT NOT NULL,
  props_json TEXT NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);

-- Views to simplify current migration state
CREATE VIEW IF NOT EXISTS migrations_latest AS
SELECT m.*
FROM migrations m
JOIN (
  SELECT id, MAX(applied_at_iso) AS max_applied
  FROM migrations
  GROUP BY id
) t ON m.id = t.id AND m.applied_at_iso = t.max_applied;

CREATE VIEW IF NOT EXISTS applied_migrations AS
SELECT * FROM migrations_latest WHERE direction = 'up';
`;
}

/**
 * Postgres schema (JSONB, proper types, indexes, views, constraints)
 */
function generatePostgresSchema(): string {
  return `-- ICBINCSS Postgres Schema (Optimized with UUIDs)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS migrations (
  seq BIGSERIAL PRIMARY KEY,                -- auto-increment audit log sequence
  migration_id TEXT NOT NULL,                -- '001_init', '002_add_layers'
  direction TEXT NOT NULL CHECK (direction IN ('up', 'down')),
  checksum TEXT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  status TEXT CHECK (status IN ('ok', 'error'))
);
CREATE INDEX IF NOT EXISTS idx_migrations_migration_id ON migrations(migration_id);

CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  name TEXT NOT NULL UNIQUE,                 -- natural key, can be renamed
  value TEXT NOT NULL,
  source_file TEXT,
  created_in_migration TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_tokens_name ON tokens(name);

CREATE TABLE IF NOT EXISTS selectors (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  name TEXT NOT NULL UNIQUE,                 -- natural key, can be renamed
  def_json JSONB NOT NULL,
  source_file TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_in_migration TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_selectors_name ON selectors(name);

CREATE TABLE IF NOT EXISTS layers (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  name TEXT NOT NULL UNIQUE,                 -- natural key, can be renamed
  order_index INTEGER NOT NULL,
  source_file TEXT
);
CREATE INDEX IF NOT EXISTS idx_layers_name ON layers(name);

CREATE TABLE IF NOT EXISTS styles (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  selector_id UUID NOT NULL REFERENCES selectors(id) ON DELETE CASCADE,
  layer_id UUID REFERENCES layers(id) ON DELETE SET NULL,
  scope_root_id UUID REFERENCES selectors(id) ON DELETE SET NULL,
  scope_limit_id UUID REFERENCES selectors(id) ON DELETE SET NULL,
  prop TEXT NOT NULL,
  value TEXT NOT NULL,
  resp_kind TEXT CHECK (resp_kind IN ('media', 'container', 'container-style', 'supports', '')),
  resp_min TEXT,
  resp_max TEXT,
  resp_axis TEXT CHECK (resp_axis IN ('inline', '')),
  container_name TEXT,
  condition TEXT,
  supports_condition TEXT,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  name TEXT NOT NULL UNIQUE,                 -- natural key, can be renamed
  syntax TEXT,
  inherits BOOLEAN,
  initial_value TEXT,
  origin_file TEXT,
  migration_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_properties_name ON properties(name);

CREATE TABLE IF NOT EXISTS font_faces (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  family TEXT NOT NULL,
  props_json JSONB NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_font_faces_family ON font_faces(family);

CREATE TABLE IF NOT EXISTS keyframes (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  name TEXT NOT NULL UNIQUE,                 -- natural key, can be renamed
  frames_json JSONB NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_keyframes_name ON keyframes(name);

CREATE TABLE IF NOT EXISTS raw_blocks (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  css TEXT NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS imports (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  import_type TEXT NOT NULL CHECK (import_type IN ('sql', 'css')),
  path TEXT NOT NULL,
  media TEXT,
  origin_file TEXT,
  migration_id TEXT
);

CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  pseudo TEXT,
  props_json JSONB NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_pages_pseudo ON pages(pseudo);

CREATE TABLE IF NOT EXISTS counter_styles (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  name TEXT NOT NULL UNIQUE,                 -- natural key, can be renamed
  props_json JSONB NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_counter_styles_name ON counter_styles(name);

CREATE TABLE IF NOT EXISTS font_feature_values (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  family TEXT NOT NULL,
  features_json JSONB NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_font_feature_values_family ON font_feature_values(family);

CREATE TABLE IF NOT EXISTS font_palette_values (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  name TEXT NOT NULL UNIQUE,                 -- natural key, can be renamed
  props_json JSONB NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_font_palette_values_name ON font_palette_values(name);

CREATE TABLE IF NOT EXISTS starting_styles (
  id UUID PRIMARY KEY,                       -- immutable surrogate key (UUIDv5)
  selector_id UUID NOT NULL REFERENCES selectors(id) ON DELETE CASCADE,
  props_json JSONB NOT NULL,
  origin_file TEXT,
  migration_id TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_styles_selector_id ON styles(selector_id);
CREATE INDEX IF NOT EXISTS idx_styles_layer_id ON styles(layer_id);
CREATE INDEX IF NOT EXISTS idx_styles_resp_kind ON styles(resp_kind);
CREATE INDEX IF NOT EXISTS idx_styles_migration_id ON styles(migration_id);
CREATE INDEX IF NOT EXISTS idx_styles_scope_root_id ON styles(scope_root_id);
CREATE INDEX IF NOT EXISTS idx_styles_scope_limit_id ON styles(scope_limit_id);

CREATE INDEX IF NOT EXISTS idx_starting_styles_selector_id ON starting_styles(selector_id);

-- GIN indexes for JSONB columns (enables fast JSON queries)
CREATE INDEX IF NOT EXISTS idx_selectors_def_json ON selectors USING GIN (def_json);
CREATE INDEX IF NOT EXISTS idx_font_faces_props ON font_faces USING GIN (props_json);
CREATE INDEX IF NOT EXISTS idx_keyframes_frames ON keyframes USING GIN (frames_json);
CREATE INDEX IF NOT EXISTS idx_pages_props ON pages USING GIN (props_json);
CREATE INDEX IF NOT EXISTS idx_counter_styles_props ON counter_styles USING GIN (props_json);
CREATE INDEX IF NOT EXISTS idx_font_feature_values_features ON font_feature_values USING GIN (features_json);
CREATE INDEX IF NOT EXISTS idx_font_palette_values_props ON font_palette_values USING GIN (props_json);
CREATE INDEX IF NOT EXISTS idx_starting_styles_props ON starting_styles USING GIN (props_json);

-- Views to simplify current migration state
CREATE OR REPLACE VIEW migrations_latest AS
SELECT m.*
FROM migrations m
JOIN (
  SELECT migration_id, MAX(applied_at) AS max_applied
  FROM migrations
  GROUP BY migration_id
) t ON m.migration_id = t.migration_id AND m.applied_at = t.max_applied;

CREATE OR REPLACE VIEW applied_migrations AS
SELECT * FROM migrations_latest WHERE direction = 'up';

-- Useful views for common joins
CREATE OR REPLACE VIEW styles_with_selectors AS
  SELECT
    s.*,
    sel.name AS selector_name,
    sel.def_json AS selector_def
  FROM styles s
  JOIN selectors sel ON s.selector_id = sel.id
  WHERE sel.deleted_at IS NULL;

CREATE OR REPLACE VIEW styles_with_layers AS
  SELECT
    s.*,
    l.name AS layer_name,
    l.order_index AS layer_order
  FROM styles s
  LEFT JOIN layers l ON s.layer_id = l.id;

CREATE OR REPLACE VIEW active_tokens AS
  SELECT * FROM tokens
  WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_selectors AS
  SELECT * FROM selectors
  WHERE deleted_at IS NULL;

-- View combining styles with full context
CREATE OR REPLACE VIEW styles_full AS
  SELECT
    s.id,
    s.prop,
    s.value,
    sel.name AS selector_name,
    sel.def_json AS selector_def,
    l.name AS layer_name,
    l.order_index AS layer_order,
    s.resp_kind,
    s.resp_min,
    s.resp_max,
    s.resp_axis,
    s.container_name,
    s.condition,
    s.origin_file,
    s.migration_id
  FROM styles s
  JOIN selectors sel ON s.selector_id = sel.id
  LEFT JOIN layers l ON s.layer_id = l.id
  WHERE sel.deleted_at IS NULL;
`;
}

/**
 * MySQL schema (JSON type, proper types, indexes)
 */
function generateMysqlSchema(): string {
  return `-- ICBINCSS MySQL Schema (Optimized)

CREATE TABLE IF NOT EXISTS migrations (
  id VARCHAR(255) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  direction ENUM('up', 'down') NOT NULL,
  checksum VARCHAR(255) NOT NULL,
  applied_at_iso DATETIME NOT NULL,
  duration_ms INT,
  status ENUM('ok', 'error')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tokens (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  source_file TEXT,
  created_in_migration VARCHAR(255),
  deleted_at_iso DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS selectors (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  def_json JSON NOT NULL,
  source_file TEXT,
  created_at_iso DATETIME,
  updated_at_iso DATETIME,
  created_in_migration VARCHAR(255),
  deleted_at_iso DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS layers (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  order_index INT NOT NULL,
  source_file TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS styles (
  id VARCHAR(255) PRIMARY KEY,
  selector_id VARCHAR(255) NOT NULL,
  layer_id VARCHAR(255),
  scope_root_id VARCHAR(255),
  scope_limit_id VARCHAR(255),
  prop VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  resp_kind ENUM('media', 'container', 'container-style', 'supports', ''),
  resp_min VARCHAR(255),
  resp_max VARCHAR(255),
  resp_axis ENUM('inline', ''),
  container_name VARCHAR(255),
  condition TEXT,
  origin_file TEXT,
  migration_id VARCHAR(255),
  INDEX idx_selector_id (selector_id),
  INDEX idx_layer_id (layer_id),
  INDEX idx_resp_kind (resp_kind),
  INDEX idx_migration_id (migration_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS properties (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  syntax VARCHAR(255),
  inherits BOOLEAN,
  initial_value TEXT,
  origin_file TEXT,
  migration_id VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS font_faces (
  id VARCHAR(255) PRIMARY KEY,
  family VARCHAR(255) NOT NULL,
  props_json JSON NOT NULL,
  origin_file TEXT,
  migration_id VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS keyframes (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  frames_json JSON NOT NULL,
  origin_file TEXT,
  migration_id VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS raw_blocks (
  id VARCHAR(255) PRIMARY KEY,
  css TEXT NOT NULL,
  origin_file TEXT,
  migration_id VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS imports (
  id VARCHAR(255) PRIMARY KEY,
  import_type ENUM('sql', 'css') NOT NULL,
  path VARCHAR(255) NOT NULL,
  media VARCHAR(255),
  origin_file TEXT,
  migration_id VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pages (
  id VARCHAR(255) PRIMARY KEY,
  pseudo VARCHAR(255),
  props_json JSON NOT NULL,
  origin_file TEXT,
  migration_id VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS counter_styles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  props_json JSON NOT NULL,
  origin_file TEXT,
  migration_id VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS font_feature_values (
  id VARCHAR(255) PRIMARY KEY,
  family VARCHAR(255) NOT NULL,
  features_json JSON NOT NULL,
  origin_file TEXT,
  migration_id VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS font_palette_values (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  props_json JSON NOT NULL,
  origin_file TEXT,
  migration_id VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS starting_styles (
  id VARCHAR(255) PRIMARY KEY,
  selector_id VARCHAR(255) NOT NULL,
  props_json JSON NOT NULL,
  origin_file TEXT,
  migration_id VARCHAR(255),
  INDEX idx_selector_id (selector_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;
}

/**
 * Parse a Postgres connection string
 * Format: postgresql://user:password@host:port/database
 */
export function parsePostgresConnectionString(connStr: string): {
  user?: string;
  password?: string;
  host: string;
  port: number;
  database: string;
} {
  // Handle both postgres:// and postgresql:// schemes
  const match = connStr.match(/^(?:postgres|postgresql):\/\/(?:([^:]+):([^@]+)@)?([^:\/]+)(?::(\d+))?\/(.+)$/);

  if (!match) {
    throw new Error(`Invalid Postgres connection string: ${connStr}`);
  }

  const [, user, password, host, portStr, database] = match;

  return {
    user: user || undefined,
    password: password || undefined,
    host: host || 'localhost',
    port: portStr ? parseInt(portStr, 10) : 5432,
    database: database || 'icbincss',
  };
}

/**
 * Build a Postgres connection string from components
 */
export function buildPostgresConnectionString(opts: {
  user?: string;
  password?: string;
  host?: string;
  port?: number;
  database: string;
}): string {
  const host = opts.host || 'localhost';
  const port = opts.port || 5432;
  const auth = opts.user && opts.password ? `${opts.user}:${opts.password}@` : '';

  return `postgresql://${auth}${host}:${port}/${opts.database}`;
}
