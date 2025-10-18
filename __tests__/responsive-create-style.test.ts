import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Responsive on CREATE STYLE', () => {
  it('CREATE STYLE with WHERE width BETWEEN emits @media', () => {
    const sql = [
      "CREATE SELECTOR grid AS C('grid');",
      "CREATE STYLE SELECTOR grid (",
      "  gap = 8px",
      ") WHERE width BETWEEN 768px AND 1200px;",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '@media (min-width: 768px) and (max-width: 1200px) {',
      '  .grid {',
      '    gap: 8px;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('CREATE STYLE with WHERE container emits @container', () => {
    const sql = [
      "CREATE SELECTOR aside AS C('aside');",
      "CREATE STYLE SELECTOR aside (",
      "  width = 200px",
      ") WHERE container main > 800px;",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '@container main (min-width: 800px) {',
      '  .aside {',
      '    width: 200px;',
      '  }',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

