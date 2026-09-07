import { getToken } from "@/api/token";

const DEV_API_BASE = "https://gym-data-dev-aunw.onrender.com";
const PROD_API_BASE = "https://gym-data-8d3l.onrender.com";
const DEVELOP_HOST = "steelpulse-git-develop-lagomarsinohs-projects.vercel.app";

export class ApiError extends Error {
  status: number;
  code: string | null;
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const API_BASE = resolveApiBase();
const inflightGets = new Map<string, Promise<Record<string, unknown>>>();

export async function get(
  path: string,
  params: Record<string, string | number | undefined> = {},
  { auth = false } = {},
) {
  const url = new URL(path, API_BASE);

  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const key = `${auth ? "auth" : "anon"}:${url.href}`;
  const pending = inflightGets.get(key);
  if (pending) return pending;

  const request = send(url, { headers: authHeaders(auth) }).finally(() => {
    inflightGets.delete(key);
  });
  inflightGets.set(key, request);
  return request;
}

export async function post(path: string, body: unknown, { auth = false } = {}) {
  return send(new URL(path, API_BASE), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(auth),
    },
    body: JSON.stringify(body),
  });
}

export async function put(path: string, body: unknown, { auth = false } = {}) {
  return send(new URL(path, API_BASE), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(auth),
    },
    body: JSON.stringify(body),
  });
}

export async function patch(path: string, body: unknown, { auth = false } = {}) {
  return send(new URL(path, API_BASE), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(auth),
    },
    body: JSON.stringify(body),
  });
}

export async function del(path: string, body?: unknown, { auth = false } = {}) {
  return send(new URL(path, API_BASE), {
    method: "DELETE",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(auth),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export async function postForm(path: string, body: FormData, { auth = false } = {}) {
  return send(new URL(path, API_BASE), {
    method: "POST",
    headers: authHeaders(auth),
    body,
  });
}

export async function postBinary(
  path: string,
  body: unknown,
  { auth = false } = {},
): Promise<{ blob: Blob; filename: string | null; contentType: string }> {
  const url = new URL(path, API_BASE);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(auth),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw buildApiError(res, url, await parseResponseBody(res));
  }
  const blob = await res.blob();
  return {
    blob,
    filename: filenameFromContentDisposition(res.headers.get("Content-Disposition")),
    contentType: res.headers.get("Content-Type") || blob.type || "",
  };
}

function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim();
  if (fromEnv) return fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`;

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:3000/";
  }
  if (host === DEVELOP_HOST) {
    return `${DEV_API_BASE}/`;
  }
  return `${PROD_API_BASE}/`;
}

function authHeaders(auth: boolean): HeadersInit {
  if (!auth) return {};
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function send(url: URL, options: RequestInit) {
  const res = await fetch(url, options);
  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw buildApiError(res, url, data);
  }
  return data;
}

async function parseResponseBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildApiError(res: Response, url: URL, data: Record<string, unknown>): ApiError {
  const rawMessage = data["message"];
  let message = `API ${res.status}: ${url.pathname}`;

  if (typeof rawMessage === "string" && rawMessage.trim()) {
    message = rawMessage.trim();
  } else if (Array.isArray(rawMessage)) {
    message = rawMessage.filter(Boolean).join(" ");
  }

  const code = typeof data["code"] === "string" ? data["code"] : null;
  const details =
    data["details"] && typeof data["details"] === "object"
      ? (data["details"] as Record<string, unknown>)
      : null;

  return new ApiError(message, res.status, code, details);
}

function filenameFromContentDisposition(header: string | null) {
  const match = /filename="([^"]+)"/i.exec(header || "");
  return match?.[1]?.trim() || null;
}
