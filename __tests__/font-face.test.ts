import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Font Face', () => {
  it('emits @font-face with family and props', () => {
    const sql = [
      "CREATE FONT_FACE family 'Inter' (",
      "  src = url(/inter.woff2) format('woff2'),",
      "  font_weight = 400",
      ") ;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '@font-face {',
      '  font-family: "Inter";',
      '  src: url(/inter.woff2) format(\'woff2\');',
      '  font-weight: 400;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

