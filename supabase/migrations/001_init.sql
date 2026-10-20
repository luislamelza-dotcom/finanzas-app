-- Finanzas: almacenamiento de documentos por usuario (misma estructura que la web en claude.ai)
create table if not exists public.docs (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  col        text not null,           -- colección: 'meses', 'config', 'resumenes'
  id         text not null,           -- id del documento: '2026-11', 'main', 'visa_nacion_2026-11-05'
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, col, id)
);

alter table public.docs enable row level security;

-- Cada usuario ve y modifica solo lo suyo
create policy "docs_select_own" on public.docs for select to authenticated using (user_id = auth.uid());
create policy "docs_insert_own" on public.docs for insert to authenticated with check (user_id = auth.uid());
create policy "docs_update_own" on public.docs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "docs_delete_own" on public.docs for delete to authenticated using (user_id = auth.uid());

-- Nada para usuarios anónimos
revoke all on public.docs from anon;

create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs for each row execute function public.docs_touch();

-- Cambios en vivo entre la compu y el celu
alter publication supabase_realtime add table public.docs;
alter table public.docs replica identity full;
