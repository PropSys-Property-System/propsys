# `lib/features`

Esta carpeta concentra fachadas de datos para pantallas y flujos de UI.

## Regla actual
- Las páginas de `app/(private)/**` no deben importar `@/lib/data`.
- Las páginas deben consumir una fachada de dominio desde `lib/features/**`.
- Cada fachada puede orquestar varios repos, pero los repos se importan por ruta directa, no por barrel.

## Patrón
- `app/(private)/admin/tasks/page.tsx`
  - consume `lib/features/tasks/task-center.data.ts`
- `app/(private)/admin/dashboard/page.tsx`
  - consume `lib/features/dashboard/admin-dashboard.data.ts`
- `app/(private)/admin/notices/page.tsx`
  - consume `lib/features/notices/notices-center.data.ts`

## Responsabilidades
- `lib/features/**`
  - compone datos para una pantalla o flujo
  - resuelve `Promise.all`, defaults y pequeños mapeos de UI
  - no contiene SQL
- `lib/repos/**`
  - encapsula acceso a datos por dominio
  - mantiene el switch `db` / `mock`
- `lib/server/**`
  - concentra auth, scope, audit, db y helpers server-side

## Criterio práctico
- Si una página necesita combinar 2 o más repos, crea o amplía una fachada en `lib/features/**`.
- Si el cambio es puramente de acceso a datos del dominio, va en `lib/repos/**`.
