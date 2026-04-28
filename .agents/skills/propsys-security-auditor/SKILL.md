---
name: propsys-security-auditor
description: Auditoría de seguridad general para PropSys, un proyecto Next.js 15 multi-tenant con Postgres real y auth DB-backed. Usar cuando Codex deba revisar riesgos de autenticación, autorización, XSS, validación de inputs, headers, rate limiting, CORS, supply chain y vulnerabilidades comunes del stack sin implementar fixes.
---

# Auditor de seguridad PropSys

## Objetivo

Auditar la seguridad general de PropSys desde Codex sin modificar código. Identificar riesgos reales, priorizarlos y producir un reporte accionable para que el equipo decida qué corregir después.

## Alcance

- Revisar autenticación y sesiones DB-backed.
- Revisar autorización en server actions, APIs, middleware, layouts y componentes server-side.
- Revisar validación y normalización de inputs en rutas, formularios, query params, body payloads y acciones.
- Revisar riesgos de XSS, inyección, CSRF, CORS, headers, cookies y exposición de datos.
- Revisar rate limiting, abuso de endpoints y controles contra automatización.
- Revisar dependencias, configuración del stack y riesgos de supply chain.
- Revisar patrones de seguridad en la arquitectura migrando hacia `lib/features/**`.
- No implementar cambios durante la auditoría.

## Checklist de auditoría

- Confirmar que las rutas protegidas validan usuario autenticado en el servidor.
- Confirmar que la autorización no depende solo de estado de UI, redirects de cliente o datos enviados por el navegador.
- Buscar lecturas o escrituras a Postgres sin control explícito de permisos.
- Verificar que operaciones sensibles validan rol, tenant y propiedad del recurso antes de acceder a datos.
- Revisar uso de cookies, flags `HttpOnly`, `Secure`, `SameSite`, expiración y manejo de sesión.
- Revisar exposición accidental de datos sensibles en responses, logs, errores, metadata y props.
- Revisar endpoints y server actions que aceptan IDs, slugs, filtros, fechas, montos, emails o texto libre.
- Revisar sanitización, encoding y renderizado de HTML, Markdown, rich text o contenido de usuario.
- Buscar `dangerouslySetInnerHTML`, manipulación directa de HTML y escapes incompletos.
- Revisar validación con schemas, tipos estrictos y límites de tamaño para inputs.
- Revisar manejo de errores para evitar filtrado de stack traces, SQL, tokens o detalles internos.
- Revisar headers de seguridad: CSP, HSTS, X-Frame-Options o `frame-ancestors`, Referrer-Policy, Permissions-Policy y X-Content-Type-Options.
- Revisar configuración de CORS y evitar orígenes comodín para endpoints autenticados.
- Revisar si endpoints mutables requieren protección contra CSRF cuando aplique.
- Revisar rate limiting en login, recuperación de cuenta, invitaciones, búsquedas, reportes, exports y endpoints costosos.
- Revisar dependencias directas, lockfile existente, paquetes obsoletos, uso de paquetes poco mantenidos y scripts de instalación riesgosos.
- Revisar que no existan bypasses por rutas dinámicas, handlers duplicados o lógica divergente entre APIs y server actions.
- Revisar que la seguridad sea consistente entre módulos legacy y módulos bajo `lib/features/**`.

## Formato de reporte

Usar este formato:

```markdown
# Auditoría de seguridad PropSys

## Resumen ejecutivo
- Estado general:
- Riesgos críticos:
- Riesgos altos:
- Riesgos medios:
- Riesgos bajos:

## Hallazgos
### [Severidad] Título breve
- Ubicación:
- Evidencia:
- Impacto:
- Escenario de explotación:
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
- No ejecutar fixes, refactors ni cambios de formato.
- No instalar paquetes ni skills externas.
- No crear scripts.
- No tocar runtime, UI, APIs ni `package-lock`.
- Basar cada hallazgo en evidencia concreta del repositorio.
- Evitar recomendaciones genéricas sin relación directa con el código auditado.
- Diferenciar claramente entre hallazgo confirmado, sospecha razonable y pregunta abierta.
- Priorizar riesgos explotables sobre estilo de código.
- Si una revisión requiere ejecutar comandos, pedir autorización explícita o limitarse a lectura estática según la instrucción del usuario.

## Uso esperado

Invocar esta skill cuando el usuario pida una auditoría general de seguridad en PropSys. La salida esperada es un reporte, no un patch. Si se identifican fixes, describirlos como recomendaciones para una tarea posterior y no implementarlos en la misma ejecución.
