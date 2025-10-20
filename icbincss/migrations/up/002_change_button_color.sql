-- Create tokens first
CREATE TOKEN 'brand/500' VALUE #2266ee;
CREATE TOKEN 'space/4' VALUE 16px;

-- Create selectors
CREATE SELECTOR card AS C('card');
CREATE SELECTOR btn AS AND(E('button'), C('primary'));

-- Create styles
CREATE STYLE SELECTOR card (
  background = #fff,
  padding = token('space/4')
)

CREATE STYLE SELECTOR btn (
  background = token('brand/500'),
  color = #fff
)
