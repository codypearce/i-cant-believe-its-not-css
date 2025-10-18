SET LAYER = components;

CREATE STYLE SELECTOR card (
  padding = token('space/4')
);

CREATE STYLE SELECTOR btn (
  background = token('brand/500'),
  color = #fff
);

ALTER STYLE SELECTOR btn
  WHERE width >= 768px
  SET background = #1144cc;

