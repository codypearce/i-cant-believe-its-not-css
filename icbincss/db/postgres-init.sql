-- ICBINCSS Postgres Schema (Optimized with UUIDs)

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


INSERT INTO migrations (migration_id, direction, checksum, applied_at, duration_ms, status) VALUES ('001_init', 'up', 'de3be4e561190bc1d582218567eb336ede4b48ec', '2025-10-18T19:06:13.130Z', '6', 'ok');
INSERT INTO migrations (migration_id, direction, checksum, applied_at, duration_ms, status) VALUES ('20251018192449__supports_mix', 'up', '91b00fced002335892e7e13f35dfb5da4f856abf', '2025-10-18T19:25:10.701Z', '6', 'ok');
INSERT INTO migrations (migration_id, direction, checksum, applied_at, duration_ms, status) VALUES ('20251018194435__test_comprehensive', 'up', '0657784e27106b34b680ce8692417334c13d56d1', '2025-10-18T19:45:17.507Z', '8', 'ok');
INSERT INTO tokens (id, name, value, source_file, created_in_migration, deleted_at) VALUES ('1e6eecff-70dc-5320-b0a9-09821b659910', 'brand/500', '#2266ee', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init', NULL);
INSERT INTO tokens (id, name, value, source_file, created_in_migration, deleted_at) VALUES ('24ccc119-9836-5c45-a659-b8076a8e8b43', 'space/4', '16px', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init', NULL);
INSERT INTO tokens (id, name, value, source_file, created_in_migration, deleted_at) VALUES ('cd82bc1d-1e2d-56f2-b36e-2ed8a2ecb215', 'accent/red', '#ff4444', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive', NULL);
INSERT INTO tokens (id, name, value, source_file, created_in_migration, deleted_at) VALUES ('6a51374c-4d86-5767-9840-f25c54192da7', 'spacing/lg', '32px', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive', NULL);
INSERT INTO selectors (id, name, def_json, source_file, created_at, updated_at, created_in_migration, deleted_at) VALUES ('a91d6bae-525e-55ff-a18f-9e839a390c6f', 'card', '{"kind":"Class","value":"card"}', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '2025-10-18T19:06:13.128Z', '2025-10-18T19:06:13.128Z', '001_init', NULL);
INSERT INTO selectors (id, name, def_json, source_file, created_at, updated_at, created_in_migration, deleted_at) VALUES ('c200aa63-ca83-5251-97c9-55b9ef192091', 'btn', '{"kind":"And","selectors":[{"kind":"Element","value":"button"},{"kind":"Class","value":"primary"}]}', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '2025-10-18T19:06:13.128Z', '2025-10-18T19:06:13.128Z', '001_init', NULL);
INSERT INTO selectors (id, name, def_json, source_file, created_at, updated_at, created_in_migration, deleted_at) VALUES ('ff101658-38ea-58bd-a2b1-1f46f8de6063', 'hero', '{"kind":"Class","value":"hero"}', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '2025-10-18T19:45:17.503Z', '2025-10-18T19:45:17.504Z', '20251018194435__test_comprehensive', NULL);
INSERT INTO selectors (id, name, def_json, source_file, created_at, updated_at, created_in_migration, deleted_at) VALUES ('1a003e62-3c20-5909-8a44-c5a22bacc041', 'hero_title', '{"kind":"Child","parent":{"kind":"Ref","name":"hero"},"child":{"kind":"Element","value":"h1"}}', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '2025-10-18T19:45:17.504Z', '2025-10-18T19:45:17.504Z', '20251018194435__test_comprehensive', NULL);
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('0c5cc550-0c74-551c-ba99-c4abaa7e8a1c', 'a91d6bae-525e-55ff-a18f-9e839a390c6f', NULL, NULL, NULL, 'background', '#fff', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('2044a995-ecf2-597c-887d-fe1380ca85ac', 'a91d6bae-525e-55ff-a18f-9e839a390c6f', NULL, NULL, NULL, 'padding', 'token(''space/4'')', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('f422733c-4b87-569a-93c3-e3d9838d181c', 'c200aa63-ca83-5251-97c9-55b9ef192091', NULL, NULL, NULL, 'background', 'token(''brand/500'')', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('a3e138ef-7ceb-5ad7-afcd-7a506b01683d', 'c200aa63-ca83-5251-97c9-55b9ef192091', NULL, NULL, NULL, 'color', '#fff', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('7f82d9d1-d0dc-52b5-9bdb-37c59132ec4f', 'a91d6bae-525e-55ff-a18f-9e839a390c6f', NULL, NULL, NULL, 'display', 'grid', 'media', '768px', NULL, NULL, NULL, NULL, '(display: grid)', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018192449__supports_mix.sql', '20251018192449__supports_mix');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('f568fae6-6d2a-5ba5-a8c4-1999a5b47413', 'ff101658-38ea-58bd-a2b1-1f46f8de6063', NULL, NULL, NULL, 'background', 'token(''accent/red'')', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('374f6b34-47ec-592e-8cfe-38013477d316', 'ff101658-38ea-58bd-a2b1-1f46f8de6063', NULL, NULL, NULL, 'padding', 'token(''spacing/lg'')', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('ea674819-b30b-5531-89de-6f178c93528b', 'ff101658-38ea-58bd-a2b1-1f46f8de6063', NULL, NULL, NULL, 'color', 'white', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('84f17916-aa44-5d7b-a5cf-2428fe3622f5', '1a003e62-3c20-5909-8a44-c5a22bacc041', NULL, NULL, NULL, 'font_size', '48px', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('bb3ae075-db5c-5d6d-96c0-72251ed80f8a', '1a003e62-3c20-5909-8a44-c5a22bacc041', NULL, NULL, NULL, 'font_weight', 'bold', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('b7f93850-dec5-5026-b543-d258a8eed246', 'ff101658-38ea-58bd-a2b1-1f46f8de6063', NULL, NULL, NULL, 'padding', '64px', 'media', '1024px', NULL, NULL, NULL, NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('95780dff-f73c-579f-b5cc-272ffcea4ea5', 'ff101658-38ea-58bd-a2b1-1f46f8de6063', NULL, NULL, NULL, 'background', '#cc0000', 'container', '800px', NULL, NULL, 'main', NULL, NULL, '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
