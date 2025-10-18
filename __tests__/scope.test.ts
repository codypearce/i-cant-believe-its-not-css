import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('CSS @scope', () => {
  it('emits @scope with simple root selector', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE SELECTOR header AS C('header');",
      "CREATE STYLE SELECTOR header SCOPED TO card (",
      "  color = blue,",
      "  font-size = 20px",
      ");",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '@scope (.card) {',
      '  .header {',
      '    color: blue;',
      '    font-size: 20px;',
      '  }',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('emits @scope with root and limit selectors', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE SELECTOR header AS C('header');",
      "CREATE SELECTOR footer AS C('footer');",
      "CREATE STYLE SELECTOR header SCOPED TO card LIMIT footer (",
      "  color = red,",
      "  padding = 10px",
      ");",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '@scope (.card) to (.footer) {',
      '  .header {',
      '    color: red;',
      '    padding: 10px;',
      '  }',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('emits multiple scoped styles', () => {
    const sql = [
      "CREATE SELECTOR container AS C('container');",
      "CREATE SELECTOR title AS C('title');",
      "CREATE SELECTOR subtitle AS C('subtitle');",
      "CREATE STYLE SELECTOR title SCOPED TO container (",
      "  font-weight = bold",
      ");",
      "CREATE STYLE SELECTOR subtitle SCOPED TO container (",
      "  font-weight = normal",
      ");",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@scope (.container)');
    expect(css).toContain('.title');
    expect(css).toContain('font-weight: bold');
    expect(css).toContain('.subtitle');
    expect(css).toContain('font-weight: normal');
  });

  it('emits scoped styles with responsive queries', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE SELECTOR header AS C('header');",
      "CREATE STYLE SELECTOR header SCOPED TO card (",
      "  color = blue",
      ") WHERE width >= 768px;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toContain('@scope (.card)');
    expect(css).toContain('@media (min-width: 768px)');
    expect(css).toContain('.header');
    expect(css).toContain('color: blue');
  });

  it('can mix scoped and non-scoped styles', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE SELECTOR header AS C('header');",
      "CREATE STYLE SELECTOR header (",
      "  margin = 0",
      ");",
      "CREATE STYLE SELECTOR header SCOPED TO card (",
      "  color = blue",
      ");",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));

    // Should have non-scoped rule
    expect(css).toContain('.header {\n  margin: 0;\n}');

    // Should have scoped rule
    expect(css).toContain('@scope (.card)');
    expect(css).toContain('color: blue');
  });

  it('handles different scope contexts separately', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE SELECTOR sidebar AS C('sidebar');",
      "CREATE SELECTOR header AS C('header');",
      "CREATE STYLE SELECTOR header SCOPED TO card (",
      "  color = blue",
      ");",
      "CREATE STYLE SELECTOR header SCOPED TO sidebar (",
      "  color = green",
      ");",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));

    // Should have two separate @scope blocks
    expect(css).toContain('@scope (.card)');
    expect(css).toContain('color: blue');
    expect(css).toContain('@scope (.sidebar)');
    expect(css).toContain('color: green');
  });
});
