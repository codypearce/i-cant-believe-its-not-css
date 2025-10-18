import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Responsive & Container Queries', () => {
  it('emits @media with min and INF max', () => {
    const sql = [
      "CREATE SELECTOR btn AS AND(E('button'), C('primary'));",
      "CREATE STYLE SELECTOR btn ( color = #111 );",
      "ALTER STYLE SELECTOR btn WHERE width BETWEEN 768px AND INF SET color = #333;",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      'button.primary {',
      '  color: #111;',
      '}',
      '',
      '@media (min-width: 768px) {',
      '  button.primary {',
      '    color: #333;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('emits @container with name and min-width', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card ( padding = 12px );",
      "ALTER STYLE SELECTOR card WHERE container main > 600px SET padding = 24px;",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.card {',
      '  padding: 12px;',
      '}',
      '',
      '@container main (min-width: 600px) {',
      '  .card {',
      '    padding: 24px;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

