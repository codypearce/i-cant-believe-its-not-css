import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('@supports DSL via WHERE supports(...)', () => {
  it('wraps a rule in @supports', () => {
    const sql = [
      "CREATE SELECTOR box AS C('box');",
      "CREATE STYLE SELECTOR box ( display = block );",
      "ALTER STYLE SELECTOR box WHERE supports(display: grid) SET display = grid;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.box {',
      '  display: block;',
      '}',
      '',
      '@supports (display: grid) {',
      '  .box {',
      '    display: grid;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

