import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseICBINCSS } from '../src/parser/index';
import { compileToCss } from '../src/compiler/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function read(file: string) {
  return fs.readFileSync(file, 'utf8');
}

describe('Golden fixtures (.sql -> .css)', () => {
  const normalize = (s: string) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/,'');
  const cases = fs
    .readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => path.basename(f, '.sql'));

  for (const name of cases) {
    it(name, () => {
      const sqlPath = path.join(FIXTURES_DIR, `${name}.sql`);
      const cssPath = path.join(FIXTURES_DIR, `${name}.css`);
      expect(fs.existsSync(cssPath)).toBe(true);
      const sql = read(sqlPath);
      const expected = read(cssPath);
      const ast = parseICBINCSS(sql);
      const actual = compileToCss(ast);
      expect(normalize(actual)).toBe(normalize(expected));
    });
  }
});
