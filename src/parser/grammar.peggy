// Entry point for SQL DSL parser (Peggy-based, emits typed AST)

{{
  import { validatePseudoSelector } from './pseudo-validator.js';
}}

Start
  = _ statements:StatementList _ { return statements; }

StatementList
  = head:Statement tail:(_ Statement)* { return [head, ...tail.map(t => t[1])]; }

Statement
  = TokenStatement
  / SelectorStatement
  / StyleStatement
  / AlterStyleStatement
  / DMLStyleInsert
  / DMLStyleUpdate
  / DMLTokenInsert
  / DMLTokenUpdate
  / DeleteStatement
  / DropStatement
  / DropTokenStatement
  / DropKeyframesStatement
  / DropFontFaceStatement
  / DropPropertyStatement
  / DropPageStatement
  / DropCounterStyleStatement
  / DropFontFeatureValuesStatement
  / DropFontPaletteValuesStatement
  / DropStartingStyleStatement
  / DeleteTokenStatement
  / SelectStylePropsStatement
  / DescribeSelectorStatement
  / BeginStatement
  / CommitStatement
  / RollbackStatement
  / LayerStatement
  / SetLayerStatement
  / ButterStatement
  / PropertyStatement
  / FontFaceStatement
  / KeyframesStatement
  / ImportStatement
  / PageStatement
  / CounterStyleStatement
  / FontFeatureValuesStatement
  / FontPaletteValuesStatement
  / StartingStyleStatement
  / RawStatement

// (Removed MIGRATION ... UP/DOWN ... block support; phases are handled by file layout)

// CREATE TOKEN 'name' VALUE value
TokenStatement
  = 'CREATE'i _ 'TOKEN'i _ name:QuotedString _ 'VALUE'i _ value:Value _ ';'? {
      return { type: 'Token', name, value };
    }

// CREATE SELECTOR name AS <SelectorDef>
SelectorStatement
  = 'CREATE'i _ 'SELECTOR'i _ name:Identifier _ 'AS'i _ def:SelectorDef _ ';'? {
      return { type: 'Selector', name, definition: def };
    }

// SELECTOR DEFNS
SelectorDef
  = AndSelector
  / OrSelector
  / ChildSelector
  / DescSelector
  / JoinSelector
  / ElementSelector
  / ClassSelector
  / PseudoSelector
  / PseudoElementSelector
  / IdFunc
  / AttrFunc
  / RefSelector

AndSelector
  = 'AND'i _ '(' _ selectors:SelectorDefList _ ')' { return { kind: 'And', selectors }; }

OrSelector
  = 'OR'i _ '(' _ selectors:SelectorDefList _ ')' { return { kind: 'Or', selectors }; }

ChildSelector
  = 'CHILD'i _ '(' _ parent:SelectorDef _ ',' _ child:SelectorDef _ ')' { return { kind: 'Child', parent, child }; }

DescSelector
  = 'DESC'i _ '(' _ ancestor:SelectorDef _ ',' _ descendant:SelectorDef _ ')' { return { kind: 'Descendant', ancestor, descendant }; }

JoinSelector
  = 'JOIN'i _ jt:JoinType _ left:SelectorDef _ 'ON'i _ right:SelectorDef { return { kind: 'Join', joinType: jt, left, right }; }

JoinType = 'AND'i { return 'AND'; }
         / 'DESC'i { return 'DESC'; }
         / 'CHILD'i { return 'CHILD'; }
         / 'ADJ'i { return 'ADJ'; }
         / 'SIB'i { return 'SIB'; }

SelectorDefList
  = first:SelectorDef rest:(_ ',' _ SelectorDef)* { return [first, ...rest.map(r => r[3])]; }

ElementSelector = 'E'i _ '(' _ v:QuotedString _ ')' { return { kind: 'Element', value: v }; }
ClassSelector   = 'C'i _ '(' _ v:QuotedString _ ')' { return { kind: 'Class', value: v }; }
PseudoSelector  = 'P'i _ '(' _ v:QuotedString _ ')' {
    const validation = validatePseudoSelector(v);
    if (!validation.valid) {
      error(`Invalid pseudo-selector P('${v}'): ${validation.error}`);
    }
    return { kind: 'Pseudo', value: v };
  }
