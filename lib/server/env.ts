export function validateEnv() {
  if (process.env.NODE_ENV !== 'production') {
    return; // En desarrollo/test no debe fallar por ausencia de variables de producción
  }

  const errors: string[] = [];

  if (process.env.PROPSYS_EXPOSE_AUTH_TOKENS === '1') {
    errors.push('PROPSYS_EXPOSE_AUTH_TOKENS no puede ser "1" en producción.');
  }

  if (process.env.ALLOW_MOCK_MODE === '1') {
    errors.push('ALLOW_MOCK_MODE no puede ser "1" en producción.');
  }

  if (process.env.DATA_MODE && process.env.DATA_MODE !== 'db') {
    errors.push('DATA_MODE debe ser "db" en producción.');
  }

  if (process.env.NEXT_PUBLIC_DATA_MODE && process.env.NEXT_PUBLIC_DATA_MODE !== 'db') {
    errors.push('NEXT_PUBLIC_DATA_MODE debe ser "db" en producción.');
  }

  const requiredKeys = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_STORAGE_EVIDENCE_BUCKET',
    'SUPABASE_STORAGE_PAYMENT_PROOFS_BUCKET',
  ];

  for (const key of requiredKeys) {
    if (!process.env[key] || process.env[key]?.trim() === '') {
      errors.push(`${key} debe existir en producción.`);
    }
  }

  if (errors.length > 0) {
    throw new Error('Validación de entorno falló en producción:\n- ' + errors.join('\n- '));
  }
}

// Ejecutar automáticamente al importar
validateEnv();
