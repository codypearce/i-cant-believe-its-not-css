import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('DELETE and DROP', () => {
  it('deletes a property from the latest rule', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card (",
      "  background = #fff,",
      "  box_shadow = 0 1px 2px",
      ") ;",
      "DELETE FROM style_props WHERE selector = card AND prop = 'box_shadow';",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.card {',
      '  background: #fff;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('drops a style selector', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card (",
      "  color = red",
      ") ;",
      "DROP STYLE SELECTOR card;",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toBe('');
  });
});

