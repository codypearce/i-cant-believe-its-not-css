import { parseICBINCSS } from "../src/parser/index";
import { compileToCss } from "../src/compiler/index";

describe("ICBINCSS end-to-end", () => {
  it("parses and compiles CREATE/ALTER ADD/SET", () => {
    const sql = [
      "CREATE TOKEN 'brand/500' VALUE #2266ee;",
      "CREATE SELECTOR btn AS AND(E('button'), C('primary'));",
      "CREATE STYLE SELECTOR btn (",
      "  background = token('brand/500'),",
      "  color = #fff",
      ") ;",
      "ALTER STYLE SELECTOR btn ADD border_radius = 12px;",
      "ALTER STYLE SELECTOR btn SET color = #000;",
    ].join("\n");

    const ast = parseICBINCSS(sql);
    const css = compileToCss(ast);
    const expected = [
      ":root {",
      "  --brand-500: #2266ee;",
      "}",
      "",
      "button.primary {",
      "  background: var(--brand-500);",
      "  color: #000;",
      "  border-radius: 12px;",
      "}",
      "",
    ].join("\n");

    expect(css).toBe(expected);
  });
});
