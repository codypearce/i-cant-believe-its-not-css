import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('WHERE composition (AND/OR)', () => {
  it('AND composition merges conditions into one @media', () => {
    const sql = [
      "CREATE SELECTOR btn AS AND(E('button'), C('primary'));",
      "CREATE STYLE SELECTOR btn ( color = #111 );",
      "ALTER STYLE SELECTOR btn WHERE width >= 768px AND prefers_color_scheme = dark SET color = #eee;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      'button.primary {',
      '  color: #111;',
      '}',
      '',
      '@media (min-width: 768px) and (prefers-color-scheme: dark) {',
      '  button.primary {',
      '    color: #eee;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('OR composition emits multiple @media alternatives', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card ( padding = 24px );",
      "ALTER STYLE SELECTOR card WHERE (width <= 600px) OR (orientation = landscape) SET padding = 12px;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.card {',
      '  padding: 24px;',
      '}',
      '',
      '@media (max-width: 600px) {',
      '  .card {',
      '    padding: 12px;',
      '  }',
      '',
      '}',
      '',
      '@media (orientation: landscape) {',
      '  .card {',
      '    padding: 12px;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

