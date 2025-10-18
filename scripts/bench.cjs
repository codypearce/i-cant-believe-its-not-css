#!/usr/bin/env node
// Synthetic performance benchmark for ICBINCSS (parse + compile)
// Usage: node scripts/bench.cjs --n 1000

const { performance } = require('perf_hooks');
const path = require('path');
const { pathToFileURL } = require('url');

function parseArgs(argv) {
  const out = { n: 1000 };
  for (const a of argv.slice(2)) {
    const m = a.match(/^--n=(\d+)$/);
    if (m) out.n = parseInt(m[1], 10);
    else if (a === '--n') {
      // next token
      out.n = parseInt(argv[argv.indexOf(a) + 1], 10) || out.n;
    }
  }
  return out;
}

function makeSql(n) {
  const lines = [];
  lines.push("CREATE TOKEN 'brand/500' VALUE #2266ee;");
  lines.push("SET LAYER = components;");
  lines.push("SET BUTTER = 'medium_spread';");
  for (let i = 0; i < n; i++) {
    const name = `sel_${i}`;
    lines.push(`CREATE SELECTOR ${name} AS C('item_${i}');`);
  }
  for (let i = 0; i < n; i++) {
    const name = `sel_${i}`;
    const base = [
      `CREATE STYLE SELECTOR ${name} (`,
      `  padding = 8px,`,
      `  margin = BUTTER(),`,
      `  color = token('brand/500')`,
      `)`
    ].join('\n');
    lines.push(base);
    if (i % 5 === 0) {
      lines.push(`ALTER STYLE SELECTOR ${name} WHERE width BETWEEN 600px AND INF SET padding = 12px;`);
    }
    if (i % 7 === 0) {
      lines.push(`ALTER STYLE SELECTOR ${name} WHERE container main > 800px SET margin = 16px;`);
    }
  }
  return lines.join('\n');
}

async function main() {
  const { n } = parseArgs(process.argv);
  const sql = makeSql(n);
  const distEntry = pathToFileURL(path.resolve(__dirname, '..', 'dist', 'index.js')).href;
  const mod = await import(distEntry);
  const { parseICBINCSS, compileToCss } = mod;

  const t0 = performance.now();
  const ast = parseICBINCSS(sql);
  const t1 = performance.now();
  const css = compileToCss(ast);
  const t2 = performance.now();

  const parseMs = (t1 - t0).toFixed(1);
  const compileMs = (t2 - t1).toFixed(1);
  const totalMs = (t2 - t0).toFixed(1);

  console.log(`[bench] rules=${n}`);
  console.log(`[bench] sql_len=${sql.length} css_len=${css.length}`);
  console.log(`[bench] parse_ms=${parseMs} compile_ms=${compileMs} total_ms=${totalMs}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

