-- ApacheLegal: módulo Procesos (seguimiento de casos y controversias contractuales)
-- Ejecutar en el SQL editor de Supabase después de schema.sql. Es idempotente.

create table if not exists casos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cliente text,
  contraparte text,
  contrato text,
  objeto text,
  valor numeric,
  entidad text,
  etapa text not null default 'analisis'
    check (etapa in ('analisis', 'arreglo_directo', 'conciliacion', 'arbitraje', 'judicial', 'cerrado')),
  estado text not null default 'activo'
    check (estado in ('activo', 'suspendido', 'cerrado')),
  responsable text,
  resumen text,
  posicion text,
  fecha_inicio date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists casos_estado_idx on casos (estado);

-- Plan de acciones del caso: cada fila es una gestión ante alguien, con fecha límite y soporte.
create table if not exists caso_tareas (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos (id) on delete cascade,
  orden integer,
  ante_quien text,
  accion text not null,
  proposito text,
  fecha_limite date,
  responsable text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_progreso', 'completada', 'descartada')),
  fecha_cumplimiento date,
  soporte text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists caso_tareas_caso_id_idx on caso_tareas (caso_id);
create index if not exists caso_tareas_fecha_limite_idx on caso_tareas (fecha_limite);

-- Cronología de hechos jurídicos. fecha_texto guarda fechas aproximadas o "por confirmar".
create table if not exists caso_hechos (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos (id) on delete cascade,
  fecha date,
  fecha_texto text,
  hecho text not null,
  relevancia text,
  created_at timestamptz not null default now()
);

create index if not exists caso_hechos_caso_id_idx on caso_hechos (caso_id);

-- Matriz probatoria: qué hecho se prueba, con qué prueba, de dónde sale y en qué estado está.
create table if not exists caso_pruebas (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos (id) on delete cascade,
  hecho text not null,
  prueba text,
  fuente text,
  estado text not null default 'por_obtener'
    check (estado in ('disponible', 'parcial', 'por_obtener', 'por_confirmar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists caso_pruebas_caso_id_idx on caso_pruebas (caso_id);

create table if not exists caso_documentos (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos (id) on delete cascade,
  nombre text not null,
  tipo text not null default 'otro'
    check (tipo in ('contrato', 'carta', 'oficio', 'poliza', 'acta', 'soporte', 'otro')),
  storage_path text not null,
  tamano_bytes bigint,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists caso_documentos_caso_id_idx on caso_documentos (caso_id);

drop trigger if exists casos_set_updated_at on casos;
create trigger casos_set_updated_at
  before update on casos
  for each row execute function set_updated_at();

drop trigger if exists caso_tareas_set_updated_at on caso_tareas;
create trigger caso_tareas_set_updated_at
  before update on caso_tareas
  for each row execute function set_updated_at();

drop trigger if exists caso_pruebas_set_updated_at on caso_pruebas;
create trigger caso_pruebas_set_updated_at
  before update on caso_pruebas
  for each row execute function set_updated_at();

-- Storage bucket para los documentos de los casos
insert into storage.buckets (id, name, public)
values ('casos', 'casos', false)
on conflict (id) do nothing;

-- RLS: mismo criterio que el resto del esquema (acceso para usuarios autenticados)
do $$
declare t text;
begin
  foreach t in array array['casos', 'caso_tareas', 'caso_hechos', 'caso_pruebas', 'caso_documentos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated all %s" on %I', t, t);
    execute format(
      'create policy "authenticated all %s" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t, t
    );
  end loop;
end $$;
