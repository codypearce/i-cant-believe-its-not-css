CREATE TOKEN 'brand/500' VALUE #2266ee;

CREATE SELECTOR btn AS AND(E('button'), C('primary'));

CREATE STYLE SELECTOR btn (
  color = #fff
);

ALTER STYLE SELECTOR btn SET background = token('brand/500');

