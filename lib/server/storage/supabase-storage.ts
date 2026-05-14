const STORAGE_API_PATH = '/storage/v1/object';

type PrivateObjectInput = {
  bucketEnvName: string;
  objectKey: string;
};

type UploadPrivateObjectInput = PrivateObjectInput & {
  body: BodyInit;
  contentType: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} no configurada.`);
  return value;
}

function getSupabaseStorageConfig(bucketEnvName: string) {
  const rawUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const bucket = requiredEnv(bucketEnvName);
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('SUPABASE_URL debe ser una URL absoluta valida.');
  }
  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('SUPABASE_URL debe usar https en produccion.');
  }
  return { baseUrl: url.origin, bucket, serviceRoleKey };
}

function encodeObjectKey(objectKey: string) {
  if (!isSupabaseObjectKey(objectKey)) throw new Error('Ruta de storage invalida.');
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

function objectUrl(input: PrivateObjectInput) {
  const config = getSupabaseStorageConfig(input.bucketEnvName);
  const encodedBucket = encodeURIComponent(config.bucket);
  const encodedKey = encodeObjectKey(input.objectKey);
  return {
    config,
    url: `${config.baseUrl}${STORAGE_API_PATH}/${encodedBucket}/${encodedKey}`,
  };
}

function authHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

async function responseMessage(res: Response, fallback: string) {
  const text = await res.text().catch(() => '');
  return text.trim() ? `${fallback}: ${text.slice(0, 300)}` : fallback;
}

export function isSupabaseObjectKey(value: string | null | undefined) {
  if (!value) return false;
  if (value.includes('://')) return false;
  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.startsWith('./')) return false;
  if (normalized.startsWith('.data/')) return false;
  if (normalized.startsWith('public/uploads/')) return false;
  if (normalized.startsWith('uploads/')) return false;
  const segments = normalized.split('/');
  return segments.length > 1 && segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

export async function uploadPrivateObject(input: UploadPrivateObjectInput) {
  const { config, url } = objectUrl(input);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(config.serviceRoleKey),
      'Content-Type': input.contentType,
      'x-upsert': 'false',
    },
    body: input.body,
  });
  if (!res.ok) {
    throw new Error(await responseMessage(res, 'No pudimos guardar el archivo en Supabase Storage'));
  }
}

export async function downloadPrivateObject(input: PrivateObjectInput) {
  const { config, url } = objectUrl(input);
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(config.serviceRoleKey),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await responseMessage(res, 'No pudimos leer el archivo desde Supabase Storage'));
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function deletePrivateObject(input: PrivateObjectInput) {
  const { config, url } = objectUrl(input);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(config.serviceRoleKey),
  });
  if (res.status === 404) return;
  if (!res.ok) {
    throw new Error(await responseMessage(res, 'No pudimos eliminar el archivo desde Supabase Storage'));
  }
}