PseudoElementSelector = 'PE'i _ '(' _ v:QuotedString _ ')' { return { kind: 'PseudoElement', value: v }; }

// ID and attribute selectors
IdFunc = 'ID'i _ '(' _ v:QuotedString _ ')' { return { kind: 'Id', value: v }; }
AttrFunc
  = 'ATTR'i _ '(' _ n:QuotedString _ ')' { return { kind: 'Attr', name: n }; }
  / 'ATTR'i _ '(' _ n:QuotedString _ ',' _ v:QuotedString _ ')' { return { kind: 'Attr', name: n, value: v }; }
  / 'ATTR'i _ '(' _ n:QuotedString _ ',' _ v:QuotedString _ ',' _ op:QuotedString _ ')' {
      const o = op;
      if (!['^=','$=','*=','~=','|=','='].includes(o)) throw new Error('Invalid ATTR operator: ' + o);
      return { kind: 'Attr', name: n, value: v, operator: o };
    }
  / 'ATTR'i _ '(' _ n:QuotedString _ ',' _ v:QuotedString _ ',' _ op:QuotedString _ ',' _ fl:QuotedString _ ')' {
      const o = op; const f = fl.toLowerCase();
      if (!['^=','$=','*=','~=','|=','='].includes(o)) throw new Error('Invalid ATTR operator: ' + o);
      if (!['i','s'].includes(f)) throw new Error('Invalid ATTR flag: ' + fl);
      return { kind: 'Attr', name: n, value: v, operator: o, flag: f };
    }

// Reference to a previously defined selector by name
RefSelector = id:Identifier { return { kind: 'Ref', name: id }; }

// CREATE STYLE SELECTOR name [SCOPED TO root [LIMIT limit]] ( prop = value, ... ) [WHERE ...]
StyleStatement
  = 'CREATE'i _ 'STYLE'i _ 'SELECTOR'i _ selector:Identifier _ scope:ScopeClause? _ '(' _ props:StyleProps _ ')' _ where:WhereClause? _ ';'? {
      return { type: 'Style', selector, properties: props, responsive: where, scopeRoot: scope?.root, scopeLimit: scope?.limit };
    }

ScopeClause
  = 'SCOPED'i _ 'TO'i _ root:Identifier _ limit:('LIMIT'i _ Identifier)? {
      return { root, limit: limit ? limit[2] : undefined };
    }

StyleProps = head:StyleProp tail:(_ ',' _ StyleProp)* { return [head, ...tail.map(t => t[3])]; }
StyleProp  = name:Identifier _ '=' _ value:Value { return { name, value }; }

// ALTER STYLE SELECTOR name ADD/SET prop = value [, ...]
AlterStyleStatement
  = 'ALTER'i _ 'STYLE'i _ 'SELECTOR'i _ selector:Identifier _ where:WhereClause? _ action:AlterAction _ props:AlterProps _ ';'? {
      return { type: 'AlterStyle', selector, action, properties: props, responsive: where };
    }
AlterAction = 'ADD'i { return 'ADD'; } / 'SET'i { return 'SET'; }
AlterProps = StyleProps

// DELETE FROM style_props WHERE selector = name AND prop = 'propName'
DeleteStatement
  = 'DELETE'i _ 'FROM'i _ 'style_props'i _ 'WHERE'i _ 'selector'i _ '=' _ selector:Identifier _ 'AND'i _ 'prop'i _ '=' _ prop:QuotedString _ ';'? {
      return { type: 'Delete', selector, property: prop };
    }

// DROP STYLE SELECTOR name
DropStatement
  = 'DROP'i _ 'STYLE'i _ 'SELECTOR'i _ selector:Identifier _ ';'? { return { type: 'Drop', selector }; }

// DROP TOKEN 'name'
DropTokenStatement
  = 'DROP'i _ 'TOKEN'i _ name:QuotedString _ ';'? { return { type: 'DropToken', name } }

// DROP KEYFRAMES name
DropKeyframesStatement
  = 'DROP'i _ 'KEYFRAMES'i _ name:Identifier _ ';'? { return { type: 'DropKeyframes', name } }

// DROP FONT_FACE family '...'
DropFontFaceStatement
  = 'DROP'i _ 'FONT_FACE'i _ 'family'i _ fam:QuotedString _ ';'? { return { type: 'DropFontFace', family: fam } }

