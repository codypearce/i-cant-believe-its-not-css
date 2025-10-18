import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Extended WHERE features', () => {
  it('min-only width with >=', () => {
    const sql = [
      "CREATE SELECTOR btn AS AND(E('button'), C('primary'));",
      "CREATE STYLE SELECTOR btn ( color = #111 );",
      "ALTER STYLE SELECTOR btn WHERE width >= 768px SET color = #333;",
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

  it('max-only width with <=', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card ( padding = 24px );",
      "ALTER STYLE SELECTOR card WHERE width <= 600px SET padding = 12px;",
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
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('prefers-color-scheme media feature', () => {
    const sql = [
      "CREATE SELECTOR page AS C('page');",
      "CREATE STYLE SELECTOR page ( color = #000 );",
      "ALTER STYLE SELECTOR page WHERE prefers_color_scheme = dark SET color = #fff;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.page {',
      '  color: #000;',
      '}',
      '',
      '@media (prefers-color-scheme: dark) {',
      '  .page {',
      '    color: #fff;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('orientation media feature', () => {
    const sql = [
      "CREATE SELECTOR hero AS C('hero');",
      "CREATE STYLE SELECTOR hero ( display = block );",
      "ALTER STYLE SELECTOR hero WHERE orientation = landscape SET display = grid;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.hero {',
      '  display: block;',
      '}',
      '',
      '@media (orientation: landscape) {',
      '  .hero {',
      '    display: grid;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('container max condition with <', () => {
    const sql = [
      "CREATE SELECTOR sidebar AS C('sidebar');",
      "CREATE STYLE SELECTOR sidebar ( width = 400px );",
      "ALTER STYLE SELECTOR sidebar WHERE container aside < 800px SET width = 100%;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.sidebar {',
      '  width: 400px;',
      '}',
      '',
      '@container aside (max-width: 800px) {',
      '  .sidebar {',
      '    width: 100%;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

