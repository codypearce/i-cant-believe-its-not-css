// AST node types for ICBINCSS SQL DSL

export type TokenNode = {
  type: 'Token',
  name: string,
  value: string,
};

export type SelectorNode = {
  type: 'Selector',
  name: string,
  definition: SelectorDefinition,
};

export type SelectorDefinition =
  | { kind: 'Element', value: string }
  | { kind: 'Class', value: string }
  | { kind: 'Pseudo', value: string }
  | { kind: 'PseudoElement', value: string }
  | { kind: 'Id', value: string }
  | { kind: 'Attr', name: string, value?: string, operator?: '^='|'$='|'*='|'~='|'|='|'=' , flag?: 'i'|'s' }
  | { kind: 'Ref', name: string }
  | { kind: 'And', selectors: SelectorDefinition[] }
  | { kind: 'Or', selectors: SelectorDefinition[] }
  | { kind: 'Child', parent: SelectorDefinition, child: SelectorDefinition }
  | { kind: 'Descendant', ancestor: SelectorDefinition, descendant: SelectorDefinition }
  | { kind: 'Join', joinType: 'AND'|'DESC'|'CHILD'|'ADJ'|'SIB', left: SelectorDefinition, right: SelectorDefinition };

export type StyleNode = {
  type: 'Style',
  selector: string,
  properties: StyleProperty[],
  layer?: string,
  responsive?: ResponsiveQuery,
};

export type StyleProperty = {
  name: string,
  value: string,
};

export type ResponsiveQuery = {
  type: 'WidthBetween',
  min: string,
  max: string,
} | {
  type: 'Container',
  container: string,
  min: string,
};

export type AlterStyleNode = {
  type: 'AlterStyle',
  selector: string,
  action: 'ADD' | 'SET',
  properties: StyleProperty[],
  responsive?: ResponsiveQuery,
};

export type DeleteNode = {
  type: 'Delete',
  selector: string,
  property?: string,
};

export type DropNode = {
  type: 'Drop',
  selector: string,
};

export type LayerNode = {
  type: 'Layer',
  layers: string[],
};

export type SetLayerNode = {
  type: 'SetLayer',
  layer: string,
};

export type ButterNode = {
  type: 'Butter',
  mode: string,
};

export type RawNode = {
  type: 'Raw',
  css: string,
};

export type FontFaceNode = {
  type: 'FontFace',
  family: string,
  properties: StyleProperty[],
};

export type KeyframesFrame = {
  offset: string,
  properties: StyleProperty[],
};

export type KeyframesNode = {
  type: 'Keyframes',
  name: string,
  frames: KeyframesFrame[],
};

export type PropertyNode = {
  type: 'Property',
  name: string,
  properties: StyleProperty[],
};

export type DropPropertyNode = {
  type: 'DropProperty',
  name: string,
};

export type ImportNode = {
  type: 'Import',
  importType: 'sql' | 'css',
  path: string,
  media?: string,
};

export type PageNode = {
  type: 'Page',
  pseudo?: string,
  properties: StyleProperty[],
};

export type DropPageNode = {
  type: 'DropPage',
  pseudo?: string,
};

export type CounterStyleNode = {
  type: 'CounterStyle',
  name: string,
  properties: StyleProperty[],
};

export type DropCounterStyleNode = {
  type: 'DropCounterStyle',
  name: string,
};

export type FontFeatureValuesNode = {
  type: 'FontFeatureValues',
  family: string,
  properties: StyleProperty[],
};

export type DropFontFeatureValuesNode = {
  type: 'DropFontFeatureValues',
  family: string,
};

export type FontPaletteValuesNode = {
  type: 'FontPaletteValues',
  name: string,
  properties: StyleProperty[],
};

export type DropFontPaletteValuesNode = {
  type: 'DropFontPaletteValues',
  name: string,
};

export type StartingStyleNode = {
  type: 'StartingStyle',
  selector: string,
  properties: StyleProperty[],
};

export type DropStartingStyleNode = {
  type: 'DropStartingStyle',
  selector: string,
};

export type SelectStylePropsNode = {
  type: 'SelectStyleProps',
  selector: string,
  responsive?: any,
};

export type DescribeSelectorNode = {
  type: 'DescribeSelector',
  name: string,
};

export type BeginNode = { type: 'Begin' };
export type CommitNode = { type: 'Commit' };
export type RollbackNode = { type: 'Rollback' };

export type MigrationNode =
  | TokenNode
  | SelectorNode
  | StyleNode
  | AlterStyleNode
  | DeleteNode
  | DropNode
  | LayerNode
  | SetLayerNode
  | ButterNode
  | RawNode
  | FontFaceNode
  | KeyframesNode
  | PropertyNode
  | DropPropertyNode
  | ImportNode
  | PageNode
  | DropPageNode
  | CounterStyleNode
  | DropCounterStyleNode
  | FontFeatureValuesNode
  | DropFontFeatureValuesNode
  | FontPaletteValuesNode
  | DropFontPaletteValuesNode
  | StartingStyleNode
  | DropStartingStyleNode
  | { type: 'DropToken', name: string }
  | { type: 'DropKeyframes', name: string }
  | { type: 'DropFontFace', family: string }
  | { type: 'DeleteToken', name: string }
  | SelectStylePropsNode
  | DescribeSelectorNode
  | BeginNode
  | CommitNode
  | RollbackNode;

export type MigrationFileAST = MigrationNode[];
