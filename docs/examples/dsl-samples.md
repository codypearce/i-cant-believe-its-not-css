# DSL Samples

A grab bag of ICBINCSS SQL examples covering tokens, selectors, styles, responsive/container WHERE, joins, RAW, @font-face, and @keyframes.

## Tokens and Variables

```
CREATE TOKEN 'brand/500' VALUE #2266ee;
CREATE TOKEN 'space/4'   VALUE 16px;
-- Usage: token('brand/500') → var(--brand-500)
```

## Layers

```
CREATE LAYERS (base, components, overrides);
SET LAYER = base;
```

## Selectors

```
CREATE SELECTOR btn       AS AND(E('button'), C('primary'));
CREATE SELECTOR card      AS C('card');
CREATE SELECTOR card_img  AS CHILD(card, E('img'));
CREATE SELECTOR hover_btn AS AND(btn, P('hover'));
CREATE SELECTOR icon_first AS AND(E('svg'), P('first-child'));
CREATE SELECTOR btn_icon_left AS JOIN CHILD btn ON icon_first;
```

## Styles and Alters

```
CREATE STYLE SELECTOR card (
  background = #fff,
  border_radius = 12px,
  padding = token('space/4')
);

ALTER STYLE SELECTOR card ADD margin = 12px;
ALTER STYLE SELECTOR card SET border_radius = 16px;
```

## Responsive and Container Queries

```
-- Media min/max
ALTER STYLE SELECTOR card
  WHERE width BETWEEN 768px AND 1200px
  SET padding = 24px;

-- Min-only / max-only
ALTER STYLE SELECTOR card WHERE width >= 768px SET padding = 24px;
ALTER STYLE SELECTOR card WHERE width <= 600px SET padding = 12px;

-- Media features
ALTER STYLE SELECTOR card WHERE prefers_color_scheme = dark SET color = #fff;
ALTER STYLE SELECTOR card WHERE orientation = landscape SET display = grid;

-- OR composition (media only)
ALTER STYLE SELECTOR card
  WHERE (width <= 600px) OR (orientation = landscape)
  SET padding = 12px;

-- Container queries
ALTER STYLE SELECTOR card
  WHERE container main > 600px
  SET border_radius = 16px;
```

## RAW, Fonts, and Keyframes

```
RAW '@supports (backdrop-filter: blur(2px)) { .frosted { backdrop-filter: blur(2px); } }';

CREATE FONT_FACE family 'Inter' (
  src = url('/fonts/Inter.woff2') format('woff2'),
  font_weight = 400,
  font_display = swap
);

CREATE KEYFRAMES fade_in (
  '0%'   ( opacity = 0 ),
  '100%' ( opacity = 1 )
);
```

## Deletes and Drops

```
DELETE FROM style_props WHERE selector = card AND prop = 'box_shadow';
DROP STYLE SELECTOR card_img;
DROP TOKEN 'brand/500';
DROP KEYFRAMES fade_in;
DROP FONT_FACE family 'Inter';
```

