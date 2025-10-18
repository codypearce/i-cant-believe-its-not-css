import path from 'path';
import fs from 'fs-extra';
import type { Configuration, Compiler } from 'webpack';
import { compileDbToCss } from '../compiler/index.js';
import { ensureDb, loadDb } from '../db/store.js';
import { rebuildDbFromFiles } from '../migrate/engine.js';

type NextIcbincOptions = {
  outFile?: string; // default: public/icbincss.css
};

function loadConfig(root: string): any {
  try {
    const p = path.join(root, 'icbincss.config.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
  } catch { /* ignore */ }
  return {};
}

class IcbincWebpackPlugin {
  private outFile: string;
  private root: string;
  private cfg: any;

  constructor(opts: { root: string; outFile?: string }) {
    this.root = opts.root;
    this.cfg = loadConfig(this.root);
    const chosenOut = opts.outFile || this.cfg?.outFile || path.join('public', 'icbincss.css');
    this.outFile = path.isAbsolute(chosenOut)
      ? (chosenOut as string)
      : path.join(this.root, chosenOut);
  }

  apply(compiler: Compiler) {
    const rebuild = () => {
      try {
        // Apply env-affecting options for compiler
        if (this.cfg?.tokenVarPrefix) process.env.ICBINCSS_TOKEN_PREFIX = String(this.cfg.tokenVarPrefix);
        if (this.cfg?.defaultLayers && this.cfg.defaultLayers.length) process.env.ICBINCSS_DEFAULT_LAYERS = this.cfg.defaultLayers.join(',');
        rebuildDbFromFiles(this.root);
        ensureDb(this.root);
        const db = loadDb(this.root);
        const css = compileDbToCss(db as any);
        fs.ensureDirSync(path.dirname(this.outFile));
        fs.writeFileSync(this.outFile, css, 'utf8');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[icbincss][next] build failed:', (e as any)?.message || e);
      }
    };

    compiler.hooks.beforeCompile.tap('ICBINCSS', rebuild);
    compiler.hooks.watchRun.tap('ICBINCSS', rebuild);
  }
}

export function withICBINCSS(nextConfig: any = {}, opts: NextIcbincOptions = {}) {
  return Object.assign({}, nextConfig, {
    webpack(config: Configuration, ctx: any) {
      config.plugins = config.plugins || [];
      const root = ctx?.dir || process.cwd();
      config.plugins.push(new IcbincWebpackPlugin({ root, outFile: opts.outFile }));
      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, ctx);
      }
      return config;
    },
  });
}
