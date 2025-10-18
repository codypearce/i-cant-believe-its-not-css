import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Container style queries', () => {
  it('wraps rules in @container <name> style(<cond>)', () => {
    const sql = [
      "CREATE SELECTOR btn AS C('btn');",
      "CREATE STYLE SELECTOR btn ( color = #000 );",
      "ALTER STYLE SELECTOR btn WHERE container theme style(display: grid) SET color = #fff;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.btn {',
      '  color: #000;',
      '}',
      '',
      '@container theme style(display: grid) {',
      '  .btn {',
      '    color: #fff;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

