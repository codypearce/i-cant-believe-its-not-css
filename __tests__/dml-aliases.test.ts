import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('DML aliases (INSERT/UPDATE)', () => {
  it('INSERT INTO style_props maps to SET', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "INSERT INTO style_props (selector, prop, value) VALUES (card, 'padding', 16px);",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.card {',
      '  padding: 16px;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('UPDATE style_props with WHERE maps to ALTER SET + media', () => {
    const sql = [
      "CREATE SELECTOR grid AS C('grid');",
      "CREATE STYLE SELECTOR grid ( gap = 8px );",
      "UPDATE style_props SET gap = 24px WHERE selector = grid AND width >= 768px;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.grid {',
      '  gap: 8px;',
      '}',
      '',
      '@media (min-width: 768px) {',
      '  .grid {',
      '    gap: 24px;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('INSERT/UPDATE tokens map to CREATE TOKEN', () => {
    const sql = [
      "INSERT INTO tokens (name, value) VALUES ('brand/500', #2266ee);",
      "UPDATE tokens SET value = #000 WHERE name = 'brand/500';",
      "CREATE SELECTOR txt AS C('txt');",
      "CREATE STYLE SELECTOR txt ( color = token('brand/500') );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      ':root {',
      '  --brand-500: #000;',
      '}',
      '',
      '.txt {',
      '  color: var(--brand-500);',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});
