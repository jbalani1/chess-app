# Fixing psycopg2 on Raspberry Pi

If you get the error: `ImportError: libpq.so.5: cannot open shared object file`

You need to install the PostgreSQL client libraries:

```bash
sudo apt-get update
sudo apt-get install libpq-dev postgresql-client
```

Then reinstall psycopg2-binary:

```bash
source .venv/bin/activate
pip uninstall psycopg2-binary
pip install psycopg2-binary
```

Or if that doesn't work, try installing from source:

```bash
pip uninstall psycopg2-binary
pip install psycopg2-binary --no-binary psycopg2-binary
```

