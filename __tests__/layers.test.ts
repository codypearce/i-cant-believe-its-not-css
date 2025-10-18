import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Layers', () => {
  it('emits rules inside declared @layer blocks in order', () => {
    const sql = [
      "CREATE LAYERS (base, components);",
      "SET LAYER = base;",
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card ( color = red );",
      "SET LAYER = components;",
      "CREATE STYLE SELECTOR card ( color = blue );",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '@layer base {',
      '.card {',
      '  color: red;',
      '}',
      '',
      '}',
      '',
      '@layer components {',
      '.card {',
      '  color: blue;',
      '}',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

