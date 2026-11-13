-- Read-only role for the DCS Italia website on the DCSServerBot database.
-- Run once as the postgres superuser (psql -U postgres -d <dcsserverbot db> -f dcsserverbot-readonly.sql),
-- after replacing CHANGE_ME and, if different, the database name "dcsserverbot".
-- Then set in backend/.env:
--   DCSSB_DATABASE_URL=postgres://hidc_web_ro:CHANGE_ME@127.0.0.1:5432/dcsserverbot

CREATE ROLE hidc_web_ro LOGIN PASSWORD 'CHANGE_ME';

GRANT CONNECT ON DATABASE dcsserverbot TO hidc_web_ro;
GRANT USAGE ON SCHEMA public TO hidc_web_ro;

-- Only the tables the site reads. missionstats / traps exist only with the
-- missionstats / greenieboard plugins: drop those lines if the plugin is not installed.
GRANT SELECT ON players, missions, statistics TO hidc_web_ro;
GRANT SELECT ON missionstats TO hidc_web_ro;
GRANT SELECT ON traps TO hidc_web_ro;

-- Belt and braces: every session of this role is read-only.
ALTER ROLE hidc_web_ro SET default_transaction_read_only = on;
