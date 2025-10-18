import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

describe('Keyframes', () => {
  it('emits @keyframes with frames and props', () => {
    const sql = [
      "CREATE KEYFRAMES fade (",
      "  '0%' ( opacity = 0 ),",
      "  '100%' ( opacity = 1 )",
      ") ;",
    ].join('\n');
    const css = compileToCss(parseICBINCSS(sql));
    const expected = [
      '@keyframes fade {',
      '  0% {',
      '    opacity: 0;',
      '  }',
      '  100% {',
      '    opacity: 1;',
      '  }',
      '}',
      ''
    ].join('\n');
    expect(css).toBe(expected);
  });
});

