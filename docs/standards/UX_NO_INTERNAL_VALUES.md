# Regla Obligatoria de UX: No mostrar valores internos al usuario

Nunca mostrar valores internos de base de datos, enums, keys técnicas o slugs directamente en la interfaz visible para el usuario final.

## Ejemplos prohibidos

* `anios`
* `tipo_text`
* `brand_color_text`
* `recurrencia_unidad_text`
* `owner`
* `pending` o `PENDING`
* `LOW`, `MEDIUM`, `HIGH`
* UUIDs, IDs técnicos (ej. `inc_1234`) o claves internas cuando exista un nombre o título legible.

Todo valor interno debe pasar por un formatter/helper antes de renderizarse en la UI.

## Ejemplos correctos

* `anios` → `Años`
* `dias` → `Días`
* `semanas` → `Semanas`
* `meses` → `Meses`
* `dni` → `DNI`
* `ce` → `CE`
* `pasaporte` → `Pasaporte`
* `ruc` → `RUC`
* `PENDING` → `Pendiente`
* `RESOLVED` → `Completado` o `Resuelto`
* `OWNER` → `Propietario`

## Regla práctica

Si un valor puede ser visible por el usuario en labels, selects, cards, tablas, badges, placeholders, botones, mensajes, toasts, previews o historial, **debe mostrarse con texto humano, consistente y correctamente capitalizado**.

Además, cuidar singular/plural:
* `Cada 1 mes`, no `Cada 1 meses`
* `Cada 1 año`, no `Cada 1 años`
* `Cada 2 meses`
* `Cada 2 años`

## Checklist antes de cerrar una tarea de UI

- [ ] Los enums de la BD se mapean a texto legible mediante helpers (ej. `labelIncidentStatus`).
- [ ] No se están renderizando claves foráneas (`building_id`) si se puede obtener el nombre (`building_name`).
- [ ] La capitalización es consistente en los badges (ej. 'En progreso' vs 'En Progreso').
- [ ] Los plurales condicionales están correctamente implementados.
