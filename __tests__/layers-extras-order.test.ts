import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Layers (extras order)', () => {
  it('emits encountered layers in first-appearance order when not declared', () => {
    const sql = [
      "SET LAYER = base;",
      "CREATE SELECTOR x AS C('x');",
      "CREATE STYLE SELECTOR x ( color = red );",
      "SET LAYER = overrides;",
      "CREATE STYLE SELECTOR x ( color = blue );",
    ].join('\n');

    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '@layer base {',
      '.x {',
      '  color: red;',
      '}',
      '',
      '}',
      '',
      '@layer overrides {',
      '.x {',
      '  color: blue;',
      '}',
      '',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

