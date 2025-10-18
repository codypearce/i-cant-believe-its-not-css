import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('RAW CSS escape hatch', () => {
  it('emits raw CSS after compiled rules', () => {
    const sql = [
      "CREATE SELECTOR box AS C('box');",
      "CREATE STYLE SELECTOR box ( display = grid );",
      "RAW '/* custom font */\n@font-face { font-family: \"Inter\"; src: url(/inter.woff2) format(\"woff2\"); }';",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.box {',
      '  display: grid;',
      '}',
      '',
      '/* custom font */',
      '@font-face { font-family: "Inter"; src: url(/inter.woff2) format("woff2"); }',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

