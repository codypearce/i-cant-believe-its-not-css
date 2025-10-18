import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Container WHERE composition', () => {
  it('combines container min and max with AND', () => {
    const sql = [
      "CREATE SELECTOR sidebar AS C('sidebar');",
      "CREATE STYLE SELECTOR sidebar ( width = 100% );",
      "ALTER STYLE SELECTOR sidebar WHERE container aside > 600px AND container aside < 900px SET width = 50%;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.sidebar {',
      '  width: 100%;',
      '}',
      '',
      '@container aside (min-width: 600px) and (max-width: 900px) {',
      '  .sidebar {',
      '    width: 50%;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

