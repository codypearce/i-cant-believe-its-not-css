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


INSERT INTO migrations (id, filename, direction, checksum, applied_at_iso, duration_ms, status) VALUES ('001_init', '001_init.sql', 'up', '1fd73f2afa9885066ce1782f2277ca3dd88fa494', '2025-10-18T18:30:58.623Z', '8', 'ok');
INSERT INTO migrations (id, filename, direction, checksum, applied_at_iso, duration_ms, status) VALUES ('001_init', '001_init.sql', 'down', '92e7a1f6374b3be48e3b48b0d29c777ddaedba40', '2025-10-18T18:36:53.367Z', '4', 'ok');
INSERT INTO migrations (id, filename, direction, checksum, applied_at_iso, duration_ms, status) VALUES ('001_init', '001_init.sql', 'up', 'de3be4e561190bc1d582218567eb336ede4b48ec', '2025-10-18T18:37:12.322Z', '7', 'ok');
INSERT INTO tokens (id, name, value, source_file, created_in_migration, deleted_at_iso) VALUES ('brand/500', 'brand/500', '#2266ee', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init', '');
INSERT INTO tokens (id, name, value, source_file, created_in_migration, deleted_at_iso) VALUES ('space/4', 'space/4', '16px', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init', '');
INSERT INTO selectors (id, name, def_json, source_file, created_at_iso, updated_at_iso, created_in_migration, deleted_at_iso) VALUES ('card', 'card', '{"kind":"Class","value":"card"}', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '2025-10-18T18:30:58.619Z', '2025-10-18T18:37:12.319Z', '001_init', '');
INSERT INTO selectors (id, name, def_json, source_file, created_at_iso, updated_at_iso, created_in_migration, deleted_at_iso) VALUES ('btn', 'btn', '{"kind":"And","selectors":[{"kind":"Element","value":"button"},{"kind":"Class","value":"primary"}]}', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '2025-10-18T18:30:58.621Z', '2025-10-18T18:37:12.320Z', '001_init', '');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, origin_file, migration_id) VALUES ('001_init:1', 'card', '', '', '', 'background', '#fff', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, origin_file, migration_id) VALUES ('001_init:2', 'card', '', '', '', 'padding', 'token(''space/4'')', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, origin_file, migration_id) VALUES ('001_init:3', 'btn', '', '', '', 'background', 'token(''brand/500'')', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
INSERT INTO styles (id, selector_id, layer_id, scope_root_id, scope_limit_id, prop, value, resp_kind, resp_min, resp_max, resp_axis, container_name, condition, origin_file, migration_id) VALUES ('001_init:4', 'btn', '', '', '', 'color', '#fff', '', '', '', '', '', '', '/Users/cody/projects/notcss/icbincss/migrations/up/001_init.sql', '001_init');
