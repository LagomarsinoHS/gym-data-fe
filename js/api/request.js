import { getToken } from './token.js';

const API_BASE = resolveApiBase();

export async function get(path, params = {}, { auth = false } = {}) {
  const url = new URL(path, API_BASE);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  return send(url, { headers: authHeaders(auth) });
}

export async function post(path, body, { auth = false } = {}) {
  return send(new URL(path, API_BASE), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(auth),
    },
    body: JSON.stringify(body),
  });
}

/** POST multipart/form-data (do not set Content-Type; browser adds boundary). */
export async function postMultipart(path, formData, { auth = false } = {}) {
  return send(new URL(path, API_BASE), {
    method: 'POST',
    headers: {
      ...authHeaders(auth),
    },
    body: formData,
  });
}

export async function put(path, body, { auth = false } = {}) {
  return send(new URL(path, API_BASE), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(auth),
    },
    body: JSON.stringify(body),
  });
}

export async function patch(path, body, { auth = false } = {}) {
  return send(new URL(path, API_BASE), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(auth),
    },
    body: JSON.stringify(body),
  });
}

export async function del(path, body, { auth = false } = {}) {
  return send(new URL(path, API_BASE), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(auth),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

/**
 * POST JSON and return { blob, filename?, contentType } for file downloads.
 * filename comes from Content-Disposition when the API sends it.
 */
export async function postBinary(path, body, { auth = false } = {}) {
  const url = new URL(path, API_BASE);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(auth),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(
      (typeof data?.message === 'string' && data.message) ||
        `API ${res.status}: ${url.pathname}`,
    );
    throw attachApiError(err, res.status, data || {});
  }

  const blob = await res.blob();
  const contentType = res.headers.get('Content-Type') || blob.type || '';
  return {
    blob,
    filename: filenameFromContentDisposition(res.headers.get('Content-Disposition')),
    contentType,
  };
}

/** Nest sends: attachment; filename="Name.xlsx" */
function filenameFromContentDisposition(header) {
  const match = /filename="([^"]+)"/i.exec(header || '');
  return match?.[1]?.trim() || null;
}

function authHeaders(auth) {
  if (!auth) return {};
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Normalize Nest/API error JSON onto the thrown Error:
 * - err.status  — HTTP status
 * - err.code    — stable ApiErrorCode (when present)
 * - err.message — human string (English fallback from API)
 * - err.details — optional payload
 */
function attachApiError(err, status, data) {
  err.status = status;
  err.code = typeof data?.code === 'string' ? data.code : null;
  err.details =
    data?.details && typeof data.details === 'object' ? data.details : null;

  const message = data?.message;
  if (typeof message === 'string' && message.trim()) {
    err.message = message.trim();
  } else if (Array.isArray(message)) {
    err.message = message.filter(Boolean).join(' ');
  }

  return err;
}

async function send(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  if (!res.ok) {
    const err = new Error(
      (typeof data?.message === 'string' && data.message) ||
        `API ${res.status}: ${url.pathname}`,
    );
    throw attachApiError(err, res.status, data || {});
  }
  return data;
}


function resolveApiBase() {
  const host = window.location.hostname;
  console.log('host =>', host);
  const DEV_API_BASE = 'https://gym-data-dev-aunw.onrender.com';
  const PROD_API_BASE = 'https://gym-data-8d3l.onrender.com';

  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  // Preview / rama develop en Vercel
  if (host.includes('develop') || host.includes('-git-develop-')) {
    return DEV_API_BASE;
  }
  return PROD_API_BASE;
}