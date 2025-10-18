import path from 'path';
import fs from 'fs-extra';
import type { Plugin, ViteDevServer } from 'vite';
import { compileDbToCss } from '../compiler/index.js';
import { ensureDb, loadDb } from '../db/store.js';
import { rebuildDbFromFiles } from '../migrate/engine.js';

type ViteIcbincOptions = {
  outFile?: string; // build output fileName, default 'assets/not.css'
};

const VIRTUAL_ID = 'virtual:icbincss.css';
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID;

function loadConfig(root: string): any {
  try {
    const p = path.join(root, 'icbincss.config.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch { /* ignore */ }
  return {};
}

export default function icbincssPlugin(opts: ViteIcbincOptions = {}): Plugin {
  let root = process.cwd();
  let cfg: any = {};
  let cssCache = '';

  function rebuild(server?: ViteDevServer) {
    try {
      // Apply env-affecting options for compiler on rebuild
      if (cfg?.tokenVarPrefix) process.env.ICBINCSS_TOKEN_PREFIX = String(cfg.tokenVarPrefix);
      if (cfg?.defaultLayers && cfg.defaultLayers.length) process.env.ICBINCSS_DEFAULT_LAYERS = cfg.defaultLayers.join(',');
      // Rebuild DB from source files (catalog + migrations history), then compile from DB
      rebuildDbFromFiles(root);
      ensureDb(root);
      const db = loadDb(root);
      cssCache = compileDbToCss(db as any);
      if (server) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[icbincss] build failed:', (e as any)?.message || e);
    }
  }

  return {
    name: 'icbincss',
    enforce: 'pre',
    configResolved(vcfg: any) {
      root = vcfg.root || process.cwd();
      cfg = loadConfig(root);
    },
    resolveId(id: string) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
      return null;
    },
    load(id: string) {
      if (id === RESOLVED_VIRTUAL_ID) {
        if (!cssCache) rebuild();
        return cssCache; // Vite will treat .css virtual id content as CSS
      }
      return null;
    },
    configureServer(server: ViteDevServer) {
      rebuild(server);
    },
    async handleHotUpdate(ctx: any) {
      // Rebuild CSS on changes to source files, but NOT the generated db/ folder (avoids infinite loop)
      if (!ctx.file.includes('icbincss/')) return;
      if (ctx.file.includes('icbincss/db/')) return; // Skip generated CSV files
      rebuild(ctx.server);
      const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);
      if (mod) return [mod];
    },
    generateBundle() {
      // Rebuild and emit CSS asset
      rebuild();
      const fileName = opts.outFile || cfg?.outFile || 'assets/icbincss.css';
      this.emitFile({ type: 'asset', name: 'icbincss', fileName, source: cssCache });
    },
  };
}
