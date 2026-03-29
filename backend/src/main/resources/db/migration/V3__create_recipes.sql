CREATE TYPE meal_slot AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    servings INT,
    prep_minutes INT,
    cook_minutes INT,
    photo_url VARCHAR(512),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(10,3),
    unit VARCHAR(50),
    position INT NOT NULL DEFAULT 0
);

CREATE TABLE recipe_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    position INT NOT NULL
);

CREATE TABLE meal_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_date DATE NOT NULL,
    slot meal_slot NOT NULL DEFAULT 'DINNER',
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    notes VARCHAR(512),
    UNIQUE(plan_date, slot)
);

CREATE INDEX idx_recipes_title ON recipes(lower(title));
CREATE INDEX idx_meal_plan_date ON meal_plan(plan_date);
