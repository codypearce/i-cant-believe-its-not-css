import { MigrationFileAST, SelectorDefinition, StyleProperty } from '../parser/ast.js';
import type { DbTables, StyleRow, FontFaceRow, KeyframesRow, RawBlockRow, PropertyRow, PageRow, CounterStyleRow, FontFeatureValuesRow, FontPaletteValuesRow, StartingStyleRow } from '../db/schema.js';

type Tokens = Map<string, string>;
type Selectors = Map<string, SelectorDefinition>;

function toKebab(name: string): string {
  return name.replace(/_/g, '-');
}

function normalizeValue(raw: any): string {
  if (Array.isArray(raw)) raw = raw.join('');
  if (raw == null) return '';
  const s = typeof raw === 'string' ? raw : String(raw);
  // Strip any trailing semicolons/spaces from parsed values
  return s.replace(/;+\s*$/, '');
}

function getTokenPrefix(): string {
  return process.env.ICBINCSS_TOKEN_PREFIX || '';
}

function tokenCssName(name: string): string {
  const prefix = getTokenPrefix();
  return `--${prefix}${normalizeTokenName(name)}`;
}

function resolveValue(raw: any): string {
  const val = normalizeValue(raw);
  // Convert token('a/b') to var(--a/b)
  const tokenCall = val.match(/^token\((['"])(.+?)\1\)$/);
  if (tokenCall) return `var(${tokenCssName(tokenCall[2])})`;
  return val;
}

function butterSize(mode?: string): string {
  switch ((mode || '').toLowerCase()) {
    case 'thin_spread': return '4px';
    case 'medium_spread': return '12px';
    case 'thick_smear': return '24px';
    default: return '8px';
  }
}

function resolveButterIfNeeded(val: string, propName: string, butterMode?: string): string {
  if (/^BUTTER\(\)$/i.test(val)) {
    return butterSize(butterMode);
  }
  return val;
}

export function selectorToCss(def: SelectorDefinition, resolveRef?: (name: string) => SelectorDefinition | undefined): string {
  switch (def.kind) {
    case 'Element':
      return def.value;
    case 'Class':
      return `.${def.value}`;
    case 'Pseudo':
      return `:${def.value}`;
    case 'PseudoElement':
      return `::${def.value}`;
    case 'Id':
      return `#${def.value}`;
    case 'Attr': {
      if (def.value == null) return `[${def.name}]`;
      const op = def.operator || '=';
      const flag = def.flag ? ` ${def.flag}` : '';
      return `[${def.name}${op}"${def.value}"${flag}]`;
    }
    case 'Ref': {
      const ref = resolveRef?.(def.name);
      if (ref) return selectorToCss(ref, resolveRef);
      // Fallback: assume class if unresolved
      return `.${def.name}`;
    }
    case 'And':
      return def.selectors.map(s => selectorToCss(s, resolveRef)).join('');
    case 'Or':
      return def.selectors.map(s => selectorToCss(s, resolveRef)).join(', ');
    case 'Child':
      return `${selectorToCss(def.parent, resolveRef)} > ${selectorToCss(def.child, resolveRef)}`;
    case 'Descendant':
      return `${selectorToCss(def.ancestor, resolveRef)} ${selectorToCss(def.descendant, resolveRef)}`;
    case 'Join': {
      const left = selectorToCss(def.left, resolveRef);
      const right = selectorToCss(def.right, resolveRef);
      switch (def.joinType) {
        case 'AND':
          return `${left}${right}`;
        case 'DESC':
          return `${left} ${right}`;
        case 'CHILD':
          return `${left} > ${right}`;
        case 'ADJ':
          return `${left} + ${right}`;
        case 'SIB':
          return `${left} ~ ${right}`;
        default:
          return `${left}${right}`;
      }
    }
  }
  return '' as any;
}

export type Origin = { file?: string; start?: { line: number; column: number }; end?: { line: number; column: number } };

export type RulePlan = {
  key: string;
  selectorCss: string;
  props: Array<StyleProperty & { origin?: Origin }>;
  layer?: string;
  scopeRoot?: string;
  scopeLimit?: string;
  supports?: string;
  responsive?: { kind: 'media'; min?: string; max?: string; features?: string[] }
    | { kind: 'container'; name: string; min?: string; max?: string; axis?: 'inline' }
    | { kind: 'container-style'; name: string; condition: string }
    | { kind: 'supports'; condition: string };
  origin?: Origin;
};

export function buildRules(ast: MigrationFileAST): { tokens: Map<string, string>; rules: RulePlan[]; layers: string[] } {
  const tokens: Tokens = new Map();
  const selectors: Selectors = new Map();
  type Resp = RulePlan['responsive'] | undefined;
  const rules: RulePlan[] = [];
  const declaredLayers: string[] = [];
  // Seed declared layers from env (ICBINCSS_DEFAULT_LAYERS), if provided
  const envLayers = (process.env.ICBINCSS_DEFAULT_LAYERS || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter((x: string) => Boolean(x));
  for (const l of envLayers) if (!declaredLayers.includes(l)) declaredLayers.push(l);
  let currentLayer: string | undefined = undefined;
  let butterMode: string | undefined = process.env.ICBINCSS_BUTTER || undefined;
  const properties: Array<{ name: string; syntax?: string; inherits?: string; initial_value?: string }> = [];
  const fontFaces: Array<{ family: string; props: StyleProperty[] }> = [];
  const keyframes: Array<{ name: string; frames: Array<{ offset: string; props: StyleProperty[] }> }> = [];
  const imports: Array<{ importType: 'sql' | 'css'; path: string; media?: string }> = [];
  const pages: Array<{ pseudo?: string; props: StyleProperty[] }> = [];
  const counterStyles: Array<{ name: string; props: StyleProperty[] }> = [];
  const fontFeatureValues: Array<{ family: string; features: StyleProperty[] }> = [];
  const fontPaletteValues: Array<{ name: string; props: StyleProperty[] }> = [];
  const startingStyles: Array<{ selector: string; selectorCss: string; props: StyleProperty[] }> = [];

  for (const node of ast) {
    switch (node.type) {
      case 'Token':
        tokens.set(node.name, normalizeValue((node as any).value));
        break;
      case 'Selector':
        selectors.set(node.name, node.definition);
        break;
      case 'Style': {
        const def = selectors.get(node.selector);
        const selectorCss = def ? selectorToCss(def, (n) => selectors.get(n)) : `.${node.selector}`;

        // Extract scope information
        const scopeRoot = (node as any).scopeRoot ? (
          selectors.get((node as any).scopeRoot) ?
            selectorToCss(selectors.get((node as any).scopeRoot)!, (n) => selectors.get(n)) :
            `.${(node as any).scopeRoot}`
        ) : undefined;
        const scopeLimit = (node as any).scopeLimit ? (
          selectors.get((node as any).scopeLimit) ?
            selectorToCss(selectors.get((node as any).scopeLimit)!, (n) => selectors.get(n)) :
            `.${(node as any).scopeLimit}`
        ) : undefined;

        let resp: Resp = undefined;
        let supportsCond: string | undefined = undefined;
        if ((node as any).responsive) {
          const r = (node as any).responsive;
          if (r.type === 'MediaOr') {
            // Expand: create separate buckets for each option
            for (const opt of r.options) {
              const def = selectors.get(node.selector);
              const selectorCss = def ? selectorToCss(def, (n) => selectors.get(n)) : `.${node.selector}`;
              const media: any = { kind: 'media' };
              if (opt.min) media.min = normalizeValue(opt.min) || undefined;
              if (opt.max) media.max = normalizeValue(opt.max) || undefined;
              if (opt.features) media.features = opt.features.slice();
              rules.push({ key: node.selector, selectorCss, props: node.properties.map((p: any) => ({ name: p.name, value: normalizeValue(p.value) })), layer: currentLayer, scopeRoot, scopeLimit, responsive: media });
            }
            break;
          }
          if ((r as any).supports) {
            supportsCond = (r as any).supports;
          }
          if (r.type === 'WidthBetween') {
            const min = normalizeValue(r.min);
            const max = normalizeValue(r.max);
            resp = { kind: 'media', min: min || undefined, max: max || undefined };
          } else if (r.type === 'WidthMin') {
            const min = normalizeValue(r.min);
            resp = { kind: 'media', min: min || undefined };
          } else if (r.type === 'WidthMax') {
            const max = normalizeValue(r.max);
            resp = { kind: 'media', max: max || undefined };
          } else if (r.type === 'Container') {
            const obj: any = { kind: 'container', name: r.container };
            if (r.min) obj.min = normalizeValue(r.min) || undefined;
            if (r.max) obj.max = normalizeValue(r.max) || undefined;
            if ((r as any).axis) obj.axis = (r as any).axis;
            resp = obj;
          } else if ((r as any).type === 'ContainerStyle') {
            resp = { kind: 'container-style', name: (r as any).container, condition: (r as any).condition } as any;
          } else if (r.type === 'MediaFeature') {
            const feat = `(${r.feature}: ${normalizeValue(r.value)})`;
            resp = { kind: 'media', features: [feat] };
          } else if (r.type === 'MediaBundle') {
            const bundle: any = { kind: 'media' };
            if (r.min) bundle.min = normalizeValue(r.min) || undefined;
            if (r.max) bundle.max = normalizeValue(r.max) || undefined;
            if (r.features && r.features.length) bundle.features = r.features.slice();
            resp = bundle;
          }
          if (r.type === 'Supports') {
            // pure supports-only bucket
            resp = { kind: 'supports', condition: (r as any).condition } as any;
            supportsCond = undefined;
          }
        }
        rules.push({ key: node.selector, selectorCss, props: node.properties.map((p: any) => {
          const v = normalizeValue((p as any).value);
          const file = (node as any)._file;
          return { name: p.name, value: resolveButterIfNeeded(v, p.name, butterMode), origin: file ? { file } : undefined };
        }), layer: currentLayer, scopeRoot, scopeLimit, supports: supportsCond, responsive: resp, origin: undefined });
        break;
      }
      case 'AlterStyle': {
        // Extract scope information
        const scopeRoot = (node as any).scopeRoot ? (
          selectors.get((node as any).scopeRoot) ?
            selectorToCss(selectors.get((node as any).scopeRoot)!, (n) => selectors.get(n)) :
            `.${(node as any).scopeRoot}`
        ) : undefined;
        const scopeLimit = (node as any).scopeLimit ? (
          selectors.get((node as any).scopeLimit) ?
            selectorToCss(selectors.get((node as any).scopeLimit)!, (n) => selectors.get(n)) :
            `.${(node as any).scopeLimit}`
        ) : undefined;

        const sameResp = (a?: Resp, b?: Resp): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
        const sameScope = (a?: string, b?: string): boolean => (a || '') === (b || '');
        const applyToBucket = (resp: Resp) => {
          let idx = -1;
          for (let i = rules.length - 1; i >= 0; i--) {
            if (rules[i].key === node.selector && rules[i].layer === currentLayer && sameScope(rules[i].scopeRoot, scopeRoot) && sameScope(rules[i].scopeLimit, scopeLimit) && sameResp(rules[i].responsive, resp)) { idx = i; break; }
          }
          if (idx === -1) {
            const def = selectors.get(node.selector);
            const selectorCss = def ? selectorToCss(def, (n) => selectors.get(n)) : `.${node.selector}`;
            rules.push({ key: node.selector, selectorCss, props: [], layer: currentLayer, scopeRoot, scopeLimit, responsive: resp });
            idx = rules.length - 1;
          }
          const target = rules[idx];
          const file = (node as any)._file;
          for (const np of node.properties) {
            const v = normalizeValue((np as any).value);
            const nprop = { name: np.name, value: resolveButterIfNeeded(v, np.name, butterMode), origin: file ? { file } : undefined } as any;
            const existingIndex = target.props.findIndex(p => p.name === np.name);
            if (node.action === 'SET') {
              if (existingIndex >= 0) target.props[existingIndex] = nprop;
              else target.props.push(nprop);
            } else { // ADD
              if (existingIndex === -1) target.props.push(nprop);
            }
          }
        };

        let resp: Resp = undefined;
        let supportsCond: string | undefined = undefined;
        if ((node as any).responsive) {
          const r = (node as any).responsive;
          if (r.type === 'MediaOr') {
            for (const opt of r.options) {
              const media: any = { kind: 'media' };
              if (opt.min) media.min = normalizeValue(opt.min) || undefined;
              if (opt.max) media.max = normalizeValue(opt.max) || undefined;
              if (opt.features) media.features = opt.features.slice();
              applyToBucket(media);
            }
            break;
          } else if ((r as any).supports) {
            supportsCond = (r as any).supports;
          } else if (r.type === 'WidthBetween') {
            const min = normalizeValue(r.min);
            const max = normalizeValue(r.max);
            resp = { kind: 'media', min: min || undefined, max: max || undefined };
          } else if (r.type === 'WidthMin') {
            const min = normalizeValue(r.min);
            resp = { kind: 'media', min: min || undefined };
          } else if (r.type === 'WidthMax') {
            const max = normalizeValue(r.max);
            resp = { kind: 'media', max: max || undefined };
          } else if (r.type === 'Container') {
            const obj: any = { kind: 'container', name: r.container };
            if (r.min) obj.min = normalizeValue(r.min) || undefined;
            if (r.max) obj.max = normalizeValue(r.max) || undefined;
            if ((r as any).axis) obj.axis = (r as any).axis;
            resp = obj;
          } else if ((r as any).type === 'ContainerStyle') {
            resp = { kind: 'container-style', name: (r as any).container, condition: (r as any).condition } as any;
          } else if (r.type === 'MediaFeature') {
            const feat = `(${r.feature}: ${normalizeValue(r.value)})`;
            resp = { kind: 'media', features: [feat] };
          } else if (r.type === 'MediaBundle') {
            const bundle: any = { kind: 'media' };
            if (r.min) bundle.min = normalizeValue(r.min) || undefined;
            if (r.max) bundle.max = normalizeValue(r.max) || undefined;
            if (r.features && r.features.length) bundle.features = r.features.slice();
            resp = bundle;
          } else if ((r as any).type === 'Supports') {
            // pure supports-only bucket for ALTER
            resp = { kind: 'supports', condition: (r as any).condition } as any;
            supportsCond = undefined;
          }
        }
        applyToBucket(resp);
        // attach supportsCond on the target bucket (last rule for this selector+layer+resp)
        if (supportsCond) {
          const def = selectors.get(node.selector);
          const selectorCss2 = def ? selectorToCss(def, (n) => selectors.get(n)) : `.${node.selector}`;
          // find the last matching rule
          for (let i = rules.length - 1; i >= 0; i--) {
            if (rules[i].selectorCss === selectorCss2 && rules[i].layer === currentLayer && JSON.stringify(rules[i].responsive ?? null) === JSON.stringify(resp ?? null)) {
              (rules[i] as any).supports = supportsCond;
              break;
            }
          }
        }
        break;
      }
      case 'Butter': {
        butterMode = (node as any).mode;
        break;
      }
      case 'Delete': {
        // Remove a property from the last matching rule for this selector
        let idx = -1;
        for (let i = rules.length - 1; i >= 0; i--) {
          if (rules[i].key === node.selector && rules[i].layer === currentLayer) { idx = i; break; }
        }
        if (idx !== -1 && node.property) {
          const propName = node.property; // already a string
          const target = rules[idx];
          target.props = target.props.filter(p => p.name !== propName);
        }
        break;
      }
      case 'Drop': {
        // Remove all rules for this selector
        for (let i = rules.length - 1; i >= 0; i--) {
          if (rules[i].key === node.selector && rules[i].layer === currentLayer) {
            rules.splice(i, 1);
          }
        }
        break;
      }
      case 'Raw': {
        // Encode as a special rule with a marker
        rules.push({ key: `__raw__${rules.length}`, selectorCss: '', props: [], layer: currentLayer, origin: undefined, responsive: undefined } as any);
        // Store raw CSS in a side channel by abusing tokens map with a special key
        // Instead, we'll emit these after normal rules via a separate array
        break;
      }
      case 'Layer': {
        for (const l of node.layers) {
          if (!declaredLayers.includes(l)) declaredLayers.push(l);
        }
        break;
      }
      case 'SetLayer': {
        currentLayer = node.layer;
        if (!declaredLayers.includes(currentLayer)) {
          // allow undeclared layers; they will be emitted after declared ones
        }
        break;
      }
      case 'Property': {
        const props = (node as any).properties || [];
        const syntax = props.find((p: any) => p.name === 'syntax')?.value;
        const inherits = props.find((p: any) => p.name === 'inherits')?.value;
        const initialValue = props.find((p: any) => p.name === 'initial_value')?.value;
        properties.push({
          name: (node as any).name,
          syntax: syntax ? normalizeValue(syntax) : undefined,
          inherits: inherits ? normalizeValue(inherits) : undefined,
          initial_value: initialValue ? normalizeValue(initialValue) : undefined,
        });
        break;
      }
      case 'DropProperty': {
        const name = (node as any).name;
        for (let i = properties.length - 1; i >= 0; i--) if (properties[i].name === name) properties.splice(i, 1);
        break;
      }
      case 'FontFace': {
        fontFaces.push({ family: (node as any).family, props: (node as any).properties.map((p: any) => ({ name: p.name, value: normalizeValue(p.value) })) });
        break;
      }
      case 'Keyframes': {
        keyframes.push({
          name: (node as any).name,
          frames: (node as any).frames.map((f: any) => ({ offset: f.offset, props: f.properties.map((p: any) => ({ name: p.name, value: normalizeValue(p.value) })) })),
        });
        break;
      }
      case 'DropToken': {
        tokens.delete((node as any).name);
        break;
      }
      case 'DeleteToken': {
        tokens.delete((node as any).name);
        break;
      }
      case 'DropKeyframes': {
        const name = (node as any).name;
        for (let i = keyframes.length - 1; i >= 0; i--) if (keyframes[i].name === name) keyframes.splice(i, 1);
        break;
      }
      case 'DropFontFace': {
        const fam = (node as any).family;
        for (let i = fontFaces.length - 1; i >= 0; i--) if (fontFaces[i].family === fam) fontFaces.splice(i, 1);
        break;
      }
      case 'Import': {
        imports.push({
          importType: (node as any).importType,
          path: (node as any).path,
          media: (node as any).media
        });
        break;
      }
      case 'Page': {
        pages.push({ pseudo: (node as any).pseudo, props: (node as any).properties.map((p: any) => ({ name: p.name, value: normalizeValue(p.value) })) });
        break;
      }
      case 'DropPage': {
        const pseudo = (node as any).pseudo;
        for (let i = pages.length - 1; i >= 0; i--) {
          if ((pseudo && pages[i].pseudo === pseudo) || (!pseudo && !pages[i].pseudo)) {
            pages.splice(i, 1);
          }
        }
        break;
      }
      case 'CounterStyle': {
        counterStyles.push({ name: (node as any).name, props: (node as any).properties.map((p: any) => ({ name: p.name, value: normalizeValue(p.value) })) });
        break;
      }
      case 'DropCounterStyle': {
        const name = (node as any).name;
        for (let i = counterStyles.length - 1; i >= 0; i--) {
          if (counterStyles[i].name === name) {
            counterStyles.splice(i, 1);
          }
        }
        break;
      }
      case 'FontFeatureValues': {
        fontFeatureValues.push({ family: (node as any).family, features: (node as any).properties.map((p: any) => ({ name: p.name, value: normalizeValue(p.value) })) });
        break;
      }
      case 'DropFontFeatureValues': {
        const family = (node as any).family;
        for (let i = fontFeatureValues.length - 1; i >= 0; i--) {
          if (fontFeatureValues[i].family === family) {
            fontFeatureValues.splice(i, 1);
          }
        }
        break;
      }
      case 'FontPaletteValues': {
        fontPaletteValues.push({ name: (node as any).name, props: (node as any).properties.map((p: any) => ({ name: p.name, value: normalizeValue(p.value) })) });
        break;
      }
      case 'DropFontPaletteValues': {
        const name = (node as any).name;
        for (let i = fontPaletteValues.length - 1; i >= 0; i--) {
          if (fontPaletteValues[i].name === name) {
            fontPaletteValues.splice(i, 1);
          }
        }
        break;
      }
      case 'StartingStyle': {
        const selectorName = (node as any).selector;
        const def = selectors.get(selectorName);
        const selectorCss = def ? selectorToCss(def, (n) => selectors.get(n)) : `.${selectorName}`;
        startingStyles.push({ selector: selectorName, selectorCss, props: (node as any).properties.map((p: any) => ({ name: p.name, value: normalizeValue(p.value) })) });
        break;
      }
      case 'DropStartingStyle': {
        const selector = (node as any).selector;
        for (let i = startingStyles.length - 1; i >= 0; i--) {
          if (startingStyles[i].selector === selector) {
            startingStyles.splice(i, 1);
          }
        }
        break;
      }
      case 'Begin':
      case 'Commit':
      case 'Rollback':
        // No-op for CSS output in MVP
        break;
      case 'SelectStyleProps':
      case 'DescribeSelector':
        // no-op for CSS compile; handled by CLI tooling
        break;
      default:
        // ignore other nodes for MVP
        break;
    }
  }

  // Attach extras on tokens map for downstream compile
  (tokens as any).__properties = properties;
  (tokens as any).__fontFaces = fontFaces;
  (tokens as any).__keyframes = keyframes;
  (tokens as any).__imports = imports;
  (tokens as any).__pages = pages;
  (tokens as any).__counterStyles = counterStyles;
  (tokens as any).__fontFeatureValues = fontFeatureValues;
  (tokens as any).__fontPaletteValues = fontPaletteValues;
  (tokens as any).__startingStyles = startingStyles;
  return { tokens, rules, layers: declaredLayers };
}

export function compileToCss(ast: MigrationFileAST): string {
  const { tokens, rules, layers: declaredLayers } = buildRules(ast);
  const out: string[] = [];

  // Emit @import rules first (only CSS imports)
  const imports: Array<{ importType: 'sql' | 'css'; path: string; media?: string }> = (tokens as any).__imports || [];
  for (const imp of imports) {
    if (imp.importType === 'css') {
      if (imp.media) {
        out.push(`@import url('${imp.path}') ${imp.media};`);
      } else {
        out.push(`@import url('${imp.path}');`);
      }
    }
  }
  if (imports.some(i => i.importType === 'css')) {
    out.push('');
  }

  if (tokens.size) {
    out.push(':root {');
    for (const [name, value] of tokens) {
      out.push(`  ${tokenCssName(name)}: ${normalizeValue(value)};`);
    }
    out.push('}');
    out.push('');
  }

  // Emit @property rules
  const properties: Array<{ name: string; syntax?: string; inherits?: string; initial_value?: string }> = (tokens as any).__properties || [];
  for (const prop of properties) {
    out.push(`@property ${prop.name} {`);
    if (prop.syntax) out.push(`  syntax: ${resolveValue(prop.syntax)};`);
    if (prop.inherits) out.push(`  inherits: ${prop.inherits};`);
    if (prop.initial_value) out.push(`  initial-value: ${resolveValue(prop.initial_value)};`);
    out.push('}');
    out.push('');
  }

  // Emit font faces
  const fontFaces: Array<{ family: string; props: StyleProperty[] }> = (tokens as any).__fontFaces || [];
  for (const ff of fontFaces) {
    out.push('@font-face {');
    out.push(`  font-family: "${ff.family}";`);
    for (const p of ff.props) {
      out.push(`  ${toKebab(p.name)}: ${resolveValue(p.value)};`);
    }
    out.push('}');
    out.push('');
  }

  // Emit pages
  const pages: Array<{ pseudo?: string; props: StyleProperty[] }> = (tokens as any).__pages || [];
  for (const pg of pages) {
    if (pg.pseudo) {
      out.push(`@page ${pg.pseudo} {`);
    } else {
      out.push('@page {');
    }
    for (const p of pg.props) {
      out.push(`  ${toKebab(p.name)}: ${resolveValue(p.value)};`);
    }
    out.push('}');
    out.push('');
  }

  // Emit counter styles
  const counterStyles: Array<{ name: string; props: StyleProperty[] }> = (tokens as any).__counterStyles || [];
  for (const cs of counterStyles) {
    out.push(`@counter-style ${cs.name} {`);
    for (const p of cs.props) {
      out.push(`  ${toKebab(p.name)}: ${resolveValue(p.value)};`);
    }
    out.push('}');
    out.push('');
  }

  // Emit font feature values
  const fontFeatureValues: Array<{ family: string; features: StyleProperty[] }> = (tokens as any).__fontFeatureValues || [];
  for (const ffv of fontFeatureValues) {
    out.push(`@font-feature-values "${ffv.family}" {`);
    // Group features by block type (swash_, styleset_, etc.)
    const blocks = new Map<string, Array<{ name: string; value: string }>>();
    for (const f of ffv.features) {
      const parts = f.name.split('_');
      if (parts.length >= 2) {
        const blockType = parts[0];
        const featureName = parts.slice(1).join('_');
        if (!blocks.has(blockType)) blocks.set(blockType, []);
        blocks.get(blockType)!.push({ name: featureName, value: resolveValue(f.value) });
      }
    }
    for (const [blockType, features] of blocks) {
      out.push(`  @${blockType} {`);
      for (const feat of features) {
        out.push(`    ${feat.name}: ${feat.value};`);
      }
      out.push('  }');
    }
    out.push('}');
    out.push('');
  }

  // Emit font palette values
  const fontPaletteValues: Array<{ name: string; props: StyleProperty[] }> = (tokens as any).__fontPaletteValues || [];
  for (const fpv of fontPaletteValues) {
    out.push(`@font-palette-values ${fpv.name} {`);
    for (const p of fpv.props) {
      out.push(`  ${toKebab(p.name)}: ${resolveValue(p.value)};`);
    }
    out.push('}');
    out.push('');
  }

  // Emit starting styles
  const startingStyles: Array<{ selector: string; selectorCss: string; props: StyleProperty[] }> = (tokens as any).__startingStyles || [];
  if (startingStyles.length > 0) {
    out.push('@starting-style {');
    for (const ss of startingStyles) {
      out.push(`  ${ss.selectorCss} {`);
      for (const p of ss.props) {
        out.push(`    ${toKebab(p.name)}: ${resolveValue(p.value)};`);
      }
      out.push('  }');
    }
    out.push('}');
    out.push('');
  }

  // Group rules by layer
  const byLayer = new Map<string | undefined, typeof rules>();
  for (const r of rules) {
    const key = r.layer; // undefined for global
    const arr = byLayer.get(key) ?? [];
    arr.push(r);
    byLayer.set(key, arr);
  }

  // Emit unlayered/global rules first
  const emitRules = (list: typeof rules, indent = '') => {
    // Group by scope first
    const byScope = new Map<string, typeof rules>();
    for (const rule of list) {
      const scopeKey = `${rule.scopeRoot || ''}||${rule.scopeLimit || ''}`;
      const arr = byScope.get(scopeKey) ?? [];
      arr.push(rule);
      byScope.set(scopeKey, arr);
    }

    for (const [scopeKey, scopedRules] of byScope) {
      const [scopeRoot, scopeLimit] = scopeKey.split('||');
      const hasScope = scopeRoot || scopeLimit;

      if (hasScope) {
        // Emit @scope wrapper
        let scopeLine = `@scope (${scopeRoot})`;
        if (scopeLimit) scopeLine += ` to (${scopeLimit})`;
        scopeLine += ' {';
        out.push(`${indent}${scopeLine}`);
      }

      const scopeIndent = hasScope ? indent + '  ' : indent;

      for (const rule of scopedRules) {
        // Wrap with responsive if present
        const wrappers: string[] = [];
        if (rule.supports) {
          wrappers.push(`@supports ${rule.supports} {`);
        }
        if (rule.responsive && rule.responsive.kind === 'media') {
          const parts: string[] = [];
          if (rule.responsive.min && (rule.responsive.min as string).toUpperCase() !== 'INF') parts.push(`(min-width: ${rule.responsive.min})`);
          if (rule.responsive.max && (rule.responsive.max as string).toUpperCase() !== 'INF') parts.push(`(max-width: ${rule.responsive.max})`);
          if (rule.responsive.features && rule.responsive.features.length) parts.push(...rule.responsive.features);
          if (parts.length) wrappers.push(`@media ${parts.join(' and ')} {`);
        } else if (rule.responsive && rule.responsive.kind === 'container') {
          const cparts: string[] = [];
          const axis = (rule.responsive as any).axis === 'inline' ? 'inline-size' : 'width';
          if (rule.responsive.min && (rule.responsive.min as string).toUpperCase() !== 'INF') cparts.push(`(min-${axis}: ${rule.responsive.min})`);
          if (rule.responsive.max && (rule.responsive.max as string).toUpperCase() !== 'INF') cparts.push(`(max-${axis}: ${rule.responsive.max})`);
          const cond = cparts.length ? ' ' + cparts.join(' and ') : '';
          wrappers.push(`@container ${rule.responsive.name}${cond} {`);
        } else if (rule.responsive && (rule.responsive as any).kind === 'container-style') {
          wrappers.push(`@container ${((rule.responsive as any).name)} style(${(rule.responsive as any).condition.replace(/^\(|\)$/g, '')}) {`);
        } else if (rule.responsive && (rule.responsive as any).kind === 'supports') {
          wrappers.push(`@supports ${(rule.responsive as any).condition} {`);
        }

        for (const w of wrappers) out.push(`${scopeIndent}${w}`);
        const innerIndent = scopeIndent + (wrappers.length ? '  ' : '');

        if (!rule.selectorCss) continue;
        out.push(`${innerIndent}${rule.selectorCss} {`);
        for (const p of rule.props) {
          out.push(`${innerIndent}  ${toKebab(p.name)}: ${resolveValue(p.value)};`);
        }
        out.push(`${innerIndent}}`);
        // Only add blank line if not in scope (blank lines between scope blocks are added later)
        if (!hasScope) out.push('');
        for (let i = wrappers.length - 1; i >= 0; i--) {
          out.push(`${scopeIndent}}`);
          if (!hasScope) out.push('');
        }
      }

      if (hasScope) {
        out.push(`${indent}}`);
        out.push('');
      }
    }
  };

  if (byLayer.has(undefined)) emitRules(byLayer.get(undefined)!);

  // Emit declared layers in order, then any extra layers encountered
  const encounteredLayers = [...new Set(rules.map((r: any) => r.layer).filter(Boolean))] as string[];
  const extras = encounteredLayers.filter(l => !declaredLayers.includes(l));
  for (const lname of [...declaredLayers, ...extras]) {
    const list = byLayer.get(lname);
    if (!list || list.length === 0) continue;
    out.push(`@layer ${lname} {`);
    emitRules(list, '');
    out.push('}');
    out.push('');
  }

  // Emit keyframes after rules
  const keyframes: Array<{ name: string; frames: Array<{ offset: string; props: StyleProperty[] }> }> = (tokens as any).__keyframes || [];
  for (const kf of keyframes) {
    out.push(`@keyframes ${kf.name} {`);
    for (const fr of kf.frames) {
      out.push(`  ${fr.offset} {`);
      for (const p of fr.props) {
        out.push(`    ${toKebab(p.name)}: ${resolveValue(p.value)};`);
      }
      out.push('  }');
    }
    out.push('}');
    out.push('');
  }

  // Emit any RAW blocks from the AST in order (simple approach)
  for (const node of ast as any[]) {
    if (node.type === 'Raw' && node.css) {
      out.push(node.css);
      out.push('');
    }
  }

  return out.join('\n');
}

function normalizeTokenName(name: string): string {
  // Replace any non ident-friendly characters with hyphens
  return name.replace(/[^a-zA-Z0-9_-]/g, '-');
}

// Compile from the CSV-backed DB instead of parsing SQL
export function compileDbToCss(db: DbTables): string {
  const out: string[] = [];

  // Emit @import rules first (only CSS imports)
  if (db.imports && db.imports.length) {
    for (const imp of db.imports) {
      if (imp.import_type === 'css') {
        if (imp.media) {
          out.push(`@import url('${imp.path}') ${imp.media};`);
        } else {
          out.push(`@import url('${imp.path}');`);
        }
      }
    }
    if (db.imports.some(i => i.import_type === 'css')) {
      out.push('');
    }
  }

  // Emit tokens
  if (db.tokens && db.tokens.length) {
    out.push(':root {');
    for (const t of db.tokens) {
      out.push(`  ${tokenCssName(t.name)}: ${normalizeValue(t.value)};`);
    }
    out.push('}');
    out.push('');
  }

  // Emit @property rules from DB
  if ((db as any).properties && (db as any).properties.length) {
    for (const prop of (db as any).properties as PropertyRow[]) {
      out.push(`@property ${prop.name} {`);
      if (prop.syntax) out.push(`  syntax: ${resolveValue(prop.syntax)};`);
      if (prop.inherits) out.push(`  inherits: ${prop.inherits};`);
      if (prop.initial_value) out.push(`  initial-value: ${resolveValue(prop.initial_value)};`);
      out.push('}');
      out.push('');
    }
  }

  // Emit font faces from DB
  if ((db as any).font_faces && (db as any).font_faces.length) {
    for (const ff of (db as any).font_faces as FontFaceRow[]) {
      out.push('@font-face {');
      out.push(`  font-family: "${ff.family}";`);
      try {
        const props: Array<{ name: string; value: string }> = JSON.parse(ff.props_json);
        for (const p of props) out.push(`  ${toKebab(p.name)}: ${resolveValue(p.value)};`);
      } catch { /* ignore */ }
      out.push('}');
      out.push('');
    }
  }

  // Emit pages from DB
  if ((db as any).pages && (db as any).pages.length) {
    for (const pg of (db as any).pages) {
      if (pg.pseudo) {
        out.push(`@page ${pg.pseudo} {`);
      } else {
        out.push('@page {');
      }
      try {
        const props: Array<{ name: string; value: string }> = JSON.parse(pg.props_json);
        for (const p of props) out.push(`  ${toKebab(p.name)}: ${resolveValue(p.value)};`);
      } catch { /* ignore */ }
      out.push('}');
      out.push('');
    }
  }

  // Emit counter styles from DB
  if ((db as any).counter_styles && (db as any).counter_styles.length) {
    for (const cs of (db as any).counter_styles as CounterStyleRow[]) {
      out.push(`@counter-style ${cs.name} {`);
      try {
        const props: Array<{ name: string; value: string }> = JSON.parse(cs.props_json);
        for (const p of props) out.push(`  ${toKebab(p.name)}: ${resolveValue(p.value)};`);
      } catch { /* ignore */ }
      out.push('}');
      out.push('');
    }
  }

  // Emit font feature values from DB
  if ((db as any).font_feature_values && (db as any).font_feature_values.length) {
    for (const ffv of (db as any).font_feature_values as FontFeatureValuesRow[]) {
      out.push(`@font-feature-values "${ffv.family}" {`);
      try {
        const features: Array<{ name: string; value: string }> = JSON.parse(ffv.features_json);
        // Group features by block type (swash_, styleset_, etc.)
        const blocks = new Map<string, Array<{ name: string; value: string }>>();
        for (const f of features) {
          const parts = f.name.split('_');
          if (parts.length >= 2) {
            const blockType = parts[0];
            const featureName = parts.slice(1).join('_');
            if (!blocks.has(blockType)) blocks.set(blockType, []);
            blocks.get(blockType)!.push({ name: featureName, value: resolveValue(f.value) });
          }
        }
        for (const [blockType, feats] of blocks) {
          out.push(`  @${blockType} {`);
          for (const feat of feats) {
            out.push(`    ${feat.name}: ${feat.value};`);
          }
          out.push('  }');
        }
      } catch { /* ignore */ }
      out.push('}');
      out.push('');
    }
  }

  // Emit font palette values from DB
  if ((db as any).font_palette_values && (db as any).font_palette_values.length) {
    for (const fpv of (db as any).font_palette_values as FontPaletteValuesRow[]) {
      out.push(`@font-palette-values ${fpv.name} {`);
      try {
        const props: Array<{ name: string; value: string }> = JSON.parse(fpv.props_json);
        for (const p of props) out.push(`  ${toKebab(p.name)}: ${resolveValue(p.value)};`);
      } catch { /* ignore */ }
      out.push('}');
      out.push('');
    }
  }

  // Emit starting styles from DB
  if ((db as any).starting_styles && (db as any).starting_styles.length) {
    out.push('@starting-style {');
    for (const ss of (db as any).starting_styles as StartingStyleRow[]) {
      // Look up selector name from selectors table using selector_id
      const selector = db.selectors.find(s => s.id === ss.selector_id);
      const selName = selector?.name || ss.selector_id;
      const selectorDefs = new Map<string, SelectorDefinition>();
      for (const s of db.selectors) {
        try {
          const def = JSON.parse(s.def_json) as SelectorDefinition | null;
          if (def) selectorDefs.set(s.name, def);
        } catch { /* ignore */ }
      }
      const def = selectorDefs.get(selName);
      const selectorCss = def ? selectorToCss(def, (n) => selectorDefs.get(n)) : `.${selName}`;
      out.push(`  ${selectorCss} {`);
      try {
        const props: Array<{ name: string; value: string }> = JSON.parse(ss.props_json);
        for (const p of props) out.push(`    ${toKebab(p.name)}: ${resolveValue(p.value)};`);
      } catch { /* ignore */ }
      out.push('  }');
    }
    out.push('}');
    out.push('');
  }

  // Build selector map
  const selectorDefs = new Map<string, SelectorDefinition>();
  for (const s of db.selectors) {
    try {
      const def = JSON.parse(s.def_json) as SelectorDefinition | null;
      if (def) selectorDefs.set(s.name, def);
    } catch {
      // ignore malformed; fallback to .name
    }
  }

  // Build rules from style rows
  type Resp = { kind: 'media'; min?: string; max?: string; features?: string[] } | { kind: 'container'; name: string; min?: string; max?: string; axis?: 'inline' } | { kind: 'container-style'; name: string; condition: string } | { kind: 'supports'; condition: string } | undefined;
  type Rule = { selectorCss: string; layer?: string; scopeRoot?: string; scopeLimit?: string; responsive?: Resp; props: Array<{ name: string; value: string }>; };
  const rulesByKey = new Map<string, Rule>();

  const butterMode = process.env.ICBINCSS_BUTTER;

  function respFromRow(r: StyleRow): Resp {
    if (!r.resp_kind) return undefined;
    if (r.resp_kind === 'media') {
      const features = r.condition ? String(r.condition).split(/\s+and\s+/i).filter(Boolean) : undefined;
      const obj: any = { kind: 'media' };
      if (r.resp_min) obj.min = r.resp_min;
      if (r.resp_max) obj.max = r.resp_max;
      if (features && features.length) obj.features = features;
      return obj as any;
    }
    if (r.resp_kind === 'container') {
      const obj: any = { kind: 'container', name: r.container_name || '' };
      if (r.resp_min) obj.min = r.resp_min;
      if (r.resp_max) obj.max = r.resp_max;
      if (r.resp_axis === 'inline') obj.axis = 'inline';
      return obj as any;
    }
    if (r.resp_kind === 'container-style') return { kind: 'container-style', name: r.container_name || '', condition: r.condition || '' } as any;
    if (r.resp_kind === 'supports') return { kind: 'supports', condition: r.condition || '' } as any;
    return undefined;
  }

  function ruleKey(sel: string, layer?: string, scopeRoot?: string, scopeLimit?: string, resp?: Resp): string {
    return `${sel}||${layer || ''}||${scopeRoot || ''}||${scopeLimit || ''}||${resp ? JSON.stringify(resp) : ''}`;
    }

  for (const r of db.styles) {
    // Look up selector name from selectors table using selector_id
    const selector = db.selectors.find(s => s.id === r.selector_id);
    const selName = selector?.name || r.selector_id;
    const def = selectorDefs.get(selName);
    const selectorCss = def ? selectorToCss(def, (n) => selectorDefs.get(n)) : `.${selName}`;
    const layer = r.layer_id || undefined;
    // Look up selector names for scope_root_id and scope_limit_id
    const scopeRootSelector = r.scope_root_id ? db.selectors.find(s => s.id === r.scope_root_id) : undefined;
    const scopeRootName = (scopeRootSelector?.name || r.scope_root_id) as string;
    const scopeRoot = r.scope_root_id ? (selectorDefs.get(scopeRootName) ? selectorToCss(selectorDefs.get(scopeRootName)!, (n) => selectorDefs.get(n)) : `.${scopeRootName}`) : undefined;
    const scopeLimitSelector = r.scope_limit_id ? db.selectors.find(s => s.id === r.scope_limit_id) : undefined;
    const scopeLimitName = (scopeLimitSelector?.name || r.scope_limit_id) as string;
    const scopeLimit = r.scope_limit_id ? (selectorDefs.get(scopeLimitName) ? selectorToCss(selectorDefs.get(scopeLimitName)!, (n) => selectorDefs.get(n)) : `.${scopeLimitName}`) : undefined;
    const resp = respFromRow(r);
    const key = ruleKey(selectorCss, layer, scopeRoot, scopeLimit, resp);
    let rule = rulesByKey.get(key);
    if (!rule) {
      rule = { selectorCss, layer, scopeRoot, scopeLimit, responsive: resp, props: [] };
      if (r.supports_condition && String(r.supports_condition).trim()) (rule as any).supports = r.supports_condition as any;
      rulesByKey.set(key, rule);
    } else {
      if (r.supports_condition && String(r.supports_condition).trim()) (rule as any).supports = r.supports_condition as any;
    }
    // last write wins for the same property within a bucket
    const v = resolveButterIfNeeded(normalizeValue(r.value), r.prop, butterMode);
    const idx = rule.props.findIndex(p => p.name === r.prop);
    const np = { name: r.prop, value: v };
    if (idx >= 0) rule.props[idx] = np; else rule.props.push(np);
  }

  const rules = Array.from(rulesByKey.values());

  // Group by layer
  const byLayer = new Map<string | undefined, Rule[]>();
  for (const r of rules) {
    const arr = byLayer.get(r.layer) ?? [];
    arr.push(r);
    byLayer.set(r.layer, arr);
  }

  // Emit helpers mirroring compileToCss
  const emitRules = (list: Rule[], indent = '') => {
    // Group by scope first
    const byScope = new Map<string, Rule[]>();
    for (const rule of list) {
      const scopeKey = `${rule.scopeRoot || ''}||${rule.scopeLimit || ''}`;
      const arr = byScope.get(scopeKey) ?? [];
      arr.push(rule);
      byScope.set(scopeKey, arr);
    }

    for (const [scopeKey, scopedRules] of byScope) {
      const [scopeRoot, scopeLimit] = scopeKey.split('||');
      const hasScope = scopeRoot || scopeLimit;

      if (hasScope) {
        // Emit @scope wrapper
        let scopeLine = `@scope (${scopeRoot})`;
        if (scopeLimit) scopeLine += ` to (${scopeLimit})`;
        scopeLine += ' {';
        out.push(`${indent}${scopeLine}`);
      }

      const scopeIndent = hasScope ? indent + '  ' : indent;

      for (const rule of scopedRules) {
        const wrappers: string[] = [];
        if ((rule as any).supports) {
          wrappers.push(`@supports ${(rule as any).supports} {`);
        }
        if (rule.responsive && rule.responsive.kind === 'media') {
          const parts: string[] = [];
          if (rule.responsive.min && (rule.responsive.min as string).toUpperCase() !== 'INF') parts.push(`(min-width: ${rule.responsive.min})`);
          if (rule.responsive.max && (rule.responsive.max as string).toUpperCase() !== 'INF') parts.push(`(max-width: ${rule.responsive.max})`);
          if ((rule.responsive as any).features && (rule.responsive as any).features.length) parts.push(...(rule.responsive as any).features);
          if (parts.length) wrappers.push(`@media ${parts.join(' and ')} {`);
        } else if (rule.responsive && rule.responsive.kind === 'container') {
          const cparts: string[] = [];
          const axis = (rule.responsive as any).axis === 'inline' ? 'inline-size' : 'width';
          if (rule.responsive.min && (rule.responsive.min as string).toUpperCase() !== 'INF') cparts.push(`(min-${axis}: ${rule.responsive.min})`);
          if (rule.responsive.max && (rule.responsive.max as string).toUpperCase() !== 'INF') cparts.push(`(max-${axis}: ${rule.responsive.max})`);
          const cond = cparts.length ? ' ' + cparts.join(' and ') : '';
          wrappers.push(`@container ${(rule.responsive as any).name}${cond} {`);
        } else if (rule.responsive && (rule.responsive as any).kind === 'container-style') {
          wrappers.push(`@container ${((rule.responsive as any).name)} style(${(rule.responsive as any).condition.replace(/^\(|\)$/g, '')}) {`);
        } else if (rule.responsive && (rule.responsive as any).kind === 'supports') {
          wrappers.push(`@supports ${(rule.responsive as any).condition} {`);
        }

        for (const w of wrappers) out.push(`${scopeIndent}${w}`);
        const innerIndent = scopeIndent + (wrappers.length ? '  ' : '');

        if (!rule.selectorCss) continue;
        out.push(`${innerIndent}${rule.selectorCss} {`);
        for (const p of rule.props) {
          out.push(`${innerIndent}  ${toKebab(p.name)}: ${resolveValue(p.value)};`);
        }
        out.push(`${innerIndent}}`);
        out.push('');
        for (let i = wrappers.length - 1; i >= 0; i--) {
          out.push(`${scopeIndent}}`);
          out.push('');
        }
      }

      if (hasScope) {
        out.push(`${indent}}`);
        out.push('');
      }
    }
  };

  // Emit global rules (no layer)
  if (byLayer.has(undefined)) emitRules(byLayer.get(undefined)!);

  // Determine layer order by order_index asc, then emit
  const orderedLayers = [...db.layers].sort((a, b) => Number(a.order_index) - Number(b.order_index)).map(l => l.name);
  const encountered = [...new Set(rules.map(r => r.layer).filter(Boolean))] as string[];
  const extras = encountered.filter(l => !orderedLayers.includes(l));
  for (const lname of [...orderedLayers, ...extras]) {
    const list = byLayer.get(lname);
    if (!list || list.length === 0) continue;
    out.push(`@layer ${lname} {`);
    emitRules(list, '');
    out.push('}');
    out.push('');
  }

  // Emit keyframes from DB
  if ((db as any).keyframes && (db as any).keyframes.length) {
    for (const kf of (db as any).keyframes as KeyframesRow[]) {
      out.push(`@keyframes ${kf.name} {`);
      try {
        const frames: Array<{ offset: string; props: Array<{ name: string; value: string }> }> = JSON.parse(kf.frames_json);
        for (const fr of frames) {
          out.push(`  ${fr.offset} {`);
          for (const p of fr.props) out.push(`    ${toKebab(p.name)}: ${resolveValue(p.value)};`);
          out.push('  }');
        }
      } catch { /* ignore */ }
      out.push('}');
      out.push('');
    }
  }

  // Emit RAW blocks from DB
  if ((db as any).raw_blocks && (db as any).raw_blocks.length) {
    for (const rb of (db as any).raw_blocks as RawBlockRow[]) {
      if (rb.css) {
        out.push(rb.css);
        out.push('');
      }
    }
  }

  return out.join('\n');
}

export function buildRulesFromDb(db: DbTables): { rules: RulePlan[]; layers: string[] } {
  // Build selector map
  const selectorDefs = new Map<string, SelectorDefinition>();
  for (const s of db.selectors) {
    try {
      const def = JSON.parse(s.def_json) as SelectorDefinition | null;
      if (def) selectorDefs.set(s.name, def);
    } catch { /* ignore */ }
  }

  const butterMode = process.env.ICBINCSS_BUTTER;

  const toResp = (r: StyleRow): RulePlan['responsive'] | undefined => {
    if (!r.resp_kind) return undefined;
    if (r.resp_kind === 'media') {
      const features = r.condition ? String(r.condition).split(/\s+and\s+/i).filter(Boolean) : undefined;
      const obj: any = { kind: 'media' };
      if (r.resp_min) obj.min = r.resp_min;
      if (r.resp_max) obj.max = r.resp_max;
      if (features && features.length) obj.features = features;
      return obj;
    }
    if (r.resp_kind === 'container') {
      const obj: any = { kind: 'container', name: r.container_name || '' };
      if (r.resp_min) obj.min = r.resp_min;
      if (r.resp_max) obj.max = r.resp_max;
      if (r.resp_axis === 'inline') obj.axis = 'inline';
      return obj;
    }
    if (r.resp_kind === 'container-style') return { kind: 'container-style', name: r.container_name || '', condition: r.condition || '' } as any;
    if (r.resp_kind === 'supports') return { kind: 'supports', condition: r.condition || '' } as any;
    return undefined;
  };

  const rulesMap = new Map<string, RulePlan>();
  const keyFor = (selectorCss: string, layer?: string, resp?: RulePlan['responsive']) => `${selectorCss}||${layer || ''}||${resp ? JSON.stringify(resp) : ''}`;

  for (const row of db.styles) {
    // Look up selector name from selectors table using selector_id
    const selector = db.selectors.find(s => s.id === row.selector_id);
    const selName = selector?.name || row.selector_id;
    const def = selectorDefs.get(selName);
    const selectorCss = def ? selectorToCss(def, (n) => selectorDefs.get(n)) : `.${selName}`;
    const layer = row.layer_id || undefined;
    const resp = toResp(row);
    const key = keyFor(selectorCss, layer, resp);
    let target = rulesMap.get(key);
    if (!target) {
      target = { key: selName, selectorCss, props: [], layer, responsive: resp } as RulePlan;
      rulesMap.set(key, target);
    }
    if (row.supports_condition && String(row.supports_condition).trim()) {
      (target as any).supports = row.supports_condition as any;
    }
    const v = resolveButterIfNeeded(normalizeValue(row.value), row.prop, butterMode);
    const idx = target.props.findIndex(p => p.name === row.prop);
    const np = { name: row.prop, value: v } as any;
    if (idx >= 0) target.props[idx] = np; else target.props.push(np);
  }

  const rules = Array.from(rulesMap.values());
  const layers = [...db.layers].sort((a, b) => Number(a.order_index) - Number(b.order_index)).map(l => l.name);
  return { rules, layers };
}
