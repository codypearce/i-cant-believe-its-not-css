<div align="center">
  <img src="docs/logo.png" alt="ICBINCSS Logo" width="400" />

  <h1>🧈 I Can't Believe It's Not CSS</h1>

  <p>Style websites using SQL instead of CSS. Database migrations for your styles.</p>

[![npm](https://img.shields.io/npm/v/i-cant-believe-its-not-css.svg)](https://www.npmjs.com/package/i-cant-believe-its-not-css)
[![node](https://img.shields.io/node/v/i-cant-believe-its-not-css.svg?label=node)](https://www.npmjs.com/package/i-cant-believe-its-not-css)
[![install size](https://packagephobia.com/badge?p=i-cant-believe-its-not-css)](https://packagephobia.com/result?p=i-cant-believe-its-not-css)
[![Follow on X](https://img.shields.io/badge/follow-%40codyapearce-1DA1F2?logo=x&style=flat)](https://x.com/codyapearce)
[![Follow on Bluesky](https://img.shields.io/badge/follow-%40codyapearce-0285FF?logo=bluesky&style=flat&logoColor=white)](https://bsky.app/profile/codyapearce.bsky.social)

</div>

## Features

- 🗄️ **Real database storage** - Postgres or SQLite with full SQL queries
- 🔄 **Migration system** - Up/down migrations with rollback support
- 🎯 **Conflict detection** - Catch specificity issues and shorthand/longhand conflicts
- 🔍 **Query your styles** - `SELECT * FROM styles WHERE resp_kind = 'media'`
- 📊 **Full audit trail** - Migration history with checksums and timestamps
- ✅ **Complete CSS support** - @layer, @container, @supports, @font-face, @keyframes, @property, @scope
- 🚀 **Zero runtime** - Compiles to plain CSS
- 🔧 **Universal** - Works with React, Vue, Angular, vanilla HTML (CommonJS or ESM)

```sql
-- migrations/up/001_init.sql
CREATE TOKEN 'brand/500' VALUE #2266ee;
CREATE SELECTOR btn AS AND(E('button'), C('primary'));
CREATE STYLE SELECTOR btn (
  background = token('brand/500'),
  color = #fff
);
```

```css
/* Output: dist/icbincss.css */
:root {
  --brand-500: #2266ee;
}
button.primary {
  background: var(--brand-500);
  color: #fff;
}
```

**Requirements:** Node.js 18+, Works with any project (React, Vue, vanilla HTML), Supports both CommonJS and ESM

---

## Why?

**Because CSS doesn't have migrations.** You can't roll back styles. You can't query them. You can't detect conflicts before they ship. You just push changes and hope nothing breaks.

**What if styles were data?** You could:

- Version them properly (with migration history and checksums)
- Query them (`SELECT * FROM styles WHERE selector = 'btn'`)
- Analyze them (find unused tokens, detect conflicts, check specificity)
- Roll them back (proper up/down migrations)
- Audit them (who changed what, when, why)

**What if CSS had the tooling backend developers take for granted?** Migrations, schema validation, conflict detection, query languages, database tooling, version control that actually makes sense.

That's what this is. **CSS as a database.** SQL as the interface. Migrations as the workflow.

If you've ever looked at a 10,000 line CSS file and thought "I wish I could just SELECT the problem," this is for you.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Integration](#integration)
- [Database](#database)
- [Analysis & Tools](#analysis--tools)
- [Reference](#reference)
- [Advanced](#advanced)
- [FAQ](#faq)
- [Examples](#examples)

---

## Quick Start

### Installation

```bash
npm install -D i-cant-believe-its-not-css
npx icbincss init
```

This creates an `icbincss/` directory with migrations and database folders.

### Write Your First Styles

Edit `icbincss/migrations/up/001_init.sql`:

```sql
-- Create design tokens
CREATE TOKEN 'brand/500' VALUE #2266ee;
CREATE TOKEN 'space/4' VALUE 16px;

-- Define selectors
CREATE SELECTOR card AS C('card');
CREATE SELECTOR btn AS AND(E('button'), C('primary'));

-- Create styles
CREATE STYLE SELECTOR card (
  background = #fff,
  padding = token('space/4'),
  border_radius = 8px
);

CREATE STYLE SELECTOR btn (
  background = token('brand/500'),
  color = #fff,
  padding = 12px 24px
);

-- Responsive styles
ALTER STYLE SELECTOR card
  WHERE width >= 768px
  SET padding = 24px;
```

### Apply Migration & Build

```bash
npx icbincss migrate up
npx icbincss build
```

This compiles your SQL to `dist/icbincss.css`. Include it in your HTML:

```html
<link rel="stylesheet" href="/dist/icbincss.css" />
```

### Use in Your HTML

```html
<div class="card">
  <button class="primary">Click me</button>
</div>
```

That's it! You're using SQL-generated CSS.

---

## Core Concepts

### How It Works

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Write SQL │ ───> │   CSV DB    │ ───> │ Compile CSS │ ───> │   Browser   │
│  Migration  │      │   Storage   │      │   Output    │      │   Renders   │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
```

1. **Write SQL**: Author styles as `.sql` migration files
2. **Apply Migrations**: Run `migrate up` to update CSV database
3. **Compile**: Build CSS from CSV database (source of truth)
4. **Ship**: Regular CSS file, zero runtime

```
┌──────────────────────────────────────────────────────────────┐
│                        Your Project                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  icbincss/                                                    │
│  ├── migrations/                                              │
│  │   ├── up/*.sql                ← You write SQL here        │
│  │   └── down/*.sql                                           │
│  │                                                            │
│  └── db/                          ← CSV database             │
│      ├── migrations.csv           (source of truth)          │
│      ├── tokens.csv                                           │
│      ├── selectors.csv                                        │
│      ├── layers.csv                                           │
│      └── styles.csv                                           │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                     ICBINCSS Engine                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Parser (Peggy)                                            │
│     SQL text → AST                                            │
│                                                               │
│  2. Migration Engine                                          │
│     AST → CSV writes                                          │
│                                                               │
│  3. Compiler                                                  │
│     CSV → CSS                                                 │
│                                                               │
│  4. Integrations                                              │
│     ├── Vite Plugin (virtual modules + HMR)                  │
│     └── Next.js Plugin (webpack + file watcher)              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Browser     │
                    │ (regular CSS) │
                    └───────────────┘
```

### Tokens

Design tokens compile to CSS custom properties:

```sql
CREATE TOKEN 'brand/500' VALUE #2266ee;
CREATE TOKEN 'space/lg' VALUE 32px;
```

```css
:root {
  --brand-500: #2266ee;
  --space-lg: 32px;
}
```

Reference tokens in styles:

```sql
CREATE STYLE SELECTOR btn (
  background = token('brand/500'),
  padding = token('space/lg')
);
```

```css
button {
  background: var(--brand-500);
  padding: var(--space-lg);
}
```

### Selectors

Define selectors using SQL functions (no CSS syntax):

```sql
-- Basic selectors
CREATE SELECTOR btn AS C('btn');                    -- .btn
CREATE SELECTOR heading AS E('h1');                 -- h1
CREATE SELECTOR user_id AS ID('user');              -- #user

-- Compound selectors
CREATE SELECTOR primary_btn AS AND(E('button'), C('primary'));  -- button.primary

-- Parent-child relationships
CREATE SELECTOR card AS C('card');
CREATE SELECTOR card_header AS CHILD(card, C('header'));        -- .card > .header
CREATE SELECTOR card_text AS DESC(card, C('text'));             -- .card .text

-- Pseudo-classes and pseudo-elements
CREATE SELECTOR btn_hover AS AND(btn, P('hover'));              -- .btn:hover
CREATE SELECTOR btn_before AS AND(btn, PE('before'));           -- .btn::before

-- Attribute selectors
CREATE SELECTOR data_role AS ATTR('data-role', 'admin');        -- [data-role="admin"]
CREATE SELECTOR starts_with AS ATTR('href', 'https', '^=');     -- [href^="https"]
```

### Styles

Create and modify styles:

```sql
-- Create styles for a selector
CREATE STYLE SELECTOR card (
  padding = 16px,
  background = #fff,
  border = 1px solid #ddd
);

-- Add a property (only if not already set)
ALTER STYLE SELECTOR card ADD margin = 8px;

-- Set a property (overwrite if exists)
ALTER STYLE SELECTOR card SET padding = 24px;

-- Responsive styles
ALTER STYLE SELECTOR card
  WHERE width >= 768px
  SET padding = 32px;

-- Container queries
ALTER STYLE SELECTOR card
  WHERE container main > 600px
  SET border_radius = 16px;

-- Supports queries
ALTER STYLE SELECTOR grid
  WHERE supports(display: grid)
  SET display = grid;

-- Delete specific property
DELETE FROM style_props WHERE selector = card AND prop = 'margin';

-- Drop all styles for a selector
DROP STYLE SELECTOR card;
```

### Migrations

Reversible change scripts for styling evolution:

```
icbincss/
├── migrations/
│   ├── up/
│   │   └── 20250118_120000__add_buttons.sql
│   └── down/
│       └── 20250118_120000__add_buttons.sql
└── db/
    ├── migrations.csv    ← Migration history
    ├── tokens.csv        ← Token definitions
    ├── selectors.csv     ← Selector definitions
    └── styles.csv        ← Style rules (source of truth)
```

**Create migration:**

```bash
npx icbincss migrate create --name=add_buttons.sql
```

**UP migration** (`migrations/up/20250118_120000__add_buttons.sql`):

```sql
CREATE TOKEN 'accent/600' VALUE #1a4fd8;

ALTER STYLE SELECTOR btn
  SET background = token('accent/600');
```

**DOWN migration** (`migrations/down/20250118_120000__add_buttons.sql`):

```sql
ALTER STYLE SELECTOR btn
  SET background = token('brand/500');

DROP TOKEN 'accent/600';
```

**Apply:**

```bash
npx icbincss migrate up      # Apply next pending migration
npx icbincss migrate down    # Revert last applied migration
npx icbincss migrate status  # View migration state
```

### Layers (Optional)

Control cascade order with `@layer`:

```sql
-- Define layer order
CREATE LAYERS (reset, base, components, utilities);

-- Set current layer
SET LAYER = components;

CREATE STYLE SELECTOR card (
  padding = 16px
);

-- This style goes in the "components" layer
```

CSS output:

```css
@layer reset, base, components, utilities;

@layer components {
  .card {
    padding: 16px;
  }
}
```

---

## Integration

### CLI

```bash
# Build CSS from database
npx icbincss build

# Watch for changes and rebuild
npx icbincss watch

# Migrations
npx icbincss migrate status
npx icbincss migrate create --name=homepage.sql
npx icbincss migrate up
npx icbincss migrate down

# Analysis
npx icbincss inspect card
npx icbincss doctor
npx icbincss query "SELECT style_props WHERE selector = card;"

# Database
npx icbincss db rebuild
npx icbincss db verify
npx icbincss db export-sql --dialect=postgres
```

### Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { icbincssVitePlugin } from "i-cant-believe-its-not-css";

export default defineConfig({
  plugins: [icbincssVitePlugin()],
});
```

```ts
// src/main.ts
import "virtual:icbincss.css";
```

Edits to `icbincss/**/*.sql` trigger HMR updates in development. In production, CSS is emitted as a static asset.

### Next.js

**ESM (next.config.mjs):**

```js
import { withICBINCSS } from "i-cant-believe-its-not-css";

export default withICBINCSS(
  { reactStrictMode: true },
  { outFile: "public/icbincss.css" }
);
```

**CommonJS (next.config.js):**

```js
const { withICBINCSS } = require("i-cant-believe-its-not-css");

module.exports = withICBINCSS(
  { reactStrictMode: true },
  { outFile: "public/icbincss.css" }
);
```

**Include in layout:**

```tsx
// app/layout.tsx (App Router)
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <link rel="stylesheet" href="/icbincss.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## Database

### CSV as Source of Truth

The CSV files in `icbincss/db/` are the authoritative data:

- `migrations.csv` - Migration history (id, checksum, timestamp)
- `tokens.csv` - Design tokens with UUIDs
- `selectors.csv` - Selector definitions (stored as JSON)
- `styles.csv` - All style rules with context (media, container, supports)
- `layers.csv` - Layer definitions and order

**UUIDs everywhere:** Every entity has a deterministic UUIDv5 as its immutable primary key, separate from the human-readable name. This allows renaming without breaking foreign key relationships.

**Database lifecycle:**

```
            ┌──────────────────────────┐
            │  migrations/up|down SQL  │
            └───────────────┬──────────┘
                            │ apply up/down
                    ┌───────▼────────────┐
                    │  Migration Engine  │
                    └───────┬───────┬────┘
                            ├───────┴─────────────────────────────┬
                         writes                              appends
                            │                                     │
            ┌───────────────▼──────────────┐   ┌────────────────▼─────────────┐
            │         CSV DB                │   │  migrations.csv (history)    │
            │    (source of truth)          │   └──────────────────────────────┘
            │  tokens.csv                   │
            │  selectors.csv                │
            │  layers.csv                   │
            │  styles.csv                   │
            │  + other at-rule tables       │
            └───────────────────────────────┘
                            │
                            ├─────────────────────────────────┬
                         compile                          sync (optional)
                            │                                 │
                    ┌───────▼──────┐              ┌──────────▼───────────┐
                    │   CSS File   │              │  Postgres / SQLite   │
                    │ (dist/*.css) │              │    (for analysis)    │
                    └──────────────┘              └──────────────────────┘
```

### Postgres Integration

Load your styles into Postgres for advanced querying and team collaboration.

**Initialize database (one-time):**

```bash
npx icbincss db init-postgres --database=icbincss_styles
```

This creates:

- Postgres database
- Optimized schema (JSONB columns, GIN indexes, helpful views)
- Loads all CSV data

**Sync after migrations:**

```bash
npx icbincss migrate up
npx icbincss db sync-postgres --database=icbincss_styles
```

**Query examples:**

```sql
-- View all styles with selector names
SELECT * FROM styles_full LIMIT 10;

-- Count styles by layer
SELECT layer_name, COUNT(*) FROM styles_with_layers GROUP BY layer_name;

-- Find all responsive rules
SELECT selector_id, resp_min, resp_max FROM styles WHERE resp_kind = 'media';

-- Query JSON selector definitions
SELECT name, def_json->>'kind' AS kind FROM selectors;

-- Get active tokens
SELECT * FROM active_tokens;
```

**Schema features:**

- JSONB columns for selectors, font faces, keyframes (fast JSON queries)
- GIN indexes on all JSONB fields
- B-tree indexes on foreign keys
- Views: `styles_full`, `styles_with_selectors`, `active_tokens`, `applied_migrations`

**Connection options:**

```bash
--database=mydb
--connection="postgresql://user:pass@host:port/db"
--host=localhost --port=5432 --user=postgres --password=secret
```

### SQLite Integration

Create and sync a local SQLite database:

```bash
npx icbincss db sync-sqlite --file=icbincss/db/icbincss.sqlite
```

This creates (or updates) a SQLite database file with your styles. Open with DB Browser, TablePlus, or any SQLite client.

**Sync after migrations:**

```bash
npx icbincss migrate up
npx icbincss db sync-sqlite --file=icbincss/db/icbincss.sqlite
```

**Query examples:**

```bash
sqlite3 icbincss/db/icbincss.sqlite "SELECT * FROM styles WHERE resp_kind = 'media';"
sqlite3 icbincss/db/icbincss.sqlite "SELECT name, value FROM tokens;"
```

**Use cases:**

- Local development and analysis
- Portable database file for sharing
- SQL queries without Postgres setup
- Integration with SQLite tools and GUIs

### Export SQL Schemas

Generate optimized schema files for different databases:

```bash
# SQLite (TEXT columns, simple schema)
npx icbincss db export-sql --dialect=sqlite

# Postgres (JSONB columns, GIN indexes, views)
npx icbincss db export-sql --dialect=postgres

# MySQL (JSON columns, utf8mb4, InnoDB)
npx icbincss db export-sql --dialect=mysql
```

This generates `icbincss/db/{dialect}-init.sql` files you can use to manually set up databases.

---

## Analysis & Tools

### Doctor

Detect conflicts and issues:

```bash
npx icbincss doctor
npx icbincss doctor --history  # Include unreachable rules analysis
```

**Checks:**

- **Duplicate properties**: Same selector/context defines a property multiple times
- **Cross-context overrides**: Property defined under different responsive conditions
- **Specificity info**: Shows specificity alongside selectors
- **Shorthand/longhand conflicts**: Detects `border` + `border-left` conflicts
- **Unknown tokens**: Catches typos in `token()` with suggestions
- **Unused tokens**: Identifies tokens never referenced
- **Unreachable rules** (with `--history`): Rules overridden by later migrations

**Example output:**

```
Cross-context overrides for .card (spec 0,1,0) → padding:
  - (global)
  - @media (min-width: 768px)

Shorthand/longhand conflict for .box:
  - border (shorthand) and border-left (longhand) both defined

Unknown token 'brand/600' in selector btn
  Did you mean 'brand/500'?
```

### Verify

Check database integrity:

```bash
npx icbincss db verify
```

**Checks:**

- Referential integrity (styles → selectors, tokens, layers)
- No orphaned records
- Valid JSON in selector definitions
- No duplicate names
- Checksum drift warnings

### Inspect

View computed styles for a selector:

```bash
npx icbincss inspect card
npx icbincss inspect card --final  # Show cascaded final values
```

**Output:**

```
Styles for .card:

@layer components:
  padding: 16px
  background: #fff

@media (min-width: 768px):
  padding: 32px

Final cascaded:
  padding: 32px
  background: #fff
```

### Query

SQL-like introspection:

```bash
# Show properties for a selector
npx icbincss query "SELECT style_props WHERE selector = card AND width >= 768px;"

# Resolve selector to CSS
npx icbincss query "DESCRIBE SELECTOR btn;"
```

---

## Reference

### CSS Feature Support

| Feature                  | Status          | Notes                                                                                  |
| ------------------------ | --------------- | -------------------------------------------------------------------------------------- |
| **Selectors**            | ✅ Full         | Element, class, id, pseudo-classes, pseudo-elements, attributes, compound, combinators |
| **Complex pseudos**      | ✅ Full         | `:is()`, `:where()`, `:not()`, `:has()`, `:nth-child()` with validation                |
| **Nesting**              | ✅ Full         | `CHILD()`, `DESC()`, `AND()` compile to flat CSS (100% browser support)                |
| **@media**               | ✅ Full         | Width ranges, features (prefers-color-scheme, orientation, pointer, etc.)              |
| **@container**           | ✅ Size queries | Named containers, min/max, inline axis                                                 |
| **@container style**     | ⚠️ Limited      | Cannot combine with media/size in same WHERE                                           |
| **@supports**            | ✅ Full         | Can nest with media/container                                                          |
| **@layer**               | ✅ Full         | Declare order, set current layer                                                       |
| **@scope**               | ✅ Full         | `SCOPED TO root [LIMIT limit]`                                                         |
| **@import**              | ✅ Full         | CSS imports emitted at top                                                             |
| **@font-face**           | ✅ Full         | `CREATE FONT_FACE family '...' (...)`                                                  |
| **@keyframes**           | ✅ Full         | `CREATE KEYFRAMES name (...)`                                                          |
| **@property**            | ✅ Full         | Custom property registration                                                           |
| **@page**                | ✅ Full         | `:first`, `:left`, `:right` pseudo-pages                                               |
| **@counter-style**       | ✅ Full         | Custom counter definitions                                                             |
| **@font-feature-values** | ✅ Full         | OpenType feature control                                                               |
| **@font-palette-values** | ✅ Full         | Color palette overrides                                                                |
| **@starting-style**      | ✅ Full         | Entry animations                                                                       |
| **CSS Variables**        | ✅ Full         | Tokens compile to `:root { --vars }`                                                   |

### SQL Syntax Reference

#### Tokens

```sql
CREATE TOKEN 'name' VALUE <css-value>;
DROP TOKEN 'name';
```

#### Selectors

```sql
-- Functions
C('class')              -- .class
E('element')            -- element
ID('id')                -- #id
P('pseudo')             -- :pseudo
PE('pseudo-element')    -- ::pseudo-element
ATTR('name')            -- [name]
ATTR('name', 'val')     -- [name="val"]
ATTR('name', 'val', '^=')  -- [name^="val"]
ATTR('name', 'val', '^=', 'i')  -- [name^="val" i]

-- Composition
AND(a, b)               -- Compound (a.b or a:b)
OR(a, b)                -- Comma list (a, b)
CHILD(parent, child)    -- Parent > child
DESC(ancestor, desc)    -- Ancestor descendant

-- Named selectors
CREATE SELECTOR name AS <selector-expr>;
DROP SELECTOR name;
```

#### Styles

```sql
-- Create
CREATE STYLE SELECTOR name (
  prop = value,
  prop = value
);

-- Modify
ALTER STYLE SELECTOR name ADD prop = value;
ALTER STYLE SELECTOR name SET prop = value;

-- Delete
DELETE FROM style_props WHERE selector = name AND prop = 'prop';
DROP STYLE SELECTOR name;

-- Responsive
ALTER STYLE SELECTOR name
  WHERE <condition>
  SET prop = value;
```

#### WHERE Conditions

```sql
-- Width queries
WHERE width >= 768px
WHERE width BETWEEN 768px AND 1024px
WHERE width < 1024px

-- Container queries
WHERE container main > 600px
WHERE container sidebar inline < 400px

-- Container style queries
WHERE container theme style(display: grid)

-- Media features
WHERE prefers_color_scheme = dark
WHERE orientation = landscape
WHERE pointer = coarse AND hover = none
WHERE resolution >= 2dppx
WHERE color_gamut = p3
WHERE forced_colors = active

-- Supports
WHERE supports(display: grid)

-- Combine with AND
WHERE width >= 768px AND prefers_color_scheme = dark
```

#### Layers

```sql
CREATE LAYERS (layer1, layer2, layer3);
SET LAYER = layer2;
```

#### At-Rules

```sql
-- Font Face
CREATE FONT_FACE family 'Inter' (
  src = url('/fonts/Inter.woff2') format('woff2'),
  font_weight = 400
);

-- Keyframes
CREATE KEYFRAMES fade_in (
  '0%' ( opacity = 0 ),
  '100%' ( opacity = 1 )
);

-- Property
CREATE PROPERTY '--theme-color' (
  syntax = '<color>',
  inherits = true,
  initial_value = #000
);

-- Raw CSS (escape hatch)
RAW "@supports (display: flex) { .box { display: flex; } }";
```

### CLI Command Reference

```bash
# Project setup
npx icbincss init

# Build & watch
npx icbincss build
npx icbincss watch

# Migrations
npx icbincss migrate status
npx icbincss migrate create --name=<name>.sql
npx icbincss migrate up
npx icbincss migrate down

# Analysis
npx icbincss inspect <selector>
npx icbincss inspect <selector> --final
npx icbincss doctor
npx icbincss doctor --history
npx icbincss query "<query>"

# Database
npx icbincss db rebuild
npx icbincss db verify
npx icbincss db export-sql --dialect=<postgres|mysql|sqlite>
npx icbincss db init-postgres --database=<name>
npx icbincss db sync-postgres --database=<name>
npx icbincss db sync-sqlite --file=<path>
```

---

## Advanced

### Configuration

Create `icbincss.config.json` in your project root:

```json
{
  "outFile": "dist/icbincss.css",
  "strictSemicolons": false,
  "tokenVarPrefix": "",
  "defaultLayers": []
}
```

**Options:**

- `outFile` - Output path for compiled CSS (relative to project root or absolute)
- `strictSemicolons` - Require `;` at end of every statement (default: `false`)
- `tokenVarPrefix` - Prefix for CSS custom properties (e.g., `"ux-"` → `--ux-brand-500`)
- `defaultLayers` - Pre-declare layers if not all defined in SQL

### Catalog Files

For convenience, you can define tokens and selectors in dedicated files instead of migrations:

```
icbincss/
├── tokens.sql       ← Token definitions
├── selectors.sql    ← Selector definitions
└── migrations/
    ├── up/
    └── down/
```

**tokens.sql:**

```sql
CREATE TOKEN 'brand/500' VALUE #2266ee;
CREATE TOKEN 'brand/600' VALUE #1a4fd8;
CREATE TOKEN 'space/sm' VALUE 8px;
CREATE TOKEN 'space/md' VALUE 16px;
```

**selectors.sql:**

```sql
CREATE SELECTOR btn AS AND(E('button'), C('primary'));
CREATE SELECTOR card AS C('card');
CREATE SELECTOR card_header AS CHILD(card, C('header'));
```

These files are loaded **before** migrations during `watch` and `db rebuild`. Prefer migrations for any change you want versioned.

### Performance

Compilation is fast. Benchmark with 1,000 selectors + rules:

```bash
npm run bench

# Example output:
# rules=1000
# sql_len=170KB css_len=98KB
# parse_ms=26.4 compile_ms=11.5 total_ms=37.9
```

Adjust size: `node scripts/bench.cjs --n=2000`

---

## FAQ

**Q: Does this work with CommonJS projects?**

A: Yes! Both `require()` and `import` work natively:

```js
// CommonJS
const { withICBINCSS } = require("i-cant-believe-its-not-css");

// ESM
import { withICBINCSS } from "i-cant-believe-its-not-css";
```

**Q: Can I use this in production?**

A: It compiles to plain CSS with zero runtime overhead. Evaluate the SQL-based workflow for your team's needs.

**Q: Why SQL?**

A: Migrations, version control, introspection tools, and treating styles as queryable data. If you prefer database workflows, it feels natural.

**Q: How does nesting work?**

A: Use `CHILD()`, `DESC()`, `AND()` for composition. Output is flat CSS (100% browser support) instead of native CSS nesting (91% support). Semantically identical, better compatibility.

**Q: What about specificity conflicts?**

A: Run `npx icbincss doctor` to detect conflicts. Within the same bucket (selector + layer + context), last migration wins.

**Q: Can I edit the CSV files directly?**

A: Not recommended. Apply migrations instead. The CSV files are the compiled output of your migrations.

**Q: What if I need features not supported?**

A: Use the `RAW` escape hatch to inject literal CSS for experiments.

---

## Examples

- [Vite Basic](docs/examples/vite-basic/) - Vite integration with HMR
- [Next.js Basic](docs/examples/next-basic/) - Next.js Pages Router integration
- [DSL Samples](docs/examples/dsl-samples.md) - Comprehensive SQL syntax examples

---

## License

MIT

---

## Follow & Support

If you liked this project, follow me for more absurd experiments:

- 🦋 [Bluesky](https://bsky.app/profile/codyapearce.bsky.social)
- 🐦 [X/Twitter](https://x.com/codyapearce)
- 📺 [YouTube @Codinhood](https://www.youtube.com/@Codinhood)
- 🎨 [CodePen](https://codepen.io/codypearce)

**See more absurd projects at [codinhood.com](https://codinhood.com)**
