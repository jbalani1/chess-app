-- Supabase security advisor remediation
--
-- Findings this addresses (verified against the live database, and by probing
-- the REST API with the public anon key):
--
--  CRITICAL  The anon key — which ships inside the browser bundle and is
--            therefore public — held INSERT/UPDATE/DELETE on every table.
--            A DELETE against `games` or `raw_games` returned HTTP 200.
--            Anyone who opened devtools could have wiped the database.
--
--  ERROR     5 tables in `public` had no RLS at all
--            (games, moves, positional_errors,
--             positional_recurring_patterns, raw_games)
--
--  ERROR     12 views ran with the definer's rights (security_invoker off),
--            so they read base tables as their owner and sidestep RLS
--
--  WARN      6 functions had a mutable search_path
--
--  BUG       blunder_patterns, drill_attempts and engine_configs had RLS
--            enabled with *no policy*, so PostgREST returned 0 rows to the
--            app. The nightly job has been rebuilding blunder_patterns for
--            the dashboard hero and Insights → Recurring, and the UI could
--            never read it.
--
-- Approach: this app is single-user and its data is already served to the
-- browser, so reads stay open to anon. The hardening is that anon becomes
-- READ-ONLY. Every write in the app already goes through the service_role
-- key (src/app/api/drill/attempt/route.ts), and the Python worker connects
-- directly as the table owner, so neither is affected.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Row level security on, with an explicit read policy, for every table
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Readable by the app. Named consistently so it is easy to tighten later
    -- if this ever becomes multi-user.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                   'app_read_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      'app_read_' || t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. anon and authenticated become read-only
--    No policy is created for INSERT/UPDATE/DELETE, and the grants are
--    revoked too, so both layers agree.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Anything created later inherits the same shape.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon, authenticated;

-- The worker and the app's server-side routes are unaffected.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Views run as the caller, so they honour the caller's RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE v text;
BEGIN
  FOR v IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Pin search_path on every function
--    pg_temp is listed last on purpose: a caller-created temp object must not
--    be able to shadow a public one. explorer_query/facet_counts need pg_temp
--    present because they build and read a temp table.
-- ---------------------------------------------------------------------------
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Performance advisor: index the foreign keys that had none
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_games_engine_config
  ON public.games(engine_config_hash);
CREATE INDEX IF NOT EXISTS idx_moves_engine_config
  ON public.moves(engine_config_hash);
CREATE INDEX IF NOT EXISTS idx_question_results_quiz
  ON public.question_results(quiz_result_id);

COMMIT;
