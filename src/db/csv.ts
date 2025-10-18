import fs from 'fs-extra';
import path from 'path';

export function readCsv(file: string): Array<Record<string, string>> {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = cols[j] ?? '';
    rows.push(row);
  }
  return rows;
}

export function writeCsv(file: string, rows: Array<Record<string, any>>, headers: string[]): void {
  const out: string[] = [];
  out.push(headers.join(','));
  for (const r of rows) {
    const vals = headers.map(h => toCsvField(r[h] ?? ''));
    out.push(vals.join(','));
  }
  fs.ensureDirSync(path.dirname(file));
  fs.writeFileSync(file, out.join('\n') + '\n', 'utf8');
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i+1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') { inQ = true; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function toCsvField(val: any): string {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
