# `lib/features`

Esta carpeta concentra fachadas de datos y UI reusable por pantalla o flujo.

## Regla actual
- Las paginas de `app/(private)/**` no deben importar `@/lib/data`.
- Las paginas deben consumir una fachada de dominio desde `lib/features/**`.
- Cada fachada puede orquestar varios repos, pero los repos se importan por ruta directa, no por barrel.
- Cuando una pantalla tenga mucho markup o widgets de dominio, la UI se mueve a `lib/features/**` para que la pagina quede como shell.

## Patron
- `app/(private)/admin/tasks/page.tsx`
  - consume `lib/features/tasks/task-center.data.ts`
  - monta UI desde `lib/features/tasks/*.ui.tsx`
- `app/(private)/admin/dashboard/page.tsx`
  - consume `lib/features/dashboard/admin-dashboard.data.ts`
  - monta UI desde `lib/features/dashboard/admin-dashboard.ui.tsx`
- `app/(private)/admin/notices/page.tsx`
  - consume `lib/features/notices/notices-center.data.ts`
  - monta UI desde `lib/features/notices/notices-center.ui.tsx`

## Responsabilidades
- `lib/features/**`
  - compone datos para una pantalla o flujo
  - resuelve `Promise.all`, defaults y pequenos mapeos de UI
  - puede exponer componentes, paneles o modales reutilizables del dominio (`*.ui.tsx`)
  - no contiene SQL
- `lib/repos/**`
  - encapsula acceso a datos por dominio
  - mantiene el switch `db` / `mock`
- `lib/server/**`
  - concentra auth, scope, audit, db y helpers server-side

## Criterio practico
- Si una pagina necesita combinar 2 o mas repos, crea o amplia una fachada en `lib/features/**`.
- Si una pagina mezcla carga/estado con mucho markup del dominio, extrae ese markup a `lib/features/**`.
- Si el cambio es puramente de acceso a datos del dominio, va en `lib/repos/**`.
