-- ads_manager schema

CREATE TABLE IF NOT EXISTS personas (
  id              SERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,  -- 'ai-department', 'pressure-release', etc.
  name            TEXT NOT NULL,
  lp_url          TEXT NOT NULL,
  budget_floor_pct NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  status          TEXT NOT NULL DEFAULT 'active', -- active | paused | removed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id                  SERIAL PRIMARY KEY,
  persona_id          INTEGER NOT NULL REFERENCES personas(id),
  google_campaign_id  TEXT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS keyword_snapshots (
  id              SERIAL PRIMARY KEY,
  persona_id      INTEGER NOT NULL REFERENCES personas(id),
  campaign_id     INTEGER NOT NULL REFERENCES campaigns(id),
  keyword         TEXT NOT NULL,
  match_type      TEXT NOT NULL DEFAULT 'EXACT',
  impressions     INTEGER NOT NULL DEFAULT 0,
  clicks          INTEGER NOT NULL DEFAULT 0,
  conversions     NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_micros     BIGINT NOT NULL DEFAULT 0,  -- Google stores cost in micros (millionths of $)
  snapshot_date   DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_snapshots (
  id              SERIAL PRIMARY KEY,
  persona_id      INTEGER NOT NULL REFERENCES personas(id),
  campaign_id     INTEGER NOT NULL REFERENCES campaigns(id),
  google_ad_id    TEXT NOT NULL,
  headline_1      TEXT,
  headline_2      TEXT,
  headline_3      TEXT,
  description_1   TEXT,
  description_2   TEXT,
  impressions     INTEGER NOT NULL DEFAULT 0,
  clicks          INTEGER NOT NULL DEFAULT 0,
  conversions     NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_micros     BIGINT NOT NULL DEFAULT 0,
  snapshot_date   DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS optimization_runs (
  id              SERIAL PRIMARY KEY,
  persona_id      INTEGER REFERENCES personas(id),  -- NULL = cross-persona run
  run_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode            TEXT NOT NULL DEFAULT 'hitl',  -- hitl | auto
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | executed | skipped
  analysis        TEXT,   -- raw analysis text from Claude
  recommendations JSONB,  -- structured list of proposed changes
  approved_by     TEXT,   -- 'auto' or Discord user who approved
  executed_at     TIMESTAMPTZ,
  notes           TEXT
);

CREATE TABLE IF NOT EXISTS seed_ideas (
  id              SERIAL PRIMARY KEY,
  persona_id      INTEGER NOT NULL REFERENCES personas(id),
  run_id          INTEGER REFERENCES optimization_runs(id),
  idea_text       TEXT NOT NULL,
  rationale       TEXT,
  budget_pct      NUMERIC(5,4) NOT NULL DEFAULT 0.07,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | running | completed
  results         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS conversion_events (
  id              SERIAL PRIMARY KEY,
  persona_id      INTEGER REFERENCES personas(id),
  event_name      TEXT NOT NULL,  -- 'cta_click', 'calendar_open', 'appointment_scheduled'
  source          TEXT,           -- 'google_ads', 'organic', 'direct'
  gclid           TEXT,           -- Google Click ID for attribution
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_keyword_snapshots_persona_date ON keyword_snapshots(persona_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_ad_snapshots_persona_date ON ad_snapshots(persona_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_optimization_runs_date ON optimization_runs(run_date);
CREATE INDEX IF NOT EXISTS idx_seed_ideas_status ON seed_ideas(status);
