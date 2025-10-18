import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Attribute selector operators and flags', () => {
  it('presence and equals', () => {
    const sql = [
      "CREATE SELECTOR a1 AS ATTR('data-role');",
      "CREATE SELECTOR a2 AS ATTR('data-role', 'admin');",
      "CREATE STYLE SELECTOR a1 ( margin = 0 );",
      "CREATE STYLE SELECTOR a2 ( margin = 0 );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      "[data-role] {",
      "  margin: 0;",
      "}",
      "",
      "[data-role=\"admin\"] {",
      "  margin: 0;",
      "}",
      "",
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('operators ^= and $= with flags', () => {
    const sql = [
      "CREATE SELECTOR starts AS ATTR('data-id', 'user-', '^=');",
      "CREATE SELECTOR ends   AS ATTR('data-kind', 'Type', '$=', 'i');",
      "CREATE STYLE SELECTOR starts ( color = red );",
      "CREATE STYLE SELECTOR ends ( color = blue );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      "[data-id^=\"user-\"] {",
      "  color: red;",
      "}",
      "",
      "[data-kind$=\"Type\" i] {",
      "  color: blue;",
      "}",
      "",
    ].join('\n');
    expect(css).toBe(expected);
  });
});
