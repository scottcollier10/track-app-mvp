-- Create llm_logs: durable LLM telemetry (cost/latency per call).
-- Written by llm-telemetry.ts via the user-scoped server client, so RLS
-- applies to inserts. Insert-only for authenticated; NO select policy —
-- the app never reads this table (cost queries go through the SQL editor,
-- which bypasses RLS). Idempotent: safe to re-run.

create table if not exists public.llm_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null,
  model text not null,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric,
  latency_ms integer,
  project text,
  feature text,
  user_id uuid,   -- driver id (legacy metadata.userId)
  coach_id uuid,  -- coach attribution for pilot economics; no FK — telemetry writes must never fail on integrity
  metadata jsonb not null default '{}',
  error text
);

alter table public.llm_logs enable row level security;

drop policy if exists llm_logs_select on public.llm_logs;
drop policy if exists llm_logs_insert on public.llm_logs;
create policy llm_logs_insert on public.llm_logs
  for insert to authenticated with check (true);
