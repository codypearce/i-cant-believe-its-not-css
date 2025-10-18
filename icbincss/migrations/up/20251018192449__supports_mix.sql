-- UP migration: supports_mix

-- Mix supports() with media min-width
ALTER STYLE SELECTOR card
  WHERE supports(display: grid) AND width >= 768px
  SET display = grid;
