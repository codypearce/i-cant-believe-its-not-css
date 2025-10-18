import { parseICBINCSS } from '../src/parser/index';

describe('Pseudo-selector validation', () => {
  describe('Valid pseudo-selectors', () => {
    it('accepts simple pseudo-classes like hover and focus', () => {
      const sql = "CREATE SELECTOR btn AS P('hover');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :is() with single selector', () => {
      const sql = "CREATE SELECTOR el AS P('is(button)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :is() with multiple selectors', () => {
      const sql = "CREATE SELECTOR el AS P('is(button, .foo, [disabled])');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :where() with selectors', () => {
      const sql = "CREATE SELECTOR el AS P('where(.active, .hover)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :not() with single selector', () => {
      const sql = "CREATE SELECTOR el AS P('not(.disabled)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :not() with multiple selectors', () => {
      const sql = "CREATE SELECTOR el AS P('not(button, input, select)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :has() with relative selector', () => {
      const sql = "CREATE SELECTOR parent AS P('has(> .child)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :has() with descendant selector', () => {
      const sql = "CREATE SELECTOR parent AS P('has(.descendant)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :has() with sibling combinator', () => {
      const sql = "CREATE SELECTOR el AS P('has(+ .next)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-child() with odd', () => {
      const sql = "CREATE SELECTOR row AS P('nth-child(odd)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-child() with even', () => {
      const sql = "CREATE SELECTOR row AS P('nth-child(even)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-child() with number', () => {
      const sql = "CREATE SELECTOR row AS P('nth-child(3)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-child() with 2n+1 pattern', () => {
      const sql = "CREATE SELECTOR row AS P('nth-child(2n+1)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-child() with -n+3 pattern', () => {
      const sql = "CREATE SELECTOR row AS P('nth-child(-n+3)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-child() with n pattern', () => {
      const sql = "CREATE SELECTOR row AS P('nth-child(n)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-child() with 2n pattern', () => {
      const sql = "CREATE SELECTOR row AS P('nth-child(2n)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-child() with "of" selector syntax', () => {
      const sql = "CREATE SELECTOR row AS P('nth-child(2n+1 of .active)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-of-type() with pattern', () => {
      const sql = "CREATE SELECTOR para AS P('nth-of-type(3n)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-last-child() with pattern', () => {
      const sql = "CREATE SELECTOR row AS P('nth-last-child(2)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts :nth-last-of-type() with pattern', () => {
      const sql = "CREATE SELECTOR item AS P('nth-last-of-type(odd)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts unknown pseudo-selectors without validation', () => {
      const sql = "CREATE SELECTOR el AS P('custom-vendor-pseudo(foo)');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts nested selectors in :is()', () => {
      const sql = "CREATE SELECTOR el AS P('is(.foo > .bar, button[disabled])');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('accepts attribute selectors in :not()', () => {
      const sql = "CREATE SELECTOR el AS P('not([data-hidden])');";
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });
  });

  describe('Invalid pseudo-selectors', () => {
    it('rejects :is() with empty arguments', () => {
      const sql = "CREATE SELECTOR el AS P('is()');";
      expect(() => parseICBINCSS(sql)).toThrow(/requires at least one selector/i);
    });

    it('rejects :is() with only whitespace', () => {
      const sql = "CREATE SELECTOR el AS P('is(  )');";
      expect(() => parseICBINCSS(sql)).toThrow(/requires at least one selector/i);
    });

    it('rejects :is() with pseudo-element ::before', () => {
      const sql = "CREATE SELECTOR el AS P('is(::before)');";
      expect(() => parseICBINCSS(sql)).toThrow(/cannot contain pseudo-elements/i);
    });

    it('rejects :is() with pseudo-element ::after', () => {
      const sql = "CREATE SELECTOR el AS P('is(button, ::after)');";
      expect(() => parseICBINCSS(sql)).toThrow(/cannot contain pseudo-elements/i);
    });

    it('rejects :where() with pseudo-element', () => {
      const sql = "CREATE SELECTOR el AS P('where(::first-line)');";
      expect(() => parseICBINCSS(sql)).toThrow(/cannot contain pseudo-elements/i);
    });

    it('rejects :not() with pseudo-element', () => {
      const sql = "CREATE SELECTOR el AS P('not(::marker)');";
      expect(() => parseICBINCSS(sql)).toThrow(/cannot contain pseudo-elements/i);
    });

    it('rejects :not() with empty arguments', () => {
      const sql = "CREATE SELECTOR el AS P('not()');";
      expect(() => parseICBINCSS(sql)).toThrow(/requires at least one selector/i);
    });

    it('rejects :has() with empty arguments', () => {
      const sql = "CREATE SELECTOR el AS P('has()');";
      expect(() => parseICBINCSS(sql)).toThrow(/requires at least one selector/i);
    });

    it('rejects selector starting with number', () => {
      const sql = "CREATE SELECTOR el AS P('is(9foo)');";
      expect(() => parseICBINCSS(sql)).toThrow(/cannot start with a number/i);
    });

    it('rejects :is() with unmatched brackets', () => {
      const sql = "CREATE SELECTOR el AS P('is([disabled)');";
      expect(() => parseICBINCSS(sql)).toThrow(/unmatched.*bracket/i);
    });

    it('rejects :is() with unmatched parentheses in nested selector', () => {
      const sql = "CREATE SELECTOR el AS P('is(:not(foo)');";
      expect(() => parseICBINCSS(sql)).toThrow(/unmatched.*paren/i);
    });

    it('rejects :nth-child() with invalid pattern', () => {
      const sql = "CREATE SELECTOR el AS P('nth-child(foo)');";
      expect(() => parseICBINCSS(sql)).toThrow(/invalid pattern/i);
    });

    it('rejects :nth-child() with malformed an+b', () => {
      const sql = "CREATE SELECTOR el AS P('nth-child(2n++1)');";
      expect(() => parseICBINCSS(sql)).toThrow(/invalid pattern/i);
    });

    it('rejects :nth-child() with invalid "of" selector', () => {
      const sql = "CREATE SELECTOR el AS P('nth-child(2n of [broken)');";
      expect(() => parseICBINCSS(sql)).toThrow(/unmatched.*bracket/i);
    });

    it('rejects :has() with invalid relative selector', () => {
      const sql = "CREATE SELECTOR el AS P('has(>>)');";
      expect(() => parseICBINCSS(sql)).toThrow(/invalid.*selector/i);
    });

    it('rejects double combinator sequences', () => {
      const sql = "CREATE SELECTOR el AS P('is(.foo >> .bar)');";
      expect(() => parseICBINCSS(sql)).toThrow(/invalid combinator/i);
    });
  });

  describe('Integration with complex selectors', () => {
    it('validates pseudo-selectors in AND composition', () => {
      const sql = [
        "CREATE SELECTOR el AS C('btn');",
        "CREATE SELECTOR hover AS P('hover');",
        "CREATE SELECTOR combo AS AND(el, hover);",
      ].join('\n');
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('validates complex pseudo-selector in AND composition', () => {
      const sql = [
        "CREATE SELECTOR btn AS C('btn');",
        "CREATE SELECTOR state AS P('is(:hover, :focus)');",
        "CREATE SELECTOR combo AS AND(btn, state);",
      ].join('\n');
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('rejects invalid pseudo-selector in complex composition', () => {
      const sql = [
        "CREATE SELECTOR btn AS C('btn');",
        "CREATE SELECTOR invalid AS P('is(::before)');",
      ].join('\n');
      expect(() => parseICBINCSS(sql)).toThrow(/cannot contain pseudo-elements/i);
    });

    it('validates :nth-child in real selector definitions', () => {
      const sql = [
        "CREATE SELECTOR odd_rows AS P('nth-child(odd)');",
        "CREATE STYLE SELECTOR odd_rows ( background = #f0f0f0 );",
      ].join('\n');
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });

    it('validates :has() in parent selector pattern', () => {
      const sql = [
        "CREATE SELECTOR parent_with_child AS P('has(> .child)');",
        "CREATE STYLE SELECTOR parent_with_child ( border = 1px solid blue );",
      ].join('\n');
      expect(() => parseICBINCSS(sql)).not.toThrow();
    });
  });
});
