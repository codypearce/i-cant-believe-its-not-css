import { parseICBINCSS } from '../src/parser/index';

describe('Introspection SQL parse', () => {
  it('parses SELECT style_props with WHERE', () => {
    const q = "SELECT style_props WHERE selector = card AND width >= 768px;";
    const ast = parseICBINCSS(q) as any[];
    expect(ast[0].type).toBe('SelectStyleProps');
    expect(ast[0].selector).toBe('card');
    expect(ast[0].responsive).toBeTruthy();
  });

  it('parses DESCRIBE SELECTOR', () => {
    const q = 'DESCRIBE SELECTOR btn;';
    const ast = parseICBINCSS(q) as any[];
    expect(ast[0].type).toBe('DescribeSelector');
    expect(ast[0].name).toBe('btn');
  });
});

