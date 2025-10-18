import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Container inline-size queries', () => {
  it('min-inline-size and max-inline-size', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card ( padding = 16px );",
      "ALTER STYLE SELECTOR card WHERE container main inline > 600px SET padding = 24px;",
      "ALTER STYLE SELECTOR card WHERE container main inline < 900px SET padding = 20px;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.card {',
      '  padding: 16px;',
      '}',
      '',
      '@container main (min-inline-size: 600px) {',
      '  .card {',
      '    padding: 24px;',
      '  }',
      '',
      '}',
      '',
      '@container main (max-inline-size: 900px) {',
      '  .card {',
      '    padding: 20px;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