// DROP PROPERTY '--name'
DropPropertyStatement
  = 'DROP'i _ 'PROPERTY'i _ name:QuotedString _ ';'? { return { type: 'DropProperty', name } }

// DELETE FROM tokens WHERE name = '...'
DeleteTokenStatement
  = 'DELETE'i _ 'FROM'i _ 'tokens'i _ 'WHERE'i _ 'name'i _ '=' _ nm:QuotedString _ ';'? { return { type: 'DeleteToken', name: nm }; }

// Introspection SQL (parse-only, used by CLI)
SelectStylePropsStatement
  = 'SELECT'i _ 'style_props'i _ 'WHERE'i _ 'selector'i _ '=' _ sel:Identifier _ opt:('AND'i _ wb:WhereBody)? _ ';'? {
      const whereBody = opt ? opt[2] : null;
      const responsive = whereBody ? (function(){
        const src = whereBody.trim();
        let m;
        if ((m = src.match(/^width\s+between\s+([^\s]+)\s+and\s+([^\s]+)$/i))) return { type: 'WidthBetween', min: m[1], max: m[2] };
        if ((m = src.match(/^width\s*(>=|>)\s*([^\s]+)$/i))) return { type: 'WidthMin', min: m[2] };
        if ((m = src.match(/^width\s*(<=|<)\s*([^\s]+)$/i))) return { type: 'WidthMax', max: m[2] };
        if ((m = src.match(/^prefers[_ ]?color[_ ]?scheme\s*=\s*(dark|light)$/i))) return { type: 'MediaFeature', feature: 'prefers-color-scheme', value: m[1].toLowerCase() };
        if ((m = src.match(/^orientation\s*=\s*(portrait|landscape)$/i))) return { type: 'MediaFeature', feature: 'orientation', value: m[1].toLowerCase() };
        if ((m = src.match(/^prefers[_ ]?reduced[_ ]?motion\s*=\s*(reduce|no-preference)$/i))) return { type: 'MediaFeature', feature: 'prefers-reduced-motion', value: m[1].toLowerCase() };
        if ((m = src.match(/^color[_ ]?gamut\s*=\s*(srgb|p3|rec2020)$/i))) return { type: 'MediaFeature', feature: 'color-gamut', value: m[1].toLowerCase() };
        if ((m = src.match(/^forced[_ ]?colors\s*=\s*(active|none)$/i))) return { type: 'MediaFeature', feature: 'forced-colors', value: m[1].toLowerCase() };
        if ((m = src.match(/^pointer\s*=\s*(none|coarse|fine)$/i))) return { type: 'MediaFeature', feature: 'pointer', value: m[1].toLowerCase() };
        if ((m = src.match(/^hover\s*=\s*(hover|none)$/i))) return { type: 'MediaFeature', feature: 'hover', value: m[1].toLowerCase() };
        if ((m = src.match(/^resolution\s*=\s*([0-9]+(?:\.[0-9]+)?dppx|[0-9]+dpi|[0-9]+dpcm)$/i))) return { type: 'MediaFeature', feature: 'resolution', value: m[1].toLowerCase() };
        if ((m = src.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*>\s*([^\s]+)$/i))) return { type: 'Container', container: m[1], min: m[2] };
        if ((m = src.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*<\s*([^\s]+)$/i))) return { type: 'Container', container: m[1], max: m[2] };
        if ((m = src.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+style\s*\((.+)\)$/i))) return { type: 'ContainerStyle', container: m[1], condition: '(' + m[2].trim() + ')' };
        return null;
      })() : null;
      return { type: 'SelectStyleProps', selector: sel, responsive };
    }

DescribeSelectorStatement
  = 'DESCRIBE'i _ 'SELECTOR'i _ nm:Identifier _ ';'? { return { type: 'DescribeSelector', name: nm }; }

// Transactions (ergonomic grouping; semantic no-ops in compiler)
BeginStatement = 'BEGIN'i _ ';'? { return { type: 'Begin' }; }
CommitStatement = 'COMMIT'i _ ';'? { return { type: 'Commit' }; }
RollbackStatement = 'ROLLBACK'i _ ';'? { return { type: 'Rollback' }; }

