import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Transactions (BEGIN/COMMIT/ROLLBACK)', () => {
  it('BEGIN/COMMIT do not affect output order', () => {
    const sql = [
      "BEGIN;",
      "CREATE SELECTOR box AS C('box');",
      "CREATE STYLE SELECTOR box ( display = grid );",
      "COMMIT;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '.box {',
      '  display: grid;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });

  it('ROLLBACK is a no-op in MVP (no state undo)', () => {
    const sql = [
      "BEGIN;",
      "CREATE SELECTOR btn AS AND(E('button'), C('primary'));",
      "CREATE STYLE SELECTOR btn ( color = red );",
      "ROLLBACK;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    // MVP: still outputs created rules (no undo). Future versions may implement state rewind.
    const expected = [
      'button.primary {',
      '  color: red;',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

