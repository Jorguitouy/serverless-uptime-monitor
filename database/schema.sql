-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. SETTINGS TABLE
create table if not exists public.settings (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  waf_secret text,
  resend_api_key text,
  sender_email text,
  notification_email text,
  worker_url text,
  site_name text default 'Uptime Jorguito',
  allow_indexing boolean default false, -- Nueva opción de indexación
  retention_ok_days int default 1,
  retention_error_days int default 30,
  alert_subject text default 'ALERTA: {{site_name}} está CAÍDO',
  alert_body text default '<p>El sitio <strong>{{site_name}}</strong> ({{url}}) respondió con error <strong>{{status}}</strong>.</p><p>Latencia: {{latency}}ms</p><p>Hora: {{time}}</p>',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name = 'settings' and column_name = 'retention_ok_days') then
        alter table public.settings add column retention_ok_days int default 1;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'settings' and column_name = 'retention_error_days') then
        alter table public.settings add column retention_error_days int default 30;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'settings' and column_name = 'site_name') then
        alter table public.settings add column site_name text default 'Uptime Jorguito';
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'settings' and column_name = 'allow_indexing') then
        alter table public.settings add column allow_indexing boolean default false;
    end if;
end $$;

-- 2. SITES TABLE
create table if not exists public.sites (
  id uuid not null primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  name text not null,
  is_active boolean default true,
  check_interval int default 60, 
  next_run_at timestamp with time zone default timezone('utc'::text, now()),
  last_status int,
  last_latency int,
  last_checked_at timestamp with time zone,
  status_changed_at timestamp with time zone,
  last_incident_at timestamp with time zone,
  incident_acknowledged_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name = 'sites' and column_name = 'status_changed_at') then
        alter table public.sites add column status_changed_at timestamp with time zone default now();
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'sites' and column_name = 'last_incident_at') then
        alter table public.sites add column last_incident_at timestamp with time zone;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'sites' and column_name = 'incident_acknowledged_at') then
        alter table public.sites add column incident_acknowledged_at timestamp with time zone;
    end if;
end $$;

-- 3. PING LOGS TABLE
create table if not exists public.ping_logs (
  id uuid not null primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  status_code int,
  latency_ms int,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. SYSTEM EVENTS TABLE (Nuevo)
create table if not exists public.system_events (
  id uuid not null primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, 
  message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- INDEXES
drop index if exists idx_sites_user_id;
create index idx_sites_user_id on public.sites(user_id);

drop index if exists idx_sites_next_run;
create index idx_sites_next_run on public.sites(next_run_at) where is_active = true;

drop index if exists idx_ping_logs_site_id;
create index idx_ping_logs_site_id on public.ping_logs(site_id);

drop index if exists idx_ping_logs_created_at;
create index idx_ping_logs_created_at on public.ping_logs(created_at);

drop index if exists idx_system_events_user_id;
create index idx_system_events_user_id on public.system_events(user_id);

-- ROW LEVEL SECURITY (RLS)
alter table public.settings enable row level security;
alter table public.sites enable row level security;
alter table public.ping_logs enable row level security;
alter table public.system_events enable row level security;

-- POLICIES (Same as before)
drop policy if exists "Users can view their own settings" on public.settings;
create policy "Users can view their own settings" on public.settings for select using (auth.uid() = user_id);
drop policy if exists "Users can update their own settings" on public.settings;
create policy "Users can update their own settings" on public.settings for update using (auth.uid() = user_id);
drop policy if exists "Users can insert their own settings" on public.settings;
create policy "Users can insert their own settings" on public.settings for insert with check (auth.uid() = user_id);

drop policy if exists "Users can view their own sites" on public.sites;
create policy "Users can view their own sites" on public.sites for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own sites" on public.sites;
create policy "Users can insert their own sites" on public.sites for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own sites" on public.sites;
create policy "Users can update their own sites" on public.sites for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own sites" on public.sites;
create policy "Users can delete their own sites" on public.sites for delete using (auth.uid() = user_id);

drop policy if exists "Users can view logs for their sites" on public.ping_logs;
create policy "Users can view logs for their sites" on public.ping_logs for select using (exists (select 1 from public.sites where sites.id = ping_logs.site_id and sites.user_id = auth.uid()));

drop policy if exists "Users can view their own system events" on public.system_events;
create policy "Users can view their own system events" on public.system_events for select using (auth.uid() = user_id);

-- HELPER FUNCTION (TIMESTAMP)
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

drop trigger if exists update_settings_modtime on public.settings;
create trigger update_settings_modtime
    before update on public.settings
    for each row execute procedure update_updated_at_column();

-- RPC FUNCTION: delete_old_logs
create or replace function delete_old_logs(p_user_id uuid, p_date_ok timestamptz, p_date_error timestamptz)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.ping_logs
  where site_id in (select id from public.sites where user_id = p_user_id)
  and status_code >= 200 and status_code < 300
  and created_at < p_date_ok;

  delete from public.ping_logs
  where site_id in (select id from public.sites where user_id = p_user_id)
  and (status_code < 200 or status_code >= 300)
  and created_at < p_date_error;
end;
$$;
