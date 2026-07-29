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
