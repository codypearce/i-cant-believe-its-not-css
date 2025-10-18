-- Test comprehensive features with UUIDs

-- Create tokens
CREATE TOKEN 'accent/red' VALUE #ff4444;
CREATE TOKEN 'spacing/lg' VALUE 32px;

-- Create selectors
CREATE SELECTOR hero AS C('hero');
CREATE SELECTOR hero_title AS CHILD(hero, E('h1'));

-- Create styles with responsive conditions
CREATE STYLE SELECTOR hero (
  background = token('accent/red'),
  padding = token('spacing/lg'),
  color = white
);

CREATE STYLE SELECTOR hero_title (
  font_size = 48px,
  font_weight = bold
);

-- Responsive styles
ALTER STYLE SELECTOR hero
  WHERE width >= 1024px
  SET padding = 64px;

-- Container query
ALTER STYLE SELECTOR hero
  WHERE container main > 800px
  SET background = #cc0000;
