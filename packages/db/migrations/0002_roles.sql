-- Creates the two Postgres roles the API is allowed to connect as. See
-- packages/db/.env.example for what each one is for; see 0001_rls.sql for
-- why NOT being the table owner and NOT being BYPASSRLS is what makes RLS
-- actually apply to pylr_app.
--
-- Passwords are deliberately NOT set here — this file is version-controlled.
-- Each environment sets them out-of-band after migrating:
--   ALTER ROLE pylr_app    WITH PASSWORD '...';
--   ALTER ROLE pylr_system WITH PASSWORD '...';
-- (local dev: see packages/db/README.md; staging/prod: via the secrets manager)
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pylr_app') THEN
    CREATE ROLE pylr_app LOGIN;
  END IF;
END
$$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pylr_system') THEN
    CREATE ROLE pylr_system LOGIN BYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO pylr_app, pylr_system', current_database());
END
$$;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO pylr_app, pylr_system;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pylr_app, pylr_system;--> statement-breakpoint

-- Applies to tables created by future migrations too, as long as they're
-- run (as these were) by the schema-owning role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pylr_app, pylr_system;
