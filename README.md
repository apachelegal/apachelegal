# ApacheLegal

Aplicación interna para gestionar procesos de licitación pública en Colombia: desde el análisis del pliego con IA hasta la verificación de si las empresas de la firma cumplen los requisitos habilitantes, pasando por cronograma, checklist de documentos y armado del paquete de presentación.

**Producción:** https://apache-legal.vercel.app (requiere inicio de sesión, sin registro público).

## Módulos

- **Licitaciones** — ficha por proceso (entidad, objeto, presupuesto, fechas, estado), documentos, participantes y notas.
- **Análisis IA del pliego** — sube el pliego y sus anexos en PDF; la IA extrae resumen, requisitos jurídicos/financieros/técnicos, anexos exigidos y fechas clave. Si la licitación está vinculada a una entidad con manual de contratación cargado, ese manual se incluye automáticamente como contexto.
- **Verificación de cumplimiento** — compara los requisitos extraídos del pliego contra los datos reales de la(s) empresa(s) participantes (incluye consorcios/uniones temporales con % de participación) y da un veredicto por requisito: cumple, no cumple, parcial o no determinable.
- **Cronograma y tareas** — genera tareas a partir de las fechas clave detectadas por la IA.
- **Paquete de licitación** — checklist de documentos obligatorios (generado desde los anexos detectados) y descarga en `.zip` de los documentos marcados como propuesta/anexo. *La app nunca inicia sesión ni presenta ofertas en SECOP II/Ariba — eso se hace manualmente.*
- **Empresas** — perfil por empresa: documentos (RUP, Cámara de Comercio, estados financieros), indicadores financieros (incluye valores contables base para calcular correctamente consorcios), experiencia certificada (con extracción asistida por IA desde el RUP) y criterios de puntaje adicional (obras inconclusas, empresa/emprendimiento de mujeres).
- **Entidades contratantes** — catálogo normalizado de entidades (ej. EAAB-ESP) con sus manuales de contratación, reutilizables entre licitaciones.

## Stack técnico

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript
- [Supabase](https://supabase.com) — Postgres, Auth (email/contraseña, un solo usuario) y Storage (buckets privados con URLs firmadas)
- [Anthropic Claude](https://www.anthropic.com) (`claude-sonnet-5`) vía `@anthropic-ai/sdk`, para análisis de pliegos, extracción de datos financieros/jurídicos del RUP y verificación de cumplimiento
- Tailwind CSS v4
- Desplegado en [Vercel](https://vercel.com)

## Desarrollo local

### Variables de entorno

Crear `.env.local` con:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

Todo el acceso a datos usa el cliente con `SUPABASE_SERVICE_ROLE_KEY` (`src/lib/supabase/admin.ts`), ya que la app tiene un único usuario autenticado por sesión de navegador y no hay flujo de auth por-request en el fetch de datos. **Nunca commitear este archivo** (ya está en `.gitignore`).

### Instalar y correr

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). La primera vez, el usuario debe crearse directamente desde el Dashboard de Supabase (Authentication → Users) — no hay registro público en la app.

### Base de datos

El esquema completo (tablas, índices, RLS, buckets de Storage) vive en [`supabase/schema.sql`](supabase/schema.sql), con migraciones incrementales agregadas al final del archivo a medida que crece la app. Ejecutar el contenido en el editor SQL de Supabase (no hay acceso `psql` automatizado desde este repo).

### Comandos

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de producción
npm run start    # servir el build
npm run lint     # eslint
```

## Despliegue

```bash
vercel --prod
```

Las variables de entorno de producción se configuran en el proyecto de Vercel (`vercel env add <NAME> production`), no en este repositorio.

## Nota sobre este repo

Este proyecto usa Next.js 16, cuyas convenciones difieren de versiones anteriores (por ejemplo, `middleware.ts` fue reemplazado por `proxy.ts`). Ver [`AGENTS.md`](AGENTS.md) para más contexto si algo del código parece no coincidir con lo esperado de versiones previas de Next.js.
