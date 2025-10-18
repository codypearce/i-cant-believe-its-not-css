import { parseICBINCSS } from '../src/parser/index';

describe('AST WHERE attachment', () => {
  it('attaches responsive to ALTER width BETWEEN', () => {
    const sql = [
      "CREATE SELECTOR btn AS AND(E('button'), C('primary'));",
      "CREATE STYLE SELECTOR btn ( color = #111 );",
      "ALTER STYLE SELECTOR btn WHERE width BETWEEN 768px AND INF SET color = #333;",
    ].join('\n');
    const ast = parseICBINCSS(sql) as any[];
    // The last node should be AlterStyle with responsive
    const last = ast[ast.length - 1];
    // Debug hint on failure
    if (!last || !last.responsive) {
      // eslint-disable-next-line no-console
      console.log('AST for ALTER width BETWEEN:', JSON.stringify(ast, null, 2));
    }
    expect(last.type).toBe('AlterStyle');
    expect(last.responsive).toBeTruthy();
    expect(last.responsive.type).toBe('WidthBetween');
    expect(last.responsive.min).toBe('768px');
    expect(String(last.responsive.max).toUpperCase()).toBe('INF');
  });

  it('attaches responsive to CREATE STYLE WHERE width BETWEEN', () => {
    const sql = [
      "CREATE SELECTOR grid AS C('grid');",
      "CREATE STYLE SELECTOR grid ( gap = 8px ) WHERE width BETWEEN 768px AND 1200px;",
    ].join('\n');
    const ast = parseICBINCSS(sql) as any[];
    const last = ast[ast.length - 1];
    if (!last || !last.responsive) {
      // eslint-disable-next-line no-console
      console.log('AST for CREATE STYLE WHERE width:', JSON.stringify(ast, null, 2));
    }
    expect(last.type).toBe('Style');
    expect(last.responsive).toBeTruthy();
    expect(last.responsive.type).toBe('WidthBetween');
    expect(last.responsive.min).toBe('768px');
    expect(last.responsive.max).toBe('1200px');
  });

  it('attaches responsive to ALTER container query', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card ( padding = 12px );",
      "ALTER STYLE SELECTOR card WHERE container main > 600px SET padding = 24px;",
    ].join('\n');
    const ast = parseICBINCSS(sql) as any[];
    const last = ast[ast.length - 1];
    if (!last || !last.responsive) {
      // eslint-disable-next-line no-console
      console.log('AST for ALTER container:', JSON.stringify(ast, null, 2));
    }
    expect(last.type).toBe('AlterStyle');
    expect(last.responsive).toBeTruthy();
    expect(last.responsive.type).toBe('Container');
    expect(last.responsive.container).toBe('main');
    expect(last.responsive.min).toBe('600px');
  });
});