// CREATE LAYERS (a, b, c)
LayerStatement
  = 'CREATE'i _ 'LAYERS'i _ '(' _ layers:LayerList _ ')' _ ';'? {
      return { type: 'Layer', layers };
    }

LayerList
  = h:Identifier t:(_ ',' _ Identifier)* { return [h, ...t.map(x => x[3])]; }

// SET LAYER = name
SetLayerStatement
  = 'SET'i _ 'LAYER'i _ '=' _ layer:Identifier _ ';'? {
      return { type: 'SetLayer', layer };
    }

// SET BUTTER = 'mode'
ButterStatement
  = 'SET'i _ 'BUTTER'i _ '=' _ mode:QuotedString _ ';'? {
      return { type: 'Butter', mode };
    }

// RAW CSS escape hatch
RawStatement
  = 'RAW'i _ css:QuotedString _ ';'? { return { type: 'Raw', css }; }

// @property (CSS Custom Properties)
PropertyStatement
  = 'CREATE'i _ 'PROPERTY'i _ name:QuotedString _ '(' _ props:StyleProps _ ')' _ ';'? {
      return { type: 'Property', name, properties: props };
    }

// FONT FACE
FontFaceStatement
  = 'CREATE'i _ 'FONT_FACE'i _ 'family'i _ fam:QuotedString _ '(' _ props:StyleProps _ ')' _ ';'? {
      return { type: 'FontFace', family: fam, properties: props };
    }

// KEYFRAMES
KeyframesStatement
  = 'CREATE'i _ 'KEYFRAMES'i _ name:Identifier _ '(' _ frames:KeyframeList _ ')' _ ';'? {
      return { type: 'Keyframes', name, frames };
    }

KeyframeList
  = head:KeyframeBlock tail:(_ ',' _ KeyframeBlock)* { return [head, ...tail.map(t => t[3])]; }

KeyframeBlock
  = off:QuotedString _ '(' _ props:StyleProps _ ')' { return { offset: off, properties: props }; }

// IMPORT (SQL or CSS)
ImportStatement
  = 'IMPORT'i _ 'CSS'i _ path:QuotedString _ media:('media'i _ Identifier)? _ ';'? {
      return { type: 'Import', importType: 'css', path, media: media ? media[2] : undefined };
    }
  / 'IMPORT'i _ path:QuotedString _ ';'? {
      return { type: 'Import', importType: 'sql', path };
    }

// @page (Print Styling)
PageStatement
  = 'CREATE'i _ 'PAGE'i _ pseudo:QuotedString? _ '(' _ props:StyleProps _ ')' _ ';'? {
      return { type: 'Page', pseudo, properties: props };
    }

// DROP PAGE
DropPageStatement
  = 'DROP'i _ 'PAGE'i _ pseudo:QuotedString? _ ';'? {
      return { type: 'DropPage', pseudo };
    }

// @counter-style (Custom List Counters)
CounterStyleStatement
  = 'CREATE'i _ 'COUNTER_STYLE'i _ name:Identifier _ '(' _ props:StyleProps _ ')' _ ';'? {
      return { type: 'CounterStyle', name, properties: props };
    }

// DROP COUNTER_STYLE
DropCounterStyleStatement
  = 'DROP'i _ 'COUNTER_STYLE'i _ name:Identifier _ ';'? {
      return { type: 'DropCounterStyle', name };
    }

// @font-feature-values (Font Features)
FontFeatureValuesStatement
  = 'CREATE'i _ 'FONT_FEATURE_VALUES'i _ family:QuotedString _ '(' _ props:StyleProps _ ')' _ ';'? {
      return { type: 'FontFeatureValues', family, properties: props };
    }

// DROP FONT_FEATURE_VALUES
DropFontFeatureValuesStatement
  = 'DROP'i _ 'FONT_FEATURE_VALUES'i _ family:QuotedString _ ';'? {
      return { type: 'DropFontFeatureValues', family };
    }

// @font-palette-values (Color Fonts)
FontPaletteValuesStatement
  = 'CREATE'i _ 'FONT_PALETTE_VALUES'i _ name:QuotedString _ '(' _ props:StyleProps _ ')' _ ';'? {
      return { type: 'FontPaletteValues', name, properties: props };
    }

