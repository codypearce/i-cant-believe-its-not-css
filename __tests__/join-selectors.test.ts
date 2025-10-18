import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('JOIN selectors and named refs', () => {
  it('JOIN CHILD between named selectors resolves to proper CSS', () => {
    const sql = [
      "CREATE SELECTOR btn AS AND(E('button'), C('primary'));",
      "CREATE SELECTOR icon_first AS AND(E('svg'), P('first-child'));",
      "CREATE SELECTOR btn_icon_left AS JOIN CHILD btn ON icon_first;",
      "CREATE STYLE SELECTOR btn_icon_left ( margin = 0 );",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      'button.primary > svg:first-child {',
      '  margin: 0;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('JOIN AND composes compound selectors', () => {
    const sql = [
      "CREATE SELECTOR a AS C('alpha');",
      "CREATE SELECTOR b AS C('beta');",
      "CREATE SELECTOR ab AS JOIN AND a ON b;",
      "CREATE STYLE SELECTOR ab ( color = red );",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.alpha.beta {',
      '  color: red;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

