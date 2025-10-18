# ICBINCSS + Vite Basic Example

For full usage (DSL, DB integration, doctor/verify), consult the project README. This example keeps only the minimal steps to run dev/build.

Minimal Vite app that uses I Can’t Believe It’s Not CSS to style via SQL.

## Quickstart

1. From the repo root, build the local package (needed for the example to consume it):

```
npm run build
```

2. Install deps in this example:

```
npm i
```

3. Dev with HMR:

```
npm run dev
```

4. Build:

```
npm run build && npm run preview
```

## Notes

- The Vite plugin reads `icbincss.config.json` for `tokenVarPrefix`, `defaultLayers`, and `outFile`.
- `src/main.ts` imports `virtual:icbincss.css` which is provided by the plugin.
- Edit files under `icbincss/` to see CSS HMR without full reloads.
- Optional: Butter spacing helper — commented in the example migration; enable to experiment with deterministic spacing changes via HMR.
- Inspect overlay tip: press `?` in the browser to toggle a small help overlay with commands and tips.
