import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('JOIN variants', () => {
  it('JOIN DESC produces descendant selector', () => {
    const sql = [
      "CREATE SELECTOR a AS C('alpha');",
      "CREATE SELECTOR b AS C('beta');",
      "CREATE SELECTOR ab_desc AS JOIN DESC a ON b;",
      "CREATE STYLE SELECTOR ab_desc ( margin = 0 );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.alpha .beta {',
      '  margin: 0;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('JOIN ADJ produces adjacent sibling', () => {
    const sql = [
      "CREATE SELECTOR h2 AS E('h2');",
      "CREATE SELECTOR p AS E('p');",
      "CREATE SELECTOR heading_adj_para AS JOIN ADJ h2 ON p;",
      "CREATE STYLE SELECTOR heading_adj_para ( margin_top = 0 );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      'h2 + p {',
      '  margin-top: 0;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('JOIN SIB produces general sibling', () => {
    const sql = [
      "CREATE SELECTOR n AS C('note');",
      "CREATE SELECTOR w AS C('warn');",
      "CREATE SELECTOR sib AS JOIN SIB n ON w;",
      "CREATE STYLE SELECTOR sib ( color = orange );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.note ~ .warn {',
      '  color: orange;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

