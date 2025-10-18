import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('SET vs ADD behavior', () => {
  it('ADD does not overwrite existing property; SET does', () => {
    const sql = [
      "CREATE SELECTOR x AS C('x');",
      "CREATE STYLE SELECTOR x ( color = red );",
      "ALTER STYLE SELECTOR x ADD color = blue;",
      "ALTER STYLE SELECTOR x SET color = green;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.x {',
      '  color: green;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

