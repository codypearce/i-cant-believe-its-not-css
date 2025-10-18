import {
  generateSchema,
  generateInserts,
  parsePostgresConnectionString,
  buildPostgresConnectionString,
} from '../src/db/dialects';
import type { DbTables } from '../src/db/schema';

describe('Database dialects', () => {
  describe('Schema generation', () => {
    it('generates SQLite schema', () => {
      const schema = generateSchema('sqlite');
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS migrations');
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS tokens');
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS selectors');
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS styles');
      expect(schema).toContain('def_json TEXT');
      expect(schema).not.toContain('JSONB');
      expect(schema).not.toContain('GIN');
    });

    it('generates Postgres schema with JSONB', () => {
      const schema = generateSchema('postgres');
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS migrations');
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS tokens');
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS selectors');
      expect(schema).toContain('def_json JSONB NOT NULL');
      expect(schema).toContain('props_json JSONB NOT NULL');
      expect(schema).toContain('frames_json JSONB NOT NULL');
      expect(schema).toContain('features_json JSONB NOT NULL');
    });

    it('generates Postgres indexes', () => {
      const schema = generateSchema('postgres');
      expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_styles_selector_id');
      expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_styles_layer_id');
      expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_styles_resp_kind');
      expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_styles_migration_id');
      expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_styles_scope_root_id');
      expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_styles_scope_limit_id');
    });

    it('generates Postgres GIN indexes on JSONB', () => {
      const schema = generateSchema('postgres');
      expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_selectors_def_json ON selectors USING GIN (def_json)');
      expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_font_faces_props ON font_faces USING GIN (props_json)');
      expect(schema).toContain('CREATE INDEX IF NOT EXISTS idx_keyframes_frames ON keyframes USING GIN (frames_json)');
    });

    it('generates Postgres views', () => {
      const schema = generateSchema('postgres');
      expect(schema).toContain('CREATE OR REPLACE VIEW styles_with_selectors');
      expect(schema).toContain('CREATE OR REPLACE VIEW styles_with_layers');
      expect(schema).toContain('CREATE OR REPLACE VIEW active_tokens');
      expect(schema).toContain('CREATE OR REPLACE VIEW active_selectors');
      expect(schema).toContain('CREATE OR REPLACE VIEW styles_full');
    });

    it('generates Postgres CHECK constraints', () => {
      const schema = generateSchema('postgres');
      expect(schema).toContain('CHECK (direction IN (\'up\', \'down\'))');
      expect(schema).toContain('CHECK (status IN (\'ok\', \'error\'))');
      expect(schema).toContain('CHECK (resp_kind IN (\'media\', \'container\', \'container-style\', \'supports\', \'\'))');
      expect(schema).toContain('CHECK (resp_axis IN (\'inline\', \'\'))');
      expect(schema).toContain('CHECK (import_type IN (\'sql\', \'css\'))');
    });

    it('generates Postgres proper types', () => {
      const schema = generateSchema('postgres');
      expect(schema).toContain('TIMESTAMP WITH TIME ZONE');
      expect(schema).toContain('INTEGER');
      expect(schema).toContain('BOOLEAN');
    });

    it('generates MySQL schema with JSON type', () => {
      const schema = generateSchema('mysql');
      expect(schema).toContain('CREATE TABLE IF NOT EXISTS migrations');
      expect(schema).toContain('def_json JSON NOT NULL');
      expect(schema).toContain('props_json JSON NOT NULL');
      expect(schema).toContain('frames_json JSON NOT NULL');
    });

    it('generates MySQL with utf8mb4 charset', () => {
      const schema = generateSchema('mysql');
      expect(schema).toContain('DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    });

    it('generates MySQL indexes', () => {
      const schema = generateSchema('mysql');
      expect(schema).toContain('INDEX idx_selector_id (selector_id)');
      expect(schema).toContain('INDEX idx_layer_id (layer_id)');
      expect(schema).toContain('INDEX idx_resp_kind (resp_kind)');
      expect(schema).toContain('INDEX idx_migration_id (migration_id)');
    });

    it('generates MySQL with InnoDB engine', () => {
      const schema = generateSchema('mysql');
      expect(schema).toContain('ENGINE=InnoDB');
    });

    it('throws error for unknown dialect', () => {
      expect(() => generateSchema('unknown' as any)).toThrow('Unknown dialect: unknown');
    });
  });

  describe('Insert generation', () => {
    const mockDb: DbTables = {
      migrations: [
        {
          id: '20240101_000000__init',
          filename: 'init.sql',
          direction: 'up',
          checksum: 'abc123',
          applied_at_iso: '2024-01-01T00:00:00Z',
          duration_ms: '100',
          status: 'ok',
        },
      ],
      tokens: [
        {
          id: 't1',
          name: 'brand/500',
          value: '#2266ee',
          source_file: 'init.sql',
          created_in_migration: '20240101_000000__init',
        },
      ],
      selectors: [
        {
          id: 's1',
          name: 'btn',
          def_json: '{"kind":"Class","value":"btn"}',
          source_file: 'init.sql',
          created_in_migration: '20240101_000000__init',
        },
      ],
      layers: [
        {
          id: 'l1',
          name: 'base',
          order_index: '0',
          source_file: 'init.sql',
        },
      ],
      styles: [
        {
          id: 'st1',
          selector_id: 's1',
          layer_id: 'l1',
          prop: 'color',
          value: '#fff',
          origin_file: 'init.sql',
          migration_id: '20240101_000000__init',
        },
      ],
      properties: [],
      font_faces: [],
      keyframes: [],
      raw_blocks: [],
      imports: [],
      pages: [],
      counter_styles: [],
      font_feature_values: [],
      font_palette_values: [],
      starting_styles: [],
    };

    it('generates SQLite inserts', () => {
      const inserts = generateInserts(mockDb, 'sqlite');
      expect(inserts).toContain('INSERT INTO migrations');
      expect(inserts).toContain('INSERT INTO tokens');
      expect(inserts).toContain('INSERT INTO selectors');
      expect(inserts).toContain('INSERT INTO layers');
      expect(inserts).toContain('INSERT INTO styles');
      expect(inserts).toContain("'20240101_000000__init'");
      expect(inserts).toContain("'brand/500'");
      expect(inserts).toContain("'#2266ee'");
    });

    it('generates Postgres inserts with escaped backslashes', () => {
      const inserts = generateInserts(mockDb, 'postgres');
      expect(inserts).toContain('INSERT INTO migrations');
      expect(inserts).toContain('INSERT INTO tokens');
    });

    it('escapes single quotes in values', () => {
      const dbWithQuotes: DbTables = {
        ...mockDb,
        tokens: [
          {
            id: 't1',
            name: "test'name",
            value: "value'with'quotes",
          },
        ],
      };
      const inserts = generateInserts(dbWithQuotes, 'sqlite');
      expect(inserts).toContain("'test''name'");
      expect(inserts).toContain("'value''with''quotes'");
    });

    it('handles empty arrays gracefully', () => {
      const emptyDb: DbTables = {
        migrations: [],
        tokens: [],
        selectors: [],
        layers: [],
        styles: [],
        properties: [],
        font_faces: [],
        keyframes: [],
        raw_blocks: [],
        imports: [],
        pages: [],
        counter_styles: [],
        font_feature_values: [],
        font_palette_values: [],
        starting_styles: [],
      };
      const inserts = generateInserts(emptyDb, 'sqlite');
      expect(inserts).toBe('');
    });
  });

  describe('Postgres connection string parsing', () => {
    it('parses basic connection string', () => {
      const result = parsePostgresConnectionString('postgresql://localhost/mydb');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(5432);
      expect(result.database).toBe('mydb');
      expect(result.user).toBeUndefined();
      expect(result.password).toBeUndefined();
    });

    it('parses connection string with user and password', () => {
      const result = parsePostgresConnectionString('postgresql://user:pass@localhost/mydb');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(5432);
      expect(result.database).toBe('mydb');
      expect(result.user).toBe('user');
      expect(result.password).toBe('pass');
    });

    it('parses connection string with custom port', () => {
      const result = parsePostgresConnectionString('postgresql://localhost:5433/mydb');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(5433);
      expect(result.database).toBe('mydb');
    });

    it('parses full connection string', () => {
      const result = parsePostgresConnectionString('postgresql://user:pass@host.example.com:5433/mydb');
      expect(result.host).toBe('host.example.com');
      expect(result.port).toBe(5433);
      expect(result.database).toBe('mydb');
      expect(result.user).toBe('user');
      expect(result.password).toBe('pass');
    });

    it('handles postgres:// scheme', () => {
      const result = parsePostgresConnectionString('postgres://localhost/mydb');
      expect(result.host).toBe('localhost');
      expect(result.database).toBe('mydb');
    });

    it('throws error on invalid connection string', () => {
      expect(() => parsePostgresConnectionString('invalid')).toThrow('Invalid Postgres connection string');
      expect(() => parsePostgresConnectionString('http://localhost/db')).toThrow('Invalid Postgres connection string');
    });
  });

  describe('Postgres connection string building', () => {
    it('builds basic connection string', () => {
      const result = buildPostgresConnectionString({
        database: 'mydb',
      });
      expect(result).toBe('postgresql://localhost:5432/mydb');
    });

    it('builds connection string with auth', () => {
      const result = buildPostgresConnectionString({
        user: 'user',
        password: 'pass',
        database: 'mydb',
      });
      expect(result).toBe('postgresql://user:pass@localhost:5432/mydb');
    });

    it('builds connection string with custom host and port', () => {
      const result = buildPostgresConnectionString({
        host: 'db.example.com',
        port: 5433,
        database: 'mydb',
      });
      expect(result).toBe('postgresql://db.example.com:5433/mydb');
    });

    it('builds full connection string', () => {
      const result = buildPostgresConnectionString({
        user: 'user',
        password: 'pass',
        host: 'db.example.com',
        port: 5433,
        database: 'mydb',
      });
      expect(result).toBe('postgresql://user:pass@db.example.com:5433/mydb');
    });

    it('uses defaults for missing options', () => {
      const result = buildPostgresConnectionString({
        database: 'test',
      });
      expect(result).toBe('postgresql://localhost:5432/test');
    });
  });

  describe('Round-trip parsing and building', () => {
    it('parses and rebuilds connection string', () => {
      const original = 'postgresql://user:pass@db.example.com:5433/mydb';
      const parsed = parsePostgresConnectionString(original);
      const rebuilt = buildPostgresConnectionString(parsed);
      expect(rebuilt).toBe(original);
    });

    it('handles connection string without auth', () => {
      const original = 'postgresql://localhost:5432/mydb';
      const parsed = parsePostgresConnectionString(original);
      const rebuilt = buildPostgresConnectionString(parsed);
      expect(rebuilt).toBe(original);
    });
  });
});