// DROP FONT_PALETTE_VALUES
DropFontPaletteValuesStatement
  = 'DROP'i _ 'FONT_PALETTE_VALUES'i _ name:QuotedString _ ';'? {
      return { type: 'DropFontPaletteValues', name };
    }

// @starting-style (Transition Starting States)
StartingStyleStatement
  = 'CREATE'i _ 'STARTING_STYLE'i _ 'SELECTOR'i _ selector:Identifier _ '(' _ props:StyleProps _ ')' _ ';'? {
      return { type: 'StartingStyle', selector, properties: props };
    }

// DROP STARTING_STYLE
DropStartingStyleStatement
  = 'DROP'i _ 'STARTING_STYLE'i _ 'SELECTOR'i _ selector:Identifier _ ';'? {
      return { type: 'DropStartingStyle', selector };
    }

// DML aliases: INSERT/UPDATE for style_props and tokens

DMLStyleInsert
  = 'INSERT'i _ 'INTO'i _ 'style_props'i _ '(' _ 'selector'i _ ',' _ 'prop'i _ ',' _ 'value'i _ ')' _ 'VALUES'i _ '(' _ sel:Identifier _ ',' _ prop:QuotedString _ ',' _ val:Value _ ')' _ ';'? {
      return { type: 'AlterStyle', selector: sel, action: 'SET', properties: [{ name: prop, value: val }] };
    }

Assignment
  = name:Identifier _ '=' _ value:Value { return { name, value }; }

AssignmentList
  = head:Assignment tail:(_ ',' _ Assignment)* { return [head, ...tail.map(t => t[3])]; }

DMLStyleUpdate
  = 'UPDATE'i _ 'style_props'i _ 'SET'i _ assigns:AssignmentList _ 'WHERE'i _ 'selector'i _ '=' _ sel:Identifier _ opt:('AND'i _ wb:WhereBody)? _ ';'? {
      const whereBody = opt ? opt[2] : null;
      const responsive = whereBody ? (function(){
        const src = whereBody.trim();
        const m1 = src.match(/^width\s+between\s+([^\s]+)\s+and\s+([^\s]+)$/i);
        if (m1) return { type: 'WidthBetween', min: m1[1], max: m1[2] };
        const m1a = src.match(/^width\s*(>=|>)\s*([^\s]+)$/i);
        if (m1a) return { type: 'WidthMin', min: m1a[2] };
        const m1b = src.match(/^width\s*(<=|<)\s*([^\s]+)$/i);
        if (m1b) return { type: 'WidthMax', max: m1b[2] };
        const m2 = src.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*>\s*([^\s]+)$/i);
        if (m2) return { type: 'Container', container: m2[1], min: m2[2] };
        const m2b = src.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*<\s*([^\s]+)$/i);
        if (m2b) return { type: 'Container', container: m2b[1], max: m2b[2] };
        const m2c = src.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+style\s*\((.+)\)$/i);
        if (m2c) return { type: 'ContainerStyle', container: m2c[1], condition: '(' + m2c[2].trim() + ')' };
        const m3 = src.match(/^prefers[_ ]?color[_ ]?scheme\s*=\s*(dark|light)$/i);
        if (m3) return { type: 'MediaFeature', feature: 'prefers-color-scheme', value: m3[1].toLowerCase() };
        const m4 = src.match(/^orientation\s*=\s*(portrait|landscape)$/i);
        if (m4) return { type: 'MediaFeature', feature: 'orientation', value: m4[1].toLowerCase() };
        return null;
      })() : null;
      return { type: 'AlterStyle', selector: sel, action: 'SET', properties: assigns, responsive };
    }

DMLTokenInsert
  = 'INSERT'i _ 'INTO'i _ 'tokens'i _ '(' _ 'name'i _ ',' _ 'value'i _ ')' _ 'VALUES'i _ '(' _ nm:QuotedString _ ',' _ vv:Value _ ')' _ ';'? {
      return { type: 'Token', name: nm, value: vv };
    }

DMLTokenUpdate
  = 'UPDATE'i _ 'tokens'i _ 'SET'i _ 'value'i _ '=' _ vv:Value _ 'WHERE'i _ 'name'i _ '=' _ nm:QuotedString _ ';'? {
      return { type: 'Token', name: nm, value: vv };
    }

