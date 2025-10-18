import { parseICBINCSS } from '../src/parser/index';

describe('WHERE error cases', () => {
  it('throws when OR composition includes a container condition', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "ALTER STYLE SELECTOR card WHERE (width <= 600px) OR (container main > 600px) SET padding = 12px;",
    ].join('\n');
    expect(() => parseICBINCSS(sql)).toThrow(/OR composition not supported for container WHERE/);
  });

  it('throws when combining multiple containers in AND', () => {
    const sql = [
      "CREATE SELECTOR card AS C('card');",
      "ALTER STYLE SELECTOR card WHERE container main > 600px AND container aside < 800px SET padding = 12px;",
    ].join('\n');
    expect(() => parseICBINCSS(sql)).toThrow(/Cannot combine multiple containers/);
  });
});

