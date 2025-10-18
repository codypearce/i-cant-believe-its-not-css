-- Rollback test comprehensive

-- Drop styles
DROP STYLE SELECTOR hero;
DROP STYLE SELECTOR hero_title;

-- Drop selectors
DROP SELECTOR hero_title;
DROP SELECTOR hero;

-- Drop tokens
DROP TOKEN 'accent/red';
DROP TOKEN 'spacing/lg';
