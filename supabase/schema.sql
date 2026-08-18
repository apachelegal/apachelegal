-- ApacheLegal: esquema de licitaciones y gestión documental
-- Ejecutar en el SQL editor de Supabase.

create extension if not exists "pgcrypto";

create table if not exists licitaciones (
  id uuid primary key default gen_random_uuid(),
  entidad text not null,
  objeto text not null,
  numero_proceso text,
  estado text not null default 'en_estudio'
    check (estado in ('en_estudio', 'en_elaboracion', 'presentada', 'adjudicada', 'perdida', 'cancelada')),
  presupuesto numeric,
  fecha_apertura date,
  fecha_cierre date,
  fecha_vencimiento date,
  responsable text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists licitaciones_fecha_vencimiento_idx on licitaciones (fecha_vencimiento);
create index if not exists licitaciones_estado_idx on licitaciones (estado);

create table if not exists entidades_contratantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manuales_contratacion (
  id uuid primary key default gen_random_uuid(),
  entidad_id uuid not null references entidades_contratantes (id) on delete cascade,
  nombre text not null,
  vigencia text,
  storage_path text not null,
  tamano_bytes bigint,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists manuales_contratacion_entidad_id_idx on manuales_contratacion (entidad_id);

alter table licitaciones add column if not exists entidad_id uuid references entidades_contratantes (id) on delete set null;
create index if not exists licitaciones_entidad_id_idx on licitaciones (entidad_id);

create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  licitacion_id uuid not null references licitaciones (id) on delete cascade,
  nombre text not null,
  tipo text not null default 'otro'
    check (tipo in ('pliego', 'propuesta', 'anexo', 'contrato', 'otro')),
  storage_path text not null,
  tamano_bytes bigint,
  content_type text,
  subido_por text,
  created_at timestamptz not null default now()
);

create index if not exists documentos_licitacion_id_idx on documentos (licitacion_id);

create table if not exists analisis_licitacion (
  licitacion_id uuid primary key references licitaciones (id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'procesando', 'completado', 'error')),
  resumen text,
  requisitos_juridicos jsonb,
  requisitos_financieros jsonb,
  requisitos_tecnicos jsonb,
  anexos_detectados jsonb,
  fechas_clave jsonb,
  error_mensaje text,
  modelo text,
  documentos_analizados uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  licitacion_id uuid not null references licitaciones (id) on delete cascade,
  titulo text not null,
  responsable text,
  fecha_limite date,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_progreso', 'completada')),
  origen text not null default 'manual'
    check (origen in ('manual', 'ia')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tareas_licitacion_id_idx on tareas (licitacion_id);
create index if not exists tareas_fecha_limite_idx on tareas (fecha_limite);

create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  licitacion_id uuid not null references licitaciones (id) on delete cascade,
  nombre text not null,
  descripcion text,
  obligatorio boolean not null default true,
  completado boolean not null default false,
  documento_id uuid references documentos (id) on delete set null,
  origen text not null default 'manual'
    check (origen in ('manual', 'ia')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checklist_items_licitacion_id_idx on checklist_items (licitacion_id);

create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists indicadores_financieros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  periodo text not null,
  patrimonio numeric,
  capital_trabajo numeric,
  indice_liquidez numeric,
  indice_endeudamiento numeric,
  rentabilidad_patrimonio numeric,
  rentabilidad_activo numeric,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, periodo)
);

create index if not exists indicadores_financieros_empresa_id_idx on indicadores_financieros (empresa_id);

create table if not exists experiencia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  entidad_contratante text not null,
  numero_contrato text,
  objeto text not null,
  sector text,
  valor numeric,
  valor_original numeric,
  moneda_original text,
  valor_smmlv numeric,
  participacion_pct numeric,
  fecha_inicio date,
  fecha_terminacion date,
  estado text default 'ejecutado'
    check (estado in ('ejecutado', 'liquidado', 'en_ejecucion')),
  duracion_meses numeric,
  detalles jsonb,
  origen_archivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists experiencia_empresa_id_idx on experiencia (empresa_id);
create index if not exists experiencia_fecha_terminacion_idx on experiencia (fecha_terminacion);

create table if not exists empresa_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  nombre text not null,
  tipo text not null default 'otro'
    check (tipo in ('rup', 'camara_comercio', 'estados_financieros', 'otro')),
  storage_path text not null,
  tamano_bytes bigint,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists empresa_documentos_empresa_id_idx on empresa_documentos (empresa_id);

create table if not exists experiencia_documentos (
  id uuid primary key default gen_random_uuid(),
  experiencia_id uuid not null references experiencia (id) on delete cascade,
  nombre text not null,
  storage_path text not null,
  tamano_bytes bigint,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists experiencia_documentos_experiencia_id_idx on experiencia_documentos (experiencia_id);

create table if not exists empresa_datos_juridicos (
  empresa_id uuid primary key references empresas (id) on delete cascade,
  representante_legal text,
  tipo_documento_representante text,
  numero_documento_representante text,
  objeto_social text,
  fecha_constitucion date,
  duracion_sociedad text,
  capital_social numeric,
  matricula_mercantil text,
  fecha_ultima_renovacion date,
  clasificacion_rup jsonb,
  experiencia_rup_faltante jsonb,
  modelo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists licitacion_participantes (
  id uuid primary key default gen_random_uuid(),
  licitacion_id uuid not null references licitaciones (id) on delete cascade,
  empresa_id uuid not null references empresas (id) on delete cascade,
  porcentaje_participacion numeric not null default 100,
  created_at timestamptz not null default now(),
  unique (licitacion_id, empresa_id)
);

create index if not exists licitacion_participantes_licitacion_id_idx on licitacion_participantes (licitacion_id);

create table if not exists verificacion_cumplimiento (
  licitacion_id uuid primary key references licitaciones (id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'procesando', 'completado', 'error')),
  resumen text,
  resultados jsonb,
  empresas_evaluadas uuid[],
  error_mensaje text,
  modelo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mantener updated_at al día
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists licitaciones_set_updated_at on licitaciones;
create trigger licitaciones_set_updated_at
  before update on licitaciones
  for each row execute function set_updated_at();

drop trigger if exists analisis_licitacion_set_updated_at on analisis_licitacion;
create trigger analisis_licitacion_set_updated_at
  before update on analisis_licitacion
  for each row execute function set_updated_at();

drop trigger if exists tareas_set_updated_at on tareas;
create trigger tareas_set_updated_at
  before update on tareas
  for each row execute function set_updated_at();

drop trigger if exists checklist_items_set_updated_at on checklist_items;
create trigger checklist_items_set_updated_at
  before update on checklist_items
  for each row execute function set_updated_at();

drop trigger if exists empresas_set_updated_at on empresas;
create trigger empresas_set_updated_at
  before update on empresas
  for each row execute function set_updated_at();

drop trigger if exists entidades_contratantes_set_updated_at on entidades_contratantes;
create trigger entidades_contratantes_set_updated_at
  before update on entidades_contratantes
  for each row execute function set_updated_at();

drop trigger if exists indicadores_financieros_set_updated_at on indicadores_financieros;
create trigger indicadores_financieros_set_updated_at
  before update on indicadores_financieros
  for each row execute function set_updated_at();

drop trigger if exists empresa_datos_juridicos_set_updated_at on empresa_datos_juridicos;
create trigger empresa_datos_juridicos_set_updated_at
  before update on empresa_datos_juridicos
  for each row execute function set_updated_at();

drop trigger if exists experiencia_set_updated_at on experiencia;
create trigger experiencia_set_updated_at
  before update on experiencia
  for each row execute function set_updated_at();

drop trigger if exists verificacion_cumplimiento_set_updated_at on verificacion_cumplimiento;
create trigger verificacion_cumplimiento_set_updated_at
  before update on verificacion_cumplimiento
  for each row execute function set_updated_at();

-- Storage bucket para los documentos de licitaciones
insert into storage.buckets (id, name, public)
values ('licitaciones', 'licitaciones', false)
on conflict (id) do nothing;

-- Storage bucket para los documentos de empresas (RUP, Cámara de Comercio, certificados de experiencia)
insert into storage.buckets (id, name, public)
values ('empresas', 'empresas', false)
on conflict (id) do nothing;

-- Storage bucket para los manuales de contratación de entidades
insert into storage.buckets (id, name, public)
values ('entidades', 'entidades', false)
on conflict (id) do nothing;

-- RLS: habilitar y permitir acceso a usuarios autenticados
alter table licitaciones enable row level security;
alter table documentos enable row level security;
alter table analisis_licitacion enable row level security;
alter table tareas enable row level security;
alter table checklist_items enable row level security;
alter table empresa_documentos enable row level security;
alter table experiencia_documentos enable row level security;
alter table entidades_contratantes enable row level security;
alter table manuales_contratacion enable row level security;
alter table empresas enable row level security;
alter table indicadores_financieros enable row level security;
alter table experiencia enable row level security;
alter table licitacion_participantes enable row level security;
alter table verificacion_cumplimiento enable row level security;
alter table empresa_datos_juridicos enable row level security;

create policy "authenticated read licitaciones" on licitaciones
  for select using (auth.role() = 'authenticated');
create policy "authenticated write licitaciones" on licitaciones
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update licitaciones" on licitaciones
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete licitaciones" on licitaciones
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read documentos" on documentos
  for select using (auth.role() = 'authenticated');
create policy "authenticated write documentos" on documentos
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated delete documentos" on documentos
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read analisis" on analisis_licitacion
  for select using (auth.role() = 'authenticated');
create policy "authenticated write analisis" on analisis_licitacion
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update analisis" on analisis_licitacion
  for update using (auth.role() = 'authenticated');

create policy "authenticated read tareas" on tareas
  for select using (auth.role() = 'authenticated');
create policy "authenticated write tareas" on tareas
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update tareas" on tareas
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete tareas" on tareas
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read checklist" on checklist_items
  for select using (auth.role() = 'authenticated');
create policy "authenticated write checklist" on checklist_items
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update checklist" on checklist_items
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete checklist" on checklist_items
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read empresas" on empresas
  for select using (auth.role() = 'authenticated');
create policy "authenticated write empresas" on empresas
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update empresas" on empresas
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete empresas" on empresas
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read indicadores" on indicadores_financieros
  for select using (auth.role() = 'authenticated');
create policy "authenticated write indicadores" on indicadores_financieros
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update indicadores" on indicadores_financieros
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete indicadores" on indicadores_financieros
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read experiencia" on experiencia
  for select using (auth.role() = 'authenticated');
create policy "authenticated write experiencia" on experiencia
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update experiencia" on experiencia
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete experiencia" on experiencia
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read participantes" on licitacion_participantes
  for select using (auth.role() = 'authenticated');
create policy "authenticated write participantes" on licitacion_participantes
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated delete participantes" on licitacion_participantes
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read verificacion" on verificacion_cumplimiento
  for select using (auth.role() = 'authenticated');
create policy "authenticated write verificacion" on verificacion_cumplimiento
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update verificacion" on verificacion_cumplimiento
  for update using (auth.role() = 'authenticated');

create policy "authenticated read datos_juridicos" on empresa_datos_juridicos
  for select using (auth.role() = 'authenticated');
create policy "authenticated write datos_juridicos" on empresa_datos_juridicos
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update datos_juridicos" on empresa_datos_juridicos
  for update using (auth.role() = 'authenticated');

create policy "authenticated read empresa_documentos" on empresa_documentos
  for select using (auth.role() = 'authenticated');
create policy "authenticated write empresa_documentos" on empresa_documentos
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated delete empresa_documentos" on empresa_documentos
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read experiencia_documentos" on experiencia_documentos
  for select using (auth.role() = 'authenticated');
create policy "authenticated write experiencia_documentos" on experiencia_documentos
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated delete experiencia_documentos" on experiencia_documentos
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read entidades_contratantes" on entidades_contratantes
  for select using (auth.role() = 'authenticated');
create policy "authenticated write entidades_contratantes" on entidades_contratantes
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update entidades_contratantes" on entidades_contratantes
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete entidades_contratantes" on entidades_contratantes
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read manuales_contratacion" on manuales_contratacion
  for select using (auth.role() = 'authenticated');
create policy "authenticated write manuales_contratacion" on manuales_contratacion
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated delete manuales_contratacion" on manuales_contratacion
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read licitaciones storage" on storage.objects
  for select using (bucket_id = 'licitaciones' and auth.role() = 'authenticated');
create policy "authenticated write licitaciones storage" on storage.objects
  for insert with check (bucket_id = 'licitaciones' and auth.role() = 'authenticated');
create policy "authenticated delete licitaciones storage" on storage.objects
  for delete using (bucket_id = 'licitaciones' and auth.role() = 'authenticated');

create policy "authenticated read empresas storage" on storage.objects
  for select using (bucket_id = 'empresas' and auth.role() = 'authenticated');
create policy "authenticated write empresas storage" on storage.objects
  for insert with check (bucket_id = 'empresas' and auth.role() = 'authenticated');
create policy "authenticated delete empresas storage" on storage.objects
  for delete using (bucket_id = 'empresas' and auth.role() = 'authenticated');

create policy "authenticated read entidades storage" on storage.objects
  for select using (bucket_id = 'entidades' and auth.role() = 'authenticated');
create policy "authenticated write entidades storage" on storage.objects
  for insert with check (bucket_id = 'entidades' and auth.role() = 'authenticated');
create policy "authenticated delete entidades storage" on storage.objects
  for delete using (bucket_id = 'entidades' and auth.role() = 'authenticated');

-- Migración: datos contables base para indicadores de consorcios + criterios de puntaje EAAB
alter table indicadores_financieros add column if not exists activo_corriente numeric;
alter table indicadores_financieros add column if not exists pasivo_corriente numeric;
alter table indicadores_financieros add column if not exists activo_total numeric;
alter table indicadores_financieros add column if not exists pasivo_total numeric;
alter table indicadores_financieros add column if not exists utilidad_operacional numeric;
alter table indicadores_financieros add column if not exists gastos_financieros numeric;
alter table indicadores_financieros add column if not exists razon_cobertura_intereses numeric;

alter table empresas add column if not exists registra_obras_inconclusas boolean;
alter table empresas add column if not exists es_empresa_mujeres boolean;

-- Migración: código UNSPSC y consecutivo RUP por contrato de experiencia (Formulario No. 2 EAAB)
alter table experiencia add column if not exists codigo_unspsc text;
alter table experiencia add column if not exists consecutivo_rup text;
