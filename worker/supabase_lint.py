"""Reproduce Supabase's Advisor checks against the database directly.

The dashboard's Security/Performance advisors are powered by `splinter`
(github.com/supabase/splinter), a set of SQL rules. Without a Management API
personal access token we cannot read the dashboard's rendered list, so this
runs the equivalent rules against the same database and reports the findings.

Read-only: this script diagnoses, it does not change anything.
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'), sslmode='require')
cur = conn.cursor()
cur.execute("SET statement_timeout='120s'")

findings = []


def rule(level, name, sql, describe):
    cur.execute(sql)
    rows = cur.fetchall()
    for r in rows:
        findings.append((level, name, describe(r)))
    return rows


print('=' * 78)
print('SUPABASE ADVISOR EQUIVALENT — security')
print('=' * 78)

# ---- ERROR: tables exposed through PostgREST with no RLS -------------------
rule('ERROR', 'rls_disabled_in_public', """
    SELECT c.relname,
           (SELECT COUNT(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND NOT c.relrowsecurity
    ORDER BY c.relname
""", lambda r: f"table `{r[0]}` has RLS disabled ({r[1]} policies defined)")

# ---- ERROR: policies written but RLS never switched on --------------------
rule('ERROR', 'policy_exists_rls_disabled', """
    SELECT c.relname, COUNT(*)
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT c.relrowsecurity
    GROUP BY c.relname
""", lambda r: f"table `{r[0]}` has {r[1]} policies but RLS is off — they do nothing")

# ---- ERROR: views that run with the definer's rights ----------------------
# A view without security_invoker bypasses RLS on its base tables for whoever
# can select from it.
rule('ERROR', 'security_definer_view', """
    SELECT c.relname,
           pg_get_userbyid(c.relowner) AS owner,
           has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_read
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
      -- only a view that does NOT run as the caller is a finding
      AND COALESCE((
            SELECT option_value FROM pg_options_to_table(c.reloptions)
            WHERE option_name = 'security_invoker'), 'false') NOT IN ('on','true')
    ORDER BY c.relname
""", lambda r: (f"view `{r[0]}` runs as its owner ({r[1]}), bypassing the "
                f"caller's RLS; anon_can_select={r[2]}"))

# ---- WARN: functions with a mutable search_path ---------------------------
# Dynamic SQL inside a function with a mutable search_path can be hijacked by a
# caller-controlled schema.
rule('WARN', 'function_search_path_mutable', """
    SELECT p.proname,
           pg_get_userbyid(p.proowner) AS owner,
           p.prosecdef AS security_definer,
           COALESCE(array_to_string(p.proconfig, ', '), '(none)') AS config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (p.proconfig IS NULL
           OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c
                          WHERE c LIKE 'search_path=%'))
    ORDER BY p.proname
""", lambda r: (f"function `{r[0]}()` has no fixed search_path "
                f"(security_definer={r[2]}, config={r[3]})"))

# ---- WARN: extensions installed into public -------------------------------
rule('WARN', 'extension_in_public', """
    SELECT e.extname
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE n.nspname = 'public'
""", lambda r: f"extension `{r[0]}` is installed in the public schema")

# ---- INFO: RLS on but nothing can read ------------------------------------
rule('INFO', 'rls_enabled_no_policy', """
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND c.relrowsecurity
      AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
""", lambda r: f"table `{r[0]}` has RLS on but no policies — nothing can read it")

for level in ('ERROR', 'WARN', 'INFO'):
    hits = [f for f in findings if f[0] == level]
    print(f'\n{level} ({len(hits)})')
    for _, name, msg in hits:
        print(f'  [{name}] {msg}')

# ---------------------------------------------------------------- grants
print('\n' + '=' * 78)
print('WHAT THE PUBLIC (anon) KEY CAN DO TODAY')
print('=' * 78)
cur.execute("""
    SELECT c.relname, c.relkind,
           has_table_privilege('anon', c.oid, 'SELECT') s,
           has_table_privilege('anon', c.oid, 'INSERT') i,
           has_table_privilege('anon', c.oid, 'UPDATE') u,
           has_table_privilege('anon', c.oid, 'DELETE') d
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v')
    ORDER BY c.relkind, c.relname
""")
print(f"  {'object':28} {'kind':5} {'select':>6} {'insert':>6} {'update':>6} {'delete':>6}")
writable = []
for name, kind, s, i, u, d in cur.fetchall():
    print(f"  {name:28} {kind:5} {str(s):>6} {str(i):>6} {str(u):>6} {str(d):>6}")
    if i or u or d:
        writable.append(name)
print(f"\n  objects the anon key can WRITE to: {len(writable)}")
if writable:
    print('   ', ', '.join(writable))

# ---------------------------------------------------------------- performance
print('\n' + '=' * 78)
print('PERFORMANCE ADVISOR EQUIVALENT')
print('=' * 78)

cur.execute("""
    SELECT c.conrelid::regclass::text AS tbl, c.conname,
           (SELECT string_agg(a.attname, ', ')
            FROM unnest(c.conkey) k JOIN pg_attribute a
              ON a.attrelid = c.conrelid AND a.attnum = k) AS cols
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f' AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND (i.indkey::smallint[])[0:array_length(c.conkey,1)-1] = c.conkey)
""")
fks = cur.fetchall()
print(f'\n  unindexed foreign keys ({len(fks)}):')
for t, name, cols in fks:
    print(f'    {t}.({cols}) — {name}')

cur.execute("""
    SELECT relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
    FROM pg_stat_user_indexes s
    JOIN pg_index i USING (indexrelid)
    WHERE schemaname='public' AND idx_scan = 0 AND NOT i.indisunique
    ORDER BY pg_relation_size(indexrelid) DESC
""")
unused = cur.fetchall()
print(f'\n  never-used indexes ({len(unused)}):')
for t, idx, scans, size in unused:
    print(f'    {t}.{idx} — {scans} scans, {size}')

cur.execute("""
    SELECT schemaname||'.'||relname, n_dead_tup, n_live_tup
    FROM pg_stat_user_tables
    WHERE schemaname='public' AND n_dead_tup > 1000
    ORDER BY n_dead_tup DESC
""")
bloat = cur.fetchall()
if bloat:
    print('\n  tables with dead rows needing vacuum:')
    for t, dead, live in bloat:
        print(f'    {t}: {dead} dead / {live} live')

conn.close()
print('\n' + '=' * 78)
print(f'TOTAL: {len([f for f in findings if f[0]=="ERROR"])} errors, '
      f'{len([f for f in findings if f[0]=="WARN"])} warnings, '
      f'{len([f for f in findings if f[0]=="INFO"])} info')
print('=' * 78)
