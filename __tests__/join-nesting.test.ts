import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('JOIN nesting', () => {
  it('nested AND inside CHILD composes correctly', () => {
    const sql = [
      "CREATE SELECTOR a AS C('alpha');",
      "CREATE SELECTOR b AS C('beta');",
      "CREATE SELECTOR ab AS AND(a, b);",
      "CREATE SELECTOR final AS CHILD(ab, P('first-child'));",
      "CREATE STYLE SELECTOR final ( margin = 0 );",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.alpha.beta > :first-child {',
      '  margin: 0;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

