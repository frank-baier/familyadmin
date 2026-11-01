-- Optional group heading for an ingredient, e.g. "Für die Gremolata" (NULL = no group)
ALTER TABLE recipe_ingredients ADD COLUMN section VARCHAR(255);
