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

-- Migración: selección de contratos de experiencia habilitante por licitación (máx. 4 por RUP)
create table if not exists licitacion_experiencia_seleccionada (
  id uuid primary key default gen_random_uuid(),
  licitacion_id uuid not null references licitaciones (id) on delete cascade,
  experiencia_id uuid not null references experiencia (id) on delete cascade,
  justificacion text,
  actividad_acreditada text,
  origen text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (licitacion_id, experiencia_id)
);
create index if not exists licitacion_experiencia_seleccionada_licitacion_idx
  on licitacion_experiencia_seleccionada (licitacion_id);

alter table licitacion_experiencia_seleccionada enable row level security;
create policy "authenticated read licitacion_experiencia_seleccionada" on licitacion_experiencia_seleccionada
  for select using (auth.role() = 'authenticated');
create policy "authenticated write licitacion_experiencia_seleccionada" on licitacion_experiencia_seleccionada
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated delete licitacion_experiencia_seleccionada" on licitacion_experiencia_seleccionada
  for delete using (auth.role() = 'authenticated');

-- Migración: tipo "adenda" para documentos (avisos/adendas que modifican el pliego y sí deben analizarse)
alter table documentos drop constraint if exists documentos_tipo_check;
alter table documentos add constraint documentos_tipo_check
  check (tipo in ('pliego', 'propuesta', 'anexo', 'adenda', 'contrato', 'otro'));

-- Migración: requisitos estructurados genéricos (indicadores financieros por tramos, reglas
-- técnicas) extraídos por IA además de los arrays de texto libre existentes, para poder
-- calificar empresas y consorcios sin recalcular todo a mano.
alter table analisis_licitacion add column if not exists requisitos_financieros_estructurado jsonb;
alter table analisis_licitacion add column if not exists requisitos_tecnicos_estructurado jsonb;

-- Migración: campos de flujo de caja real, para calcular Cobertura de Intereses y Múltiplo de
-- Deuda Neta reales en vez de aproximarlos con utilidad_operacional.
alter table indicadores_financieros add column if not exists efectivo_generado_operacion numeric;
alter table indicadores_financieros add column if not exists efectivo_y_equivalentes numeric;
alter table indicadores_financieros add column if not exists deuda_financiera numeric;

-- Migración: verificación del rol contractual real de la empresa en un contrato de experiencia,
-- contra el certificado PDF adjunto (detecta casos donde el contratista certificado es un
-- tercero distinto de la empresa, o donde la empresa participó como subcontratista/consorciado
-- y no como contratista directo).
alter table experiencia add column if not exists verificacion_titular text
  default 'sin_verificar'
  check (verificacion_titular in ('sin_verificar', 'contratista_directo', 'consorciado', 'subcontratista', 'no_coincide'));
alter table experiencia add column if not exists verificacion_titular_nota text;
alter table experiencia add column if not exists verificacion_titular_fecha timestamptz;
alter table experiencia add column if not exists verificacion_titular_documento_id uuid
  references experiencia_documentos (id) on delete set null;

-- Migración: rol de cada empresa del grupo dentro del negocio — quiénes participan en
-- licitaciones (firman como proponente/consorciado) y quiénes ejecutan la obra una vez
-- adjudicada. No son excluyentes: la misma empresa puede tener ambos roles.
alter table empresas add column if not exists participa_licitaciones boolean not null default true;
alter table empresas add column if not exists ejecuta_obra boolean not null default false;

-- Migración: planta de personal básica por empresa, para poder reportar cabeza de conteo,
-- tipo de vinculación y contratos próximos a vencer (base del reporte laboral).
create table if not exists empleados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  nombre text not null,
  cargo text,
  tipo_contrato text not null default 'termino_fijo'
    check (tipo_contrato in ('termino_fijo', 'termino_indefinido', 'obra_labor', 'prestacion_servicios', 'aprendizaje')),
  salario numeric,
  fecha_ingreso date,
  fecha_salida date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists empleados_empresa_id_idx on empleados (empresa_id);

alter table empleados enable row level security;
create policy "authenticated read empleados" on empleados
  for select using (auth.role() = 'authenticated');
create policy "authenticated write empleados" on empleados
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update empleados" on empleados
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete empleados" on empleados
  for delete using (auth.role() = 'authenticated');

