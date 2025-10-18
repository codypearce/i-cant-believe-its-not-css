import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('SQL comments', () => {
  it('supports line and block comments anywhere', () => {
    const sql = [
      "-- define selector",
      "CREATE SELECTOR btn AS AND(E('button'), C('primary'));",
      "/* block comment */",
      "CREATE STYLE SELECTOR btn ( color = #111 ); -- end of line comment",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      'button.primary {',
      '  color: #111;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

