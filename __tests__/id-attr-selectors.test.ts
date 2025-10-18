import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('ID and attribute selectors', () => {
  it('supports ID selector', () => {
    const sql = [
      "CREATE SELECTOR hero AS ID('hero');",
      "CREATE STYLE SELECTOR hero ( color = red );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '#hero {',
      '  color: red;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('supports attribute presence', () => {
    const sql = [
      "CREATE SELECTOR disabled AS ATTR('disabled');",
      "CREATE STYLE SELECTOR disabled ( opacity = 0.5 );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '[disabled] {',
      '  opacity: 0.5;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('supports attribute equality and composition', () => {
    const sql = [
      "CREATE SELECTOR input_email AS AND(E('input'), ATTR('type','email'));",
      "CREATE STYLE SELECTOR input_email ( color = blue );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      'input[type="email"] {',
      '  color: blue;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

