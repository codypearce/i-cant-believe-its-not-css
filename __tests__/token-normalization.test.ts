import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Token variable naming normalization', () => {
  it('normalizes token name with slash to hyphen', () => {
    const sql = [
      "CREATE TOKEN 'brand/500' VALUE #2266ee;",
      "CREATE SELECTOR b AS C('btn');",
      "CREATE STYLE SELECTOR b ( color = token('brand/500') );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      ':root {',
      '  --brand-500: #2266ee;',
      '}',
      '',
      '.btn {',
      '  color: var(--brand-500);',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