// LEXICALS
// Updated to allow hyphens for CSS function names like 'linear-gradient', 'background-color', etc.
Identifier = $([a-zA-Z_][a-zA-Z0-9_-]*)

QuotedString
  = '"' cs:DoubleQuotedChar* '"' { return cs.join(""); }
  / '\'' cs:SingleQuotedChar* '\'' { return cs.join(""); }

DoubleQuotedChar = '\\"' { return '"'; } / '\\n' { return "\n"; } / '\\r' { return "\r"; } / '\\t' { return "\t"; } / [^"\\]
SingleQuotedChar = "\\'" { return "'"; } / '\\n' { return "\n"; } / '\\r' { return "\r"; } / '\\t' { return "\t"; } / [^'\\]

Value
  = head:ValAtom tail:(_ !StopToken ValAtom)* {
      return [head, ...tail.map(t => t[t.length - 1])].join(' ');
    }

ValAtom
  = FunctionCall
  / QuotedValue
  / BareValue
  / FallbackValue

StopToken
  = 'WHERE'i / 'AND'i / 'OR'i / 'VALUES'i / 'SET'i / ')' / ',' / ';'

QuotedValue
  = '"' cs:DoubleQuotedChar* '"' { return '"' + cs.join("") + '"'; }
  / '\'' cs:SingleQuotedChar* '\'' { return '\'' + cs.join("") + '\''; }

FunctionCall
  = name:Identifier _ '(' _ arg:FuncContent? _ ')' {
      return (arg != null) ? name + '(' + arg + ')' : name + '()';
    }

// Capture function content with balanced parentheses and quoted strings.
FuncContent
  = head:FuncChunk tail:FuncChunk* { return head + tail.join(''); }

FuncChunk
  = QuotedValue
  / NestedParens
  / RawRun

NestedParens
  = '(' _ c:FuncContent? _ ')' { return '(' + (c || '') + ')'; }

RawRun
  = chars:$((!('(' / ')') .)+) { return chars; }

// tokens like #2266ee, token('x/y'), 12px, repeat(3,1fr), or multi-part like "0 1px 2px"
// Capture until next comma or closing paren, then trim trailing whitespace.
BareValue = v:$([^,()\r\n; \t\u2028\u2029]+) { return v.trim(); }
FallbackValue = v:$([^,);\r\n]+) { return v.trim(); }

_ = ( [ \t\r\n\u2028\u2029] / LineComment / BlockComment )*

LineComment
  = '--' [^\n\r]* ("\r\n" / "\n" / "\r")?

BlockComment
  = '/*' (!'*/' .)* '*/'

// WHERE clauses for responsiveness (tolerant parsing)
WhereClause
  = 'WHERE'i _ body:WhereBody {
      const src = body.trim();
      // Simple fast path to preserve historical node types for tests
      let m;
      if ((m = src.match(/^width\s+between\s+([^\s]+)\s+and\s+([^\s]+)$/i))) return { type: 'WidthBetween', min: m[1], max: m[2] };
      if ((m = src.match(/^width\s*(>=|>)\s*([^\s]+)$/i))) return { type: 'WidthMin', min: m[2] };
      if ((m = src.match(/^width\s*(<=|<)\s*([^\s]+)$/i))) return { type: 'WidthMax', max: m[2] };
      if ((m = src.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:inline\s+)?>\s*([^\s]+)$/i))) return { type: 'Container', container: m[1], min: m[2], axis: /\sinline\s/i.test(src) ? 'inline' : undefined };
      if ((m = src.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:inline\s+)?<\s*([^\s]+)$/i))) return { type: 'Container', container: m[1], max: m[2], axis: /\sinline\s/i.test(src) ? 'inline' : undefined };
      if ((m = src.match(/^prefers[_ ]?color[_ ]?scheme\s*=\s*(dark|light)$/i))) return { type: 'MediaFeature', feature: 'prefers-color-scheme', value: m[1].toLowerCase() };
      if ((m = src.match(/^orientation\s*=\s*(portrait|landscape)$/i))) return { type: 'MediaFeature', feature: 'orientation', value: m[1].toLowerCase() };
      if ((m = src.match(/^prefers[_ ]?reduced[_ ]?motion\s*=\s*(reduce|no-preference)$/i))) return { type: 'MediaFeature', feature: 'prefers-reduced-motion', value: m[1].toLowerCase() };
      if ((m = src.match(/^color[_ ]?gamut\s*=\s*(srgb|p3|rec2020)$/i))) return { type: 'MediaFeature', feature: 'color-gamut', value: m[1].toLowerCase() };
      if ((m = src.match(/^forced[_ ]?colors\s*=\s*(active|none)$/i))) return { type: 'MediaFeature', feature: 'forced-colors', value: m[1].toLowerCase() };
      if ((m = src.match(/^pointer\s*=\s*(none|coarse|fine)$/i))) return { type: 'MediaFeature', feature: 'pointer', value: m[1].toLowerCase() };
      if ((m = src.match(/^hover\s*=\s*(hover|none)$/i))) return { type: 'MediaFeature', feature: 'hover', value: m[1].toLowerCase() };
      if ((m = src.match(/^resolution\s*=\s*([0-9]+(?:\.[0-9]+)?dppx|[0-9]+dpi|[0-9]+dpcm)$/i))) return { type: 'MediaFeature', feature: 'resolution', value: m[1].toLowerCase() };
      if ((m = src.match(/^supports\s*\((.+)\)$/i))) return { type: 'Supports', condition: '(' + m[1] + ')' };
      function stripParens(s) {
        s = s.trim();
        while (s.startsWith('(') && s.endsWith(')')) {
          const inner = s.slice(1, -1).trim();
          // ensure balanced
          let d=0, ok=true;
          for (let i=0;i<inner.length;i++){ const c=inner[i]; if(c==='(') d++; else if(c===')'){ if(d===0){ok=false;break;} d--; } }
          if (!ok || d!==0) break;
          s = inner;
        }
        return s;
      }
      function splitTop(s, kw) {
        const out=[]; let d=0; let i=0; const up = s.toUpperCase();
        let last=0; let betweenPending=false;
        while (i < s.length) {
          const ch = s[i];
          if (ch==='(') { d++; i++; continue; }
          if (ch===')') { d = Math.max(0,d-1); i++; continue; }
          if (d===0) {
            // Detect BETWEEN token to avoid splitting on the next AND
            if (kw === 'AND' && up.startsWith(' BETWEEN ', i)) {
              betweenPending = true;
              i += ' BETWEEN '.length;
              continue;
            }
            if (up.startsWith(' '+kw+' ', i)) {
              if (kw === 'AND' && betweenPending) {
                // consume this AND as part of BETWEEN and reset flag
                betweenPending = false;
                i += (' '+kw+' ').length;
                continue;
              }
              out.push(s.slice(last, i));
              i += kw.length + 2;
              last = i;
              continue;
            }
          }
          i++;
        }
        out.push(s.slice(last));
        return out.map(stripParens).filter(Boolean);
      }
      function parseSingle(s) {
        s = stripParens(s);
        let m;
        if ((m = s.match(/^width\s+between\s+([^\s]+)\s+and\s+([^\s]+)$/i))) return { kind: 'media', min: m[1], max: m[2] };
        if ((m = s.match(/^width\s*(>=|>)\s*([^\s]+)$/i))) return { kind: 'media', min: m[2] };
        if ((m = s.match(/^width\s*(<=|<)\s*([^\s]+)$/i))) return { kind: 'media', max: m[2] };
        if ((m = s.match(/^prefers[_ ]?color[_ ]?scheme\s*=\s*(dark|light)$/i))) return { kind: 'media', features: ['(prefers-color-scheme: ' + m[1].toLowerCase() + ')'] };
        if ((m = s.match(/^orientation\s*=\s*(portrait|landscape)$/i))) return { kind: 'media', features: ['(orientation: ' + m[1].toLowerCase() + ')'] };
        if ((m = s.match(/^prefers[_ ]?reduced[_ ]?motion\s*=\s*(reduce|no-preference)$/i))) return { kind: 'media', features: ['(prefers-reduced-motion: ' + m[1].toLowerCase() + ')'] };
        if ((m = s.match(/^color[_ ]?gamut\s*=\s*(srgb|p3|rec2020)$/i))) return { kind: 'media', features: ['(color-gamut: ' + m[1].toLowerCase() + ')'] };
        if ((m = s.match(/^forced[_ ]?colors\s*=\s*(active|none)$/i))) return { kind: 'media', features: ['(forced-colors: ' + m[1].toLowerCase() + ')'] };
        if ((m = s.match(/^pointer\s*=\s*(none|coarse|fine)$/i))) return { kind: 'media', features: ['(pointer: ' + m[1].toLowerCase() + ')'] };
        if ((m = s.match(/^hover\s*=\s*(hover|none)$/i))) return { kind: 'media', features: ['(hover: ' + m[1].toLowerCase() + ')'] };
        if ((m = s.match(/^resolution\s*=\s*([0-9]+(?:\.[0-9]+)?dppx|[0-9]+dpi|[0-9]+dpcm)$/i))) return { kind: 'media', features: ['(resolution: ' + m[1].toLowerCase() + ')'] };
        if ((m = s.match(/^supports\s*\((.+)\)$/i))) return { kind: 'supports', condition: '(' + m[1] + ')' };
        if ((m = s.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:inline\s+)?>\s*([^\s]+)$/i))) return { kind: 'container', name: m[1], min: m[2], axis: /\sinline\s/i.test(s) ? 'inline' : undefined };
        if ((m = s.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:inline\s+)?<\s*([^\s]+)$/i))) return { kind: 'container', name: m[1], max: m[2], axis: /\sinline\s/i.test(s) ? 'inline' : undefined };
        if ((m = s.match(/^container\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+style\s*\((.+)\)$/i))) return { kind: 'container-style', name: m[1], condition: '(' + m[2].trim() + ')' };
        throw new Error('Invalid WHERE clause part: ' + s);
      }
      const orParts = splitTop(src, 'OR');
      const options = orParts.map(part => {
        const andParts = splitTop(part, 'AND');
        let media = { min: undefined, max: undefined, features: [] };
        let container = null;
        let containerStyle = null;
        let supports = null;
        for (const p of andParts) {
          const cond = parseSingle(p);
          if (cond.kind === 'media') {
            if (cond.min) media.min = cond.min;
            if (cond.max) media.max = cond.max;
            if (cond.features) media.features.push(...cond.features);
          } else if (cond.kind === 'container') {
            if (!container) container = { name: cond.name, min: undefined, max: undefined };
            if (cond.name !== container.name) throw new Error('Cannot combine multiple containers in one WHERE');
            if (cond.min) container.min = cond.min;
            if (cond.max) container.max = cond.max;
          } else if (cond.kind === 'container-style') {
            if (container) throw new Error('Combining container size and style queries is not supported');
            if (containerStyle && containerStyle.name !== cond.name) throw new Error('Cannot combine multiple containers in one WHERE');
            containerStyle = { name: cond.name, condition: cond.condition };
          } else if (cond.kind === 'supports') {
            if (supports) throw new Error('Multiple supports() conditions in one WHERE not supported');
            supports = cond.condition;
          }
        }
        // Allow supports() to mix with media or container; still disallow container-style mix with media for now
        if (containerStyle && (media.min || media.max || (media.features && media.features.length))) {
          throw new Error('Combining container style queries with media conditions is not supported');
        }
        if (containerStyle) return { type: 'ContainerStyle', container: containerStyle.name, condition: containerStyle.condition };
        if (container) {
          const obj: any = { type: 'Container', container: container.name, min: container.min, max: container.max };
          if (supports) obj.supports = supports;
          return obj;
        }
        if (media.min || media.max || (media.features && media.features.length)) {
          const obj: any = { type: 'MediaBundle', min: media.min, max: media.max, features: media.features };
          if (supports) obj.supports = supports;
          return obj;
        }
        if (supports) return { type: 'Supports', condition: supports };
        return { type: 'MediaBundle', min: undefined, max: undefined, features: [] };
      });
      if (options.length === 1) return options[0];
      // Only media OR supported; if any container present among options, throw
      if (options.some(o => o.type === 'Container')) throw new Error('OR composition not supported for container WHERE');
      if (options.some(o => o.type === 'ContainerStyle')) throw new Error('OR composition not supported for container WHERE');
      return { type: 'MediaOr', options };
    }

WhereBody
  = t:$(( !('S'i 'E'i 'T'i) !('A'i 'D'i 'D'i) !';' . )+) { return t; }

// (structured WHERE parsing handled by WhereBody)
