import fs from 'fs-extra';
import path from 'path';

export type IcbincConfigLike = {
  includeGlobs?: string[];
  excludeGlobs?: string[];
};

export function toPosix(p: string) {
  return p.split(path.sep).join('/');
}

export function globToRegExp(glob: string): RegExp {
  // Very small glob implementation: supports **, *, ?; anchors to start/end.
  // Interprets pattern relative to project root; allows optional leading './'.
  let g = toPosix(glob.trim());
  if (g.startsWith('./')) g = g.slice(2);
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const ch = g[i];
    if (ch === '*') {
      const isDouble = g[i + 1] === '*';
      if (isDouble) {
        i++;
        if (g[i + 1] === '/') { i++; re += '(?:.*/)?'; }
        else re += '.*';
      } else {
        re += '[^/]*';
      }
    } else if (ch === '?') {
      re += '[^/]';
    } else {
      if ('\\.[]{}()+-^$|'.includes(ch)) re += '\\' + ch; else re += ch;
    }
  }
  return new RegExp('^(?:\\./)?' + re + '$');
}

function walkSqlFiles(dir: string, out: string[]) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkSqlFiles(p, out);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith('.sql')) out.push(p);
  }
}

export function listSqlFiles(root: string, cfg: IcbincConfigLike): string[] {
  const icbDir = path.join(root, 'icbincss');
  const all: string[] = [];
  walkSqlFiles(icbDir, all);
  const rel = (p: string) => toPosix(path.relative(root, p));

  let files = all;
  if (cfg.includeGlobs && cfg.includeGlobs.length) {
    const regs = cfg.includeGlobs.map(gl => globToRegExp(gl));
    files = files.filter(p => regs.some(r => r.test(rel(p))));
  }
  if (cfg.excludeGlobs && cfg.excludeGlobs.length) {
    const regs = cfg.excludeGlobs.map(gl => globToRegExp(gl));
    files = files.filter(p => !regs.some(r => r.test(rel(p))));
  }

  const tokensP = path.join(icbDir, 'tokens.sql');
  const selectorsP = path.join(icbDir, 'selectors.sql');
  const rest = files.filter(p => p !== tokensP && p !== selectorsP).sort((a, b) => rel(a).localeCompare(rel(b)));
  const out: string[] = [];
  if (files.includes(tokensP)) out.push(tokensP);
  if (files.includes(selectorsP)) out.push(selectorsP);
  out.push(...rest);
  return out;
}

// List SQL files that represent the currently applied state:
// - Always include `icbincss/tokens.sql` and `icbincss/selectors.sql` if present.
// - Include only files under `icbincss/migrations/applied/`.
export function listAppliedSqlFiles(root: string): string[] {
  const icbDir = path.join(root, 'icbincss');
  const tokensP = path.join(icbDir, 'tokens.sql');
  const selectorsP = path.join(icbDir, 'selectors.sql');
  const appliedDir = path.join(icbDir, 'migrations', 'applied');
  const out: string[] = [];
  if (fs.existsSync(tokensP)) out.push(tokensP);
  if (fs.existsSync(selectorsP)) out.push(selectorsP);
  const applied: string[] = [];
  walkSqlFiles(appliedDir, applied);
  applied.sort((a, b) => toPosix(path.relative(root, a)).localeCompare(toPosix(path.relative(root, b))));
  out.push(...applied);
  return out;
}
