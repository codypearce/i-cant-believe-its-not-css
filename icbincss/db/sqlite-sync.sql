-- Sync CSV to SQLite (recreate schema)
BEGIN;
DROP VIEW IF EXISTS applied_migrations;
DROP VIEW IF EXISTS migrations_latest;
DROP TABLE IF EXISTS starting_styles;
DROP TABLE IF EXISTS font_palette_values;
DROP TABLE IF EXISTS font_feature_values;
DROP TABLE IF EXISTS counter_styles;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS imports;
DROP TABLE IF EXISTS raw_blocks;
DROP TABLE IF EXISTS keyframes;
DROP TABLE IF EXISTS font_faces;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS styles;
DROP TABLE IF EXISTS layers;
DROP TABLE IF EXISTS selectors;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS migrations;

-- ICBINCSS SQLite Schema

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


INSERT INTO migrations (id, filename, direction, checksum, applied_at_iso, duration_ms, status) VALUES ('001_init', '001_init.sql', 'up', 'de3be4e561190bc1d582218567eb336ede4b48ec', '2025-10-18T19:06:13.130Z', '6', 'ok');
INSERT INTO migrations (id, filename, direction, checksum, applied_at_iso, duration_ms, status) VALUES ('20251018192449__supports_mix', '20251018192449__supports_mix.sql', 'up', '91b00fced002335892e7e13f35dfb5da4f856abf', '2025-10-18T19:25:10.701Z', '6', 'ok');
INSERT INTO migrations (id, filename, direction, checksum, applied_at_iso, duration_ms, status) VALUES ('20251018194435__test_comprehensive', '20251018194435__test_comprehensive.sql', 'up', '0657784e27106b34b680ce8692417334c13d56d1', '2025-10-18T19:45:17.507Z', '8', 'ok');
INSERT INTO tokens (id, name, value, source_file, created_in_migration, deleted_at_iso) VALUES ('1e6eecff-70dc-5320-b0a9-09821b659910', 'brand/500', '#2266ee', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init', '');
INSERT INTO tokens (id, name, value, source_file, created_in_migration, deleted_at_iso) VALUES ('24ccc119-9836-5c45-a659-b8076a8e8b43', 'space/4', '16px', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init', '');
INSERT INTO tokens (id, name, value, source_file, created_in_migration, deleted_at_iso) VALUES ('cd82bc1d-1e2d-56f2-b36e-2ed8a2ecb215', 'accent/red', '#ff4444', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive', '');
INSERT INTO tokens (id, name, value, source_file, created_in_migration, deleted_at_iso) VALUES ('6a51374c-4d86-5767-9840-f25c54192da7', 'spacing/lg', '32px', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive', '');
INSERT INTO selectors (id, name, def_json, source_file, created_at_iso, updated_at_iso, created_in_migration, deleted_at_iso) VALUES ('a91d6bae-525e-55ff-a18f-9e839a390c6f', 'card', '{"kind":"Class","value":"card"}', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '2025-10-18T19:06:13.128Z', '2025-10-18T19:06:13.128Z', '001_init', '');
INSERT INTO selectors (id, name, def_json, source_file, created_at_iso, updated_at_iso, created_in_migration, deleted_at_iso) VALUES ('c200aa63-ca83-5251-97c9-55b9ef192091', 'btn', '{"kind":"And","selectors":[{"kind":"Element","value":"button"},{"kind":"Class","value":"primary"}]}', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '2025-10-18T19:06:13.128Z', '2025-10-18T19:06:13.128Z', '001_init', '');
INSERT INTO selectors (id, name, def_json, source_file, created_at_iso, updated_at_iso, created_in_migration, deleted_at_iso) VALUES ('ff101658-38ea-58bd-a2b1-1f46f8de6063', 'hero', '{"kind":"Class","value":"hero"}', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '2025-10-18T19:45:17.503Z', '2025-10-18T19:45:17.504Z', '20251018194435__test_comprehensive', '');
INSERT INTO selectors (id, name, def_json, source_file, created_at_iso, updated_at_iso, created_in_migration, deleted_at_iso) VALUES ('1a003e62-3c20-5909-8a44-c5a22bacc041', 'hero_title', '{"kind":"Child","parent":{"kind":"Ref","name":"hero"},"child":{"kind":"Element","value":"h1"}}', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '2025-10-18T19:45:17.504Z', '2025-10-18T19:45:17.504Z', '20251018194435__test_comprehensive', '');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('0c5cc550-0c74-551c-ba99-c4abaa7e8a1c', 'a91d6bae-525e-55ff-a18f-9e839a390c6f', '', '', '', 'background', '#fff', '', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('2044a995-ecf2-597c-887d-fe1380ca85ac', 'a91d6bae-525e-55ff-a18f-9e839a390c6f', '', '', '', 'padding', 'token(''space/4'')', '', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('f422733c-4b87-569a-93c3-e3d9838d181c', 'c200aa63-ca83-5251-97c9-55b9ef192091', '', '', '', 'background', 'token(''brand/500'')', '', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('a3e138ef-7ceb-5ad7-afcd-7a506b01683d', 'c200aa63-ca83-5251-97c9-55b9ef192091', '', '', '', 'color', '#fff', '', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('7f82d9d1-d0dc-52b5-9bdb-37c59132ec4f', 'a91d6bae-525e-55ff-a18f-9e839a390c6f', '', '', '', 'display', 'grid', 'media', '768px', '', '', '', '', '(display: grid)', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018192449__supports_mix.sql', '20251018192449__supports_mix');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('f568fae6-6d2a-5ba5-a8c4-1999a5b47413', 'ff101658-38ea-58bd-a2b1-1f46f8de6063', '', '', '', 'background', 'token(''accent/red'')', '', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('374f6b34-47ec-592e-8cfe-38013477d316', 'ff101658-38ea-58bd-a2b1-1f46f8de6063', '', '', '', 'padding', 'token(''spacing/lg'')', '', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('ea674819-b30b-5531-89de-6f178c93528b', 'ff101658-38ea-58bd-a2b1-1f46f8de6063', '', '', '', 'color', 'white', '', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('84f17916-aa44-5d7b-a5cf-2428fe3622f5', '1a003e62-3c20-5909-8a44-c5a22bacc041', '', '', '', 'font_size', '48px', '', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('bb3ae075-db5c-5d6d-96c0-72251ed80f8a', '1a003e62-3c20-5909-8a44-c5a22bacc041', '', '', '', 'font_weight', 'bold', '', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('b7f93850-dec5-5026-b543-d258a8eed246', 'ff101658-38ea-58bd-a2b1-1f46f8de6063', '', '', '', 'padding', '64px', 'media', '1024px', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, supports_condition, origin_file, migration_id) VALUES ('95780dff-f73c-579f-b5cc-272ffcea4ea5', 'ff101658-38ea-58bd-a2b1-1f46f8de6063', '', '', '', 'background', '#cc0000', 'container', '800px', '', '', 'main', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/20251018194435__test_comprehensive.sql', '20251018194435__test_comprehensive');
COMMIT;
