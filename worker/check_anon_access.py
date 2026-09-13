"""What can someone do with the public anon key?

NEXT_PUBLIC_SUPABASE_ANON_KEY ships inside the browser bundle, so it is public
by design. This probes the REST API exactly as a browser would, to show what
that key actually permits — before and after the security migration.

The write probe is deliberately harmless: it inserts a row into engine_configs
with an obviously fake primary key and deletes it again if it succeeds.
"""
import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
URL = os.environ['SUPABASE_URL'].rstrip('/')
ANON = os.environ['SUPABASE_ANON_KEY']
PROBE_KEY = 'zzz-anon-write-probe'

READ_TARGETS = [
    'games', 'moves', 'blunder_patterns', 'drill_attempts', 'engine_configs',
    'raw_games', 'positional_errors', 'user_mistakes', 'game_statistics',
]


def call(method, path, body=None):
    req = urllib.request.Request(
        f'{URL}/rest/v1/{path}', method=method,
        data=json.dumps(body).encode() if body is not None else None)
    req.add_header('apikey', ANON)
    req.add_header('Authorization', f'Bearer {ANON}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=representation')
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, json.loads(r.read() or b'[]')
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b'').decode()[:120]
    except Exception as e:  # network/DNS
        return 0, str(e)[:120]


print('=' * 74)
print('READ access with the public anon key')
print('=' * 74)
for t in READ_TARGETS:
    status, body = call('GET', f'{t}?select=*&limit=1')
    rows = len(body) if isinstance(body, list) else '-'
    verdict = 'readable' if status == 200 and rows else (
        'EMPTY (blocked by RLS)' if status == 200 else f'denied {status}')
    print(f'  {t:28} HTTP {status}  rows={rows:<3} {verdict}')

print()
print('=' * 74)
print('WRITE access with the public anon key')
print('=' * 74)

status, body = call('POST', 'engine_configs', [{
    'config_hash': PROBE_KEY, 'skill_level': 0, 'threads': 1,
    'hash_mb': 1, 'multi_pv': 1, 'move_time_ms': 1,
}])
if status in (200, 201):
    print(f'  INSERT engine_configs  HTTP {status}  *** ALLOWED — anyone can write ***')
    d, _ = call('DELETE', f'engine_configs?config_hash=eq.{PROBE_KEY}')
    print(f'  (probe row deleted, HTTP {d})')
else:
    print(f'  INSERT engine_configs  HTTP {status}  blocked  {body}')

status, body = call('PATCH', 'games?username=eq.__nonexistent__',
                    {'opening_name': 'probe'})
print(f'  UPDATE games (no match)  HTTP {status}  '
      f'{"ALLOWED" if status in (200, 204) else "blocked"}  {str(body)[:70]}')

status, body = call('DELETE', 'raw_games?chess_com_game_id=eq.__nonexistent__')
print(f'  DELETE raw_games (no match) HTTP {status}  '
      f'{"ALLOWED" if status in (200, 204) else "blocked"}  {str(body)[:70]}')

print()
status, body = call('POST', 'rpc/explorer_query', {'f': {'limit': 1}})
ok = status == 200 and isinstance(body, dict) and 'total' in body
print(f'  RPC explorer_query      HTTP {status}  '
      f'{"works — explorer OK" if ok else "BROKEN: " + str(body)[:90]}')
