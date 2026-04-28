---
name: propsys-secrets-and-env-auditor
description: Auditoría de secretos, variables de entorno y exposición accidental para PropSys. Usar cuando Codex deba revisar .env, NEXT_PUBLIC_*, secrets de CI/CD, claves de Supabase, tokens, credenciales, logs y recomendaciones de rotación sin implementar fixes.
---

# Auditor de secrets y entorno PropSys

## Objetivo

Auditar el manejo de secretos y variables de entorno en PropSys sin modificar archivos. Detectar exposición accidental, configuración insegura y riesgos de rotación para reducir la probabilidad de filtrado de credenciales.

## Alcance

- Revisar referencias a `.env`, `.env.local`, `.env.example`, documentación y configuraciones relacionadas.
- Revisar variables `NEXT_PUBLIC_*` y confirmar que no expongan secretos.
- Revisar uso de claves de Supabase, URLs de base de datos, tokens, API keys, webhooks y credenciales de proveedores.
- Revisar configuración de CI/CD cuando esté presente en el repositorio.
- Revisar exposición de secrets en logs, errores, analytics, telemetry, tests, fixtures y ejemplos.
- Revisar separación entre variables públicas, servidor, build-time y runtime.
- Revisar recomendaciones de rotación cuando exista evidencia de exposición o manejo inseguro.
- No leer ni imprimir valores secretos completos si aparecen en archivos locales.

## Checklist de auditoría

- Identificar archivos de entorno versionados o plantillas de entorno.
- Verificar que `.env*` reales no estén versionados por error.
- Revisar `.gitignore` y reglas equivalentes para evitar commits de secretos.
- Buscar variables con prefijo `NEXT_PUBLIC_*` que contengan tokens, claves privadas, service roles, URLs internas o datos sensibles.
- Diferenciar variables públicas legítimas de secretos server-only.
- Revisar uso de `process.env` en componentes cliente, código compartido y módulos importados por cliente.
- Revisar que claves de Supabase anon/public y service role no estén mezcladas.
- Confirmar que credenciales privilegiadas solo se usen en código server-side.
- Revisar que URLs de Postgres, claves JWT, OAuth secrets, SMTP passwords y webhook secrets no se serialicen al cliente.
- Revisar logs, `console.*`, errores capturados y responses que puedan incluir env vars o tokens.
- Revisar archivos de CI/CD, GitHub Actions u otras pipelines en busca de secrets hardcodeados.
- Revisar scripts de build, deploy y test existentes solo desde lectura estática.
- Revisar documentación, ejemplos y comentarios que puedan contener valores reales.
- Revisar si hay claves con patrones de proveedores conocidos: Supabase, Postgres, Stripe, Resend, SendGrid, AWS, Google, GitHub, Vercel u OAuth.
- Revisar prácticas de fallback inseguras, como secretos por defecto en código.
- Revisar que las recomendaciones distingan entre rotación inmediata, rotación preventiva y limpieza de repositorio.

## Formato de reporte

Usar este formato:

```markdown
# Auditoría de secretos y entorno PropSys

## Resumen ejecutivo
- Estado general:
- Exposición confirmada:
- Riesgos principales:
- Rotación requerida:

## Inventario de variables observadas
- Variable:
- Clasificación: pública | server-only | secreta | desconocida
- Uso observado:
- Riesgo:

## Hallazgos
### [Severidad] Título breve
- Ubicación:
- Evidencia sin revelar el secreto completo:
- Impacto:
- Recomendación:
- Rotación sugerida: inmediata | preventiva | no requerida

## Buenas prácticas ya presentes
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
- No crear, mover ni editar archivos `.env`.
- No imprimir secretos completos en el reporte.
- Mostrar solo prefijos o sufijos mínimos cuando sea necesario para identificar evidencia, por ejemplo `sk_...abcd`.
- No instalar herramientas externas de secret scanning.
- No ejecutar scripts.
- No tocar runtime, UI, APIs ni `package-lock`.
- No asumir que una variable es segura solo por su nombre.
- Tratar `NEXT_PUBLIC_*` como datos públicos visibles por el navegador.
- Tratar claves de service role, URLs directas de Postgres y JWT secrets como secretos críticos.
- Si hay evidencia de exposición pública o commit de secretos, recomendar rotación y revisión del historial Git como tarea posterior.

## Uso esperado

Invocar esta skill cuando el usuario pida revisar secrets, `.env`, variables públicas, configuración de CI/CD o exposición accidental en PropSys. La salida esperada es un reporte seguro que no revele credenciales y que indique qué rotar, qué reclasificar y qué revisar después.
