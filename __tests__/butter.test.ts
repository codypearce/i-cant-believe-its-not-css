import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Butter mode', () => {
  it('replaces BUTTER() with a deterministic spacing value', () => {
    const sql = [
      "SET BUTTER = 'thick_smear';",
      "CREATE SELECTOR card AS C('card');",
      "CREATE STYLE SELECTOR card ( margin = BUTTER() );",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.card {',
      '  margin: 24px;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('uses the latest butter mode for subsequent properties', () => {
    const sql = [
      "SET BUTTER = 'medium_spread';",
      "CREATE SELECTOR pane AS C('pane');",
      "CREATE STYLE SELECTOR pane ( padding = BUTTER() );",
      "SET BUTTER = 'thin_spread';",
      "ALTER STYLE SELECTOR pane SET margin = BUTTER();",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.pane {',
      '  padding: 12px;',
      '  margin: 4px;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

