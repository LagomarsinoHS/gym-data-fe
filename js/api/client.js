import { getToken } from './token.js';

const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:3000'
  : 'https://gym-data-8d3l.onrender.com';

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
    const err = new Error(data.message || `API ${res.status}: ${url.pathname}`);
    err.status = res.status;
    throw err;
  }

  const blob = await res.blob();
  const contentType = res.headers.get('Content-Type') || blob.type || '';
  return {
    blob,
    filename: filenameFromContentDisposition(res.headers.get('Content-Disposition')),
    contentType,
  };
}

function filenameFromContentDisposition(header) {
  if (!header) return null;

  // RFC 5987: filename*=UTF-8''encoded-name
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ''));
    } catch {
      /* ignore malformed encoding */
    }
  }

  // filename="name with spaces.xlsx" or filename=name.xlsx
  const quoted = /filename\s*=\s*"((?:\\.|[^"\\])*)"/i.exec(header);
  if (quoted?.[1]) {
    return quoted[1].replace(/\\"/g, '"').trim();
  }

  const plain = /filename\s*=\s*([^;]+)/i.exec(header);
  return plain?.[1]?.trim().replace(/^"|"$/g, '') || null;
}

function authHeaders(auth) {
  if (!auth) return {};
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function send(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `API ${res.status}: ${url.pathname}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
