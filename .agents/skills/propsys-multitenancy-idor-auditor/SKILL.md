---
name: propsys-multitenancy-idor-auditor
description: Auditoría de multi-tenancy e IDOR para PropSys. Usar cuando Codex deba revisar aislamiento por tenant, clientId, buildingId, unitId, filtros de acceso, rutas dinámicas, server actions, APIs y acceso cruzado entre clientes sin implementar fixes.
---

# Auditor de multi-tenancy e IDOR PropSys

## Objetivo

Auditar riesgos de aislamiento multi-tenant e IDOR en PropSys sin modificar código. Confirmar que cada acceso a datos esté limitado al tenant y a los permisos del usuario autenticado, especialmente en operaciones basadas en IDs.

## Alcance

- Revisar uso de `clientId`, `buildingId`, `unitId` y otros identificadores de dominio.
- Revisar queries a Postgres y filtros por tenant.
- Revisar server actions, route handlers, API endpoints, páginas dinámicas y loaders server-side.
- Revisar autorización para lectura, creación, actualización, eliminación, exports y búsquedas.
- Revisar acceso cruzado entre clientes, edificios, unidades, usuarios, propietarios, residentes y administradores.
- Revisar arquitectura legacy y módulos en migración hacia `lib/features/**`.
- Revisar discrepancias entre autorización de UI y autorización de servidor.
- No implementar fixes durante la auditoría.

## Checklist de auditoría

- Identificar puntos de entrada que aceptan IDs desde URL, query params, body, form data o server actions.
- Verificar que cada `clientId` provenga de una fuente confiable o se derive del usuario autenticado cuando aplique.
- Confirmar que `buildingId` se valida contra el `clientId` autorizado.
- Confirmar que `unitId` se valida contra su `buildingId` y contra el `clientId` autorizado.
- Revisar que los filtros por tenant estén presentes en todas las queries sensibles.
- Buscar queries por ID único sin join o condición adicional de tenant.
- Buscar endpoints que retornan recursos por ID sin comprobar pertenencia.
- Buscar updates o deletes que filtran solo por ID y no por tenant.
- Revisar listados, búsquedas, paginación, exports y reportes por filtrado incompleto.
- Revisar rutas dinámicas como `[id]`, `[clientId]`, `[buildingId]`, `[unitId]`, `[slug]` y combinaciones anidadas.
- Revisar server actions que reciben IDs desde formularios ocultos o payloads manipulables.
- Revisar APIs mutables para evitar que un usuario cambie IDs en el request y afecte otro tenant.
- Revisar que los roles se evalúen dentro del contexto del tenant correcto.
- Revisar que administradores de un cliente no accedan a datos de otro cliente.
- Revisar que propietarios o residentes solo vean unidades y datos asociados.
- Revisar caches, revalidación, tags, `unstable_cache`, metadata y datos serializados para evitar mezcla entre tenants.
- Revisar componentes server-side que cargan datos antes de verificar autorización.
- Revisar rutas de error o fallback que puedan revelar existencia de recursos de otro tenant.
- Revisar consistencia entre módulos legacy y `lib/features/**`.

## Formato de reporte

Usar este formato:

```markdown
# Auditoría multi-tenant e IDOR PropSys

## Resumen ejecutivo
- Estado general del aislamiento:
- Riesgos críticos:
- Riesgos altos:
- Superficies más sensibles:

## Mapa de superficies revisadas
- Superficie:
- IDs aceptados:
- Control de tenant observado:
- Riesgo:

## Hallazgos
### [Severidad] Título breve
- Ubicación:
- Identificadores involucrados:
- Evidencia:
- Impacto:
- Escenario de acceso cruzado:
- Recomendación:
- Prioridad sugerida:

## Controles revisados sin hallazgos
- Control:
- Evidencia:

## Supuestos y límites
- Supuesto:
- Límite:

## Siguientes pasos sugeridos
- Acción:
```

Severidades permitidas: `Crítica`, `Alta`, `Media`, `Baja`, `Informativa`.

## Reglas

- No modificar archivos durante la auditoría.
- No ejecutar fixes, migraciones, refactors ni cambios de formato.
- No crear scripts.
- No tocar runtime, UI, APIs ni `package-lock`.
- No asumir aislamiento por convención de nombres; exigir evidencia en queries o checks server-side.
- No considerar suficiente una validación hecha solo en cliente.
- Tratar cualquier ID recibido del usuario como manipulable.
- Marcar como riesgo alto o crítico cualquier operación que permita lectura o escritura cross-tenant confirmada.
- Diferenciar ausencia de evidencia de ausencia de vulnerabilidad.
- Reportar rutas y funciones concretas para que el fix posterior sea localizable.

## Uso esperado

Invocar esta skill cuando el usuario pida revisar aislamiento por tenant, IDOR, acceso cruzado, permisos por `clientId`, `buildingId` o `unitId`, o seguridad de rutas dinámicas en PropSys. La salida esperada es un reporte de auditoría, no cambios de código.
