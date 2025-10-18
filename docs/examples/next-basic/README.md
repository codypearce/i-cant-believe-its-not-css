# ICBINCSS + Next.js Basic Example (Pages Router)

Minimal Next.js app that compiles ICBINCSS SQL files to a public CSS file via the provided Webpack plugin.

## Quickstart

1. From the repo root, build the package so the example can consume it:

```
npm run build
```

2. Install deps for this example:

```
cd docs/examples/next-basic
npm i
```

3. Dev:

```
npm run dev
```

4. Build + start:

```
npm run build && npm run start
```

## Notes

- The plugin reads `icbincss.config.json` for `tokenVarPrefix`, `defaultLayers`, and `outFile` (defaults to `public/icbincss.css`).
- The stylesheet is linked in `pages/_document.tsx`.
- Edit files under `icbincss/` during `next dev` to trigger rebuilds; CSS will be re-emitted to `public/icbincss.css`.
