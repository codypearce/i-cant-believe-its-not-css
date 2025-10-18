import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Pseudo-elements', () => {
  it('supports ::before with element', () => {
    const sql = [
      "CREATE SELECTOR before_btn AS AND(E('button'), PE('before'));",
      "CREATE STYLE SELECTOR before_btn ( content = \"\" );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      'button::before {',
      '  content: "";',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('supports ::after with class', () => {
    const sql = [
      "CREATE SELECTOR after_card AS AND(C('card'), PE('after'));",
      "CREATE STYLE SELECTOR after_card ( display = block );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.card::after {',
      '  display: block;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

