import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('DROP/DELETE parity', () => {
  it('DROP TOKEN and DELETE FROM tokens remove tokens', () => {
    const sql = [
      "INSERT INTO tokens (name, value) VALUES ('brand/500', #2266ee);",
      "DROP TOKEN 'brand/500';",
      "INSERT INTO tokens (name, value) VALUES ('brand/500', #000);",
      "DELETE FROM tokens WHERE name = 'brand/500';",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toBe('');
  });

  it('DROP KEYFRAMES and DROP FONT_FACE remove emitted blocks', () => {
    const sql = [
      "CREATE KEYFRAMES fade ( '0%' ( opacity = 0 ), '100%' ( opacity = 1 ) );",
      "DROP KEYFRAMES fade;",
      "CREATE FONT_FACE family 'Inter' ( src = url(/inter.woff2) );",
      "DROP FONT_FACE family 'Inter';",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    expect(css).toBe('');
  });
});

