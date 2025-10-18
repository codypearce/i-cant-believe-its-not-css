import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('CSS @property', () => {
  it('emits @property with syntax, inherits, and initial-value', () => {
    const sql = [
      "CREATE PROPERTY '--primary-color' (",
      "  syntax = '<color>',",
      "  inherits = true,",
      "  initial_value = #3b82f6",
      ");",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '@property --primary-color {',
      "  syntax: '<color>';",
      '  inherits: true;',
      '  initial-value: #3b82f6;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('emits @property with length syntax', () => {
    const sql = [
      "CREATE PROPERTY '--spacing-unit' (",
      "  syntax = '<length>',",
      "  inherits = false,",
      "  initial_value = 8px",
      ");",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '@property --spacing-unit {',
      "  syntax: '<length>';",
      '  inherits: false;',
      '  initial-value: 8px;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('emits multiple @property rules', () => {
    const sql = [
      "CREATE PROPERTY '--color-primary' (",
      "  syntax = '<color>',",
      "  inherits = true,",
      "  initial_value = #000",
      ");",
      "CREATE PROPERTY '--size-base' (",
      "  syntax = '<length>',",
      "  inherits = false,",
      "  initial_value = 16px",
      ");",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@property --color-primary');
    expect(css).toContain('@property --size-base');
    expect(css).toContain("syntax: '<color>'");
    expect(css).toContain("syntax: '<length>'");
  });

  it('can use custom properties in styles', () => {
    const sql = [
      "CREATE PROPERTY '--theme-color' (",
      "  syntax = '<color>',",
      "  inherits = true,",
      "  initial_value = blue",
      ") ;",
      "CREATE SELECTOR button AS C('button');",
      "CREATE STYLE SELECTOR button ( background = blue ) ;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@property --theme-color');
    expect(css).toContain('button');
  });
});
