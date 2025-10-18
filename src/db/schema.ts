export type MigrationRow = {
  id: string; // e.g., 20240915_123456__name
  filename: string;
  direction: 'up' | 'down';
  checksum: string;
  applied_at_iso: string;
  duration_ms?: string;
  status?: 'ok' | 'error';
};

export type TokenRow = {
  id: string; // stable id
  name: string; // unique
  value: string;
  source_file?: string;
  created_in_migration?: string; // migration id
  deleted_at_iso?: string | '';
};

export type SelectorRow = {
  id: string;
  name: string; // unique
  def_json: string; // JSON string describing selector algebra
  source_file?: string;
  created_at_iso?: string;
  updated_at_iso?: string;
  created_in_migration?: string;
  deleted_at_iso?: string | '';
};

export type LayerRow = {
  id: string;
  name: string; // unique
  order_index: string; // number as string for CSV
  source_file?: string;
};

export type StyleRow = {
  id: string;
  selector_id: string; // fk → selectors.id
  layer_id?: string | '';
  scope_root_id?: string | ''; // fk → selectors.id (for @scope root)
  scope_limit_id?: string | ''; // fk → selectors.id (for @scope limit)
  prop: string;
  value: string;
  resp_kind?: 'media' | 'container' | 'container-style' | 'supports' | '';
  resp_min?: string | '';
  resp_max?: string | '';
  resp_axis?: 'inline' | '';
  container_name?: string | '';
  condition?: string | '';
  supports_condition?: string | '';
  origin_file?: string | '';
  migration_id?: string | '';
};

export type FontFaceRow = {
  id: string;
  family: string;
  props_json: string; // JSON array of { name, value }
  origin_file?: string | '';
  migration_id?: string | '';
};

export type KeyframesRow = {
  id: string;
  name: string;
  frames_json: string; // JSON array of { offset, props: [{ name, value }] }
  origin_file?: string | '';
  migration_id?: string | '';
};

export type PropertyRow = {
  id: string;
  name: string; // e.g., '--my-color'
  syntax?: string | ''; // e.g., '<color>', '<length>', '*'
  inherits?: string | ''; // 'true' or 'false' as string for CSV
  initial_value?: string | ''; // e.g., '#000', '16px'
  origin_file?: string | '';
  migration_id?: string | '';
};

export type RawBlockRow = {
  id: string;
  css: string;
  origin_file?: string | '';
  migration_id?: string | '';
};

export type ImportRow = {
  id: string;
  import_type: 'sql' | 'css';
  path: string;
  media?: string | '';
  origin_file?: string | '';
  migration_id?: string | '';
};

export type PageRow = {
  id: string;
  pseudo?: string | '';
  props_json: string; // JSON array of { name, value }
  origin_file?: string | '';
  migration_id?: string | '';
};

export type CounterStyleRow = {
  id: string;
  name: string;
  props_json: string; // JSON array of { name, value }
  origin_file?: string | '';
  migration_id?: string | '';
};

export type FontFeatureValuesRow = {
  id: string;
  family: string;
  features_json: string; // JSON array of { name, value }
  origin_file?: string | '';
  migration_id?: string | '';
};

export type FontPaletteValuesRow = {
  id: string;
  name: string;
  props_json: string; // JSON array of { name, value }
  origin_file?: string | '';
  migration_id?: string | '';
};

export type StartingStyleRow = {
  id: string;
  selector_id: string; // fk → selectors.id
  props_json: string; // JSON array of { name, value }
  origin_file?: string | '';
  migration_id?: string | '';
};

export type DbTables = {
  migrations: MigrationRow[];
  tokens: TokenRow[];
  selectors: SelectorRow[];
  layers: LayerRow[];
  styles: StyleRow[];
  properties: PropertyRow[];
  font_faces: FontFaceRow[];
  keyframes: KeyframesRow[];
  raw_blocks: RawBlockRow[];
  imports: ImportRow[];
  pages: PageRow[];
  counter_styles: CounterStyleRow[];
  font_feature_values: FontFeatureValuesRow[];
  font_palette_values: FontPaletteValuesRow[];
  starting_styles: StartingStyleRow[];
};

export const Headers = {
  migrations: ['id','filename','direction','checksum','applied_at_iso','duration_ms','status'],
  tokens: ['id','name','value','source_file','created_in_migration','deleted_at_iso'],
  selectors: ['id','name','def_json','source_file','created_at_iso','updated_at_iso','created_in_migration','deleted_at_iso'],
  layers: ['id','name','order_index','source_file'],
  // Note: styles headers extended to include supports_condition for mixed @supports with media/container
  // Backward compatibility: older CSVs without this column will read as empty string
  styles: ['id','selector_id','layer_id','scope_root_id','scope_limit_id','prop','value','resp_kind','resp_min','resp_max','resp_axis','container_name','condition','supports_condition','origin_file','migration_id'],
  properties: ['id','name','syntax','inherits','initial_value','origin_file','migration_id'],
  font_faces: ['id','family','props_json','origin_file','migration_id'],
  keyframes: ['id','name','frames_json','origin_file','migration_id'],
  raw_blocks: ['id','css','origin_file','migration_id'],
  imports: ['id','import_type','path','media','origin_file','migration_id'],
  pages: ['id','pseudo','props_json','origin_file','migration_id'],
  counter_styles: ['id','name','props_json','origin_file','migration_id'],
  font_feature_values: ['id','family','features_json','origin_file','migration_id'],
  font_palette_values: ['id','name','props_json','origin_file','migration_id'],
  starting_styles: ['id','selector_id','props_json','origin_file','migration_id'],
} as const;