-- Migración: asignación de personal a proyectos/obras con % de dedicación. Nace de que la matriz
-- mínima de personal que exigen entidades como la EAAB se verifica por proyecto, y una misma
-- persona puede estar asignada a más de un proyecto a la vez — lo que hay que vigilar es que la
-- suma de dedicaciones activas de una persona no pase de 100%. licitacion_id es opcional porque
-- una obra en ejecución puede no tener (o ya no tener, si se creó antes de esta app) una fila en
-- licitaciones; en ese caso "proyecto" es el único identificador del proyecto/obra.
create table if not exists asignaciones_personal (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados (id) on delete cascade,
  licitacion_id uuid references licitaciones (id) on delete set null,
  proyecto text not null,
  rol text,
  dedicacion_pct numeric,
  contratado_por text,
  fecha_inicio date,
  fecha_fin date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists asignaciones_personal_empleado_id_idx on asignaciones_personal (empleado_id);
create index if not exists asignaciones_personal_licitacion_id_idx on asignaciones_personal (licitacion_id);

alter table asignaciones_personal enable row level security;
create policy "authenticated read asignaciones_personal" on asignaciones_personal
  for select using (auth.role() = 'authenticated');
create policy "authenticated write asignaciones_personal" on asignaciones_personal
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update asignaciones_personal" on asignaciones_personal
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete asignaciones_personal" on asignaciones_personal
  for delete using (auth.role() = 'authenticated');

-- Distingue empresas propias del grupo de posibles socios externos de consorcio.
alter table empresas add column if not exists categoria text not null default 'grupo'
  check (categoria in ('grupo', 'socio_potencial'));

update empresas set categoria = 'socio_potencial'
where id in (
  '27891099-5896-4d32-ab1a-04d2717a29e3', -- AGAMA SAS
  '010a2b88-0f96-4946-b4dc-1635124bb50f', -- Difusa
  'fa823a0f-5d69-4297-8e2e-71179cc49f1f', -- Polo Asociados Soluciones de Ingeniería S.A.S.
  'd2964d26-4671-4755-8a3d-58f4074dd336'  -- Petro-Ambiental SAS
);

-- Migración: carpeta de habilitación por empresa (jurídica / financiera / técnica).
-- Amplía los tipos de documento de empresa a los que exige la EAAB (RUT, cédula del representante,
-- beneficiario real, parafiscales, REDAM, antecedentes), agrega fechas de expedición y vencimiento
-- para poder alertar qué vence antes de un cierre, y distingue persona natural de jurídica porque
-- cambia la lista de documentos exigidos.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'empresa_documentos'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo%'
  loop
    execute format('alter table empresa_documentos drop constraint %I', c);
  end loop;
end $$;

alter table empresa_documentos add constraint empresa_documentos_tipo_check
  check (tipo in (
    'rup', 'camara_comercio', 'estados_financieros', 'rut', 'cedula_representante',
    'beneficiario_real', 'parafiscales', 'redam', 'antecedentes', 'otro'
  ));

alter table empresa_documentos add column if not exists fecha_expedicion date;
alter table empresa_documentos add column if not exists fecha_vencimiento date;

alter table empresas add column if not exists tipo_persona text not null default 'juridica'
  check (tipo_persona in ('juridica', 'natural'));

update empresas set tipo_persona = 'natural'
where id in (
  'fa88c05d-6954-4a35-8ec4-414aa48edb58', -- Diego Jaramillo Gómez
  '47b866e1-2780-4454-9627-bdd17a92e228'  -- José Isaac Cajigas Castro
);

-- Migración: presupuesto oficial por licitación y catálogo de precios de referencia (SAI de la EAAB).
-- El presupuesto de cada proyecto se guarda ítem por ítem y se compara contra el catálogo de precios
-- de referencia de la entidad, para saber qué ítems tienen precio oficial de referencia, cuáles no
-- (precios propios o no previstos) y dónde se concentra el valor.
create table if not exists precios_referencia (
  id uuid primary key default gen_random_uuid(),
  entidad_id uuid not null references entidades_contratantes (id) on delete cascade,
  catalogo text not null default 'SAI',
  vigencia text not null,
  codigo text not null,
  nombre text not null,
  unidad text,
  precio numeric not null,
  created_at timestamptz not null default now(),
  unique (entidad_id, catalogo, vigencia, codigo)
);
create index if not exists precios_referencia_codigo_idx on precios_referencia (codigo);

create table if not exists presupuesto_items (
  id uuid primary key default gen_random_uuid(),
  licitacion_id uuid not null references licitaciones (id) on delete cascade,
  orden integer not null default 0,
  seccion text not null default 'obra'
    check (seccion in ('obra', 'suministro', 'movilidad', 'otros')),
  capitulo text,
  capitulo_nombre text,
  codigo text,
  descripcion text not null,
  unidad text,
  cantidad numeric,
  precio_unitario numeric,
  total numeric,
  codigo_sae text,
  precio_sae numeric,
  unidad_sae text,
  coincidencia text not null default 'sin_referencia'
    check (coincidencia in ('exacta', 'similar', 'sin_referencia')),
  similitud numeric,
  created_at timestamptz not null default now()
);
create index if not exists presupuesto_items_licitacion_idx on presupuesto_items (licitacion_id, seccion, orden);

create table if not exists presupuesto_resumen (
  licitacion_id uuid primary key references licitaciones (id) on delete cascade,
  fuente text,
  vigencia_precios text,
  resumen jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table precios_referencia enable row level security;
alter table presupuesto_items enable row level security;
alter table presupuesto_resumen enable row level security;

create policy "authenticated read precios_referencia" on precios_referencia
  for select using (auth.role() = 'authenticated');
create policy "authenticated write precios_referencia" on precios_referencia
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated delete precios_referencia" on precios_referencia
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read presupuesto_items" on presupuesto_items
  for select using (auth.role() = 'authenticated');
create policy "authenticated write presupuesto_items" on presupuesto_items
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated delete presupuesto_items" on presupuesto_items
  for delete using (auth.role() = 'authenticated');

create policy "authenticated read presupuesto_resumen" on presupuesto_resumen
  for select using (auth.role() = 'authenticated');
create policy "authenticated write presupuesto_resumen" on presupuesto_resumen
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update presupuesto_resumen" on presupuesto_resumen
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete presupuesto_resumen" on presupuesto_resumen
  for delete using (auth.role() = 'authenticated');

-- Migración: análisis de margen y flujo de caja del presupuesto.
-- Cada ítem puede llevar el costo real del constructor (cotización, subcontrato o estimación) para
-- compararlo con el precio oficial, y cada presupuesto guarda los supuestos del análisis
-- (porcentaje de oferta, AIU ofertado, costos indirectos, plazo, anticipo, retención, financiación).
alter table presupuesto_items add column if not exists costo_unitario numeric;
alter table presupuesto_items add column if not exists costo_fuente text;
alter table presupuesto_items add column if not exists costo_actualizado timestamptz;
alter table presupuesto_resumen add column if not exists supuestos jsonb not null default '{}'::jsonb;

create policy "authenticated update presupuesto_items" on presupuesto_items
  for update using (auth.role() = 'authenticated');

-- Migración: empresas archivadas.
-- Una empresa archivada deja de aparecer en las listas, la habilitación, el panel y el recomendador, pero
-- conserva todos sus datos, documentos y experiencia (y sigue visible donde ya participa en una licitación).
-- A diferencia de eliminarla, se puede restaurar. Conserva su categoría original (grupo / socio potencial).
alter table empresas add column if not exists archivada boolean not null default false;

-- Archiva las cinco empresas que salieron del grupo (6-oct-2026) y les devuelve su categoría original.
update empresas set archivada = true, categoria = 'grupo'
where id in (
  'b7d6e320-8e78-423b-b311-e6d7637bfb73', -- CONINGMA SAS
  '0230c968-cf3e-48b5-9f72-189a3074c06e', -- EPC SAS
  '31039e6b-cd39-438d-bcd0-2a7a1e22cb69', -- I2C Ingeniería S.A.S
  'ba321957-65e1-4afa-ad5a-3ff171f0a767', -- Quantum E&D SAS
  '7f6580c7-5048-4893-acaa-44176c8abe6f'  -- Water Engineering Solutions SAS (WES)
);

-- Migración: control de solicitudes a socios.
-- Registra qué se le pidió a cada empresa o persona natural (documentos de habilitación, certificados de
-- contratos, cantidades de obra), cuándo se envió la solicitud y si ya respondieron. Las solicitudes que genera
-- la app llevan una `clave` (doc:<tipo> o exp:<id>) para no duplicarse al volver a generarlas.
create table if not exists solicitudes_socio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  tipo text not null default 'documento' check (tipo in ('documento', 'certificado', 'otro')),
  clave text,
  titulo text not null,
  detalle text,
  experiencia_id uuid references experiencia (id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviada', 'recibida', 'no_aplica')),
  fecha_envio date,
  fecha_respuesta date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, clave)
);
create index if not exists solicitudes_socio_empresa_idx on solicitudes_socio (empresa_id, estado);

alter table solicitudes_socio enable row level security;
create policy "authenticated read solicitudes_socio" on solicitudes_socio
  for select using (auth.role() = 'authenticated');
create policy "authenticated write solicitudes_socio" on solicitudes_socio
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update solicitudes_socio" on solicitudes_socio
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete solicitudes_socio" on solicitudes_socio
  for delete using (auth.role() = 'authenticated');
