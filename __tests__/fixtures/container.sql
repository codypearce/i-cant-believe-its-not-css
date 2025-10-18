CREATE SELECTOR card AS C('card');

CREATE STYLE SELECTOR card (
  padding = 16px
);

ALTER STYLE SELECTOR card WHERE container main > 600px SET padding = 24px;

