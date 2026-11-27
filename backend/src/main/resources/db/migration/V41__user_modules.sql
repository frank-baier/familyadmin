-- Which module apps a user may use. Existing users keep access to everything.
ALTER TABLE users ADD COLUMN modules TEXT[] NOT NULL
    DEFAULT ARRAY['tasks','recipes','travel','notes','documents','finance','sport'];
