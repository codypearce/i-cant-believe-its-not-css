-- DOWN migration: supports_mix

-- Revert display change
DELETE FROM style_props WHERE selector = card AND prop = 'display';
