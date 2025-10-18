import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Extended media features in WHERE', () => {
  it('prefers-reduced-motion', () => {
    const sql = [
      "CREATE SELECTOR x AS C('x');",
      "CREATE STYLE SELECTOR x ( color = #000 );",
      "ALTER STYLE SELECTOR x WHERE prefers_reduced_motion = reduce SET color = #111;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.x {',
      '  color: #000;',
      '}',
      '',
      '@media (prefers-reduced-motion: reduce) {',
      '  .x {',
      '    color: #111;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('color-gamut', () => {
    const sql = [
      "CREATE SELECTOR x AS C('x');",
      "CREATE STYLE SELECTOR x ( color = #000 );",
      "ALTER STYLE SELECTOR x WHERE color_gamut = p3 SET color = #222;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.x {',
      '  color: #000;',
      '}',
      '',
      '@media (color-gamut: p3) {',
      '  .x {',
      '    color: #222;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('forced-colors', () => {
    const sql = [
      "CREATE SELECTOR x AS C('x');",
      "CREATE STYLE SELECTOR x ( color = #000 );",
      "ALTER STYLE SELECTOR x WHERE forced_colors = active SET color = #333;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.x {',
      '  color: #000;',
      '}',
      '',
      '@media (forced-colors: active) {',
      '  .x {',
      '    color: #333;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('pointer and hover', () => {
    const sql = [
      "CREATE SELECTOR x AS C('x');",
      "CREATE STYLE SELECTOR x ( color = #000 );",
      "ALTER STYLE SELECTOR x WHERE pointer = coarse AND hover = none SET color = #444;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.x {',
      '  color: #000;',
      '}',
      '',
      '@media (pointer: coarse) and (hover: none) {',
      '  .x {',
      '    color: #444;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('resolution', () => {
    const sql = [
      "CREATE SELECTOR x AS C('x');",
      "CREATE STYLE SELECTOR x ( color = #000 );",
      "ALTER STYLE SELECTOR x WHERE resolution = 2dppx SET color = #555;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.x {',
      '  color: #000;',
      '}',
      '',
      '@media (resolution: 2dppx) {',
      '  .x {',
      '    color: #555;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

