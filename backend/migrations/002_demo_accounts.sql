ALTER TABLE users ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX users_demo_accounts ON users(is_demo) WHERE is_demo;
