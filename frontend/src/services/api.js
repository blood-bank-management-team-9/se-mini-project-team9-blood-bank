/**
 * Centralized API client for the Blood Bank Management System.
 *
 * Strategy: Vite proxy forwards /api → http://localhost:5000 (already in vite.config.js).
 * All URLs are relative (/api/...).
 *
 * For every mutating request (POST/PUT/PATCH/DELETE):
 *   1. GET /api/auth/csrf  → read csrfToken
 *   2. Send request with credentials:'include' + x-csrf-token header
 *
 * GET requests still use credentials:'include' so the session cookie is sent.
 *
 * Error normalization (SAD 4.4):
 *   400  VALIDATION_ERROR → throws { type:'validation', fields:[...], message }
 *   401  UNAUTHENTICATED  → clears auth state (via callback) and throws
 *   403                   → throws { type:'forbidden', message }
 *   409/422/423           → throws { type:'conflict', message, minutesLeft? }
 *   5xx                   → throws { type:'server', message:'Something went wrong, please retry' }
 *   network error         → throws { type:'network', message:'Cannot reach the server' }
 */

let _onUnauthenticated = null;

/** Register a callback that fires when the server returns 401. */
export function setUnauthenticatedCallback(fn) {
  _onUnauthenticated = fn;
}

/** Fetch the current CSRF token from the server. */
async function getCsrfToken() {
  const res = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to get CSRF token');
  const data = await res.json();
  return data.csrfToken;
}

/**
 * Parse the response body and normalize errors into thrown objects.
 * Returns the parsed body on success.
 */
async function handleResponse(res) {
  let body = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON response
  }

  if (res.ok) return body;

  const err = body.error || {};
  const message = err.message || `HTTP ${res.status}`;
  const code = err.code || '';

  if (res.status === 400) {
    const e = new Error(message);
    e.type = 'validation';
    e.fields = err.fields || [];
    e.message = message;
    throw e;
  }
  if (res.status === 401) {
    if (_onUnauthenticated) _onUnauthenticated();
    const e = new Error(message);
    e.type = 'unauthenticated';
    throw e;
  }
  if (res.status === 403) {
    const e = new Error(message);
    e.type = 'forbidden';
    e.code = code;
    throw e;
  }
  if (res.status === 423) {
    const e = new Error(message);
    e.type = 'conflict';
    e.code = code;
    e.minutesLeft = body.minutesLeft ?? err.minutesLeft ?? null;
    throw e;
  }
  if (res.status >= 400 && res.status < 500) {
    const e = new Error(message);
    e.type = 'conflict';
    e.code = code;
    throw e;
  }
  // 5xx
  const e = new Error('Something went wrong, please retry');
  e.type = 'server';
  throw e;
}

/** GET request — credentials only, no CSRF needed. */
export async function apiGet(path) {
  let res;
  try {
    res = await fetch(path, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    const e = new Error('Cannot reach the server');
    e.type = 'network';
    throw e;
  }
  return handleResponse(res);
}

/** POST/PUT/PATCH/DELETE — fetches CSRF token first. */
export async function apiMutate(method, path, body) {
  let csrfToken;
  try {
    csrfToken = await getCsrfToken();
  } catch {
    const e = new Error('Cannot reach the server');
    e.type = 'network';
    throw e;
  }

  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error('Cannot reach the server');
    e.type = 'network';
    throw e;
  }
  return handleResponse(res);
}

export const apiPost   = (path, body) => apiMutate('POST',   path, body);
export const apiPut    = (path, body) => apiMutate('PUT',    path, body);
export const apiPatch  = (path, body) => apiMutate('PATCH',  path, body);
export const apiDelete = (path)       => apiMutate('DELETE', path);

/** Special: GET that returns a Blob (for file downloads). */
export async function apiGetBlob(path) {
  let res;
  try {
    res = await fetch(path, { method: 'GET', credentials: 'include' });
  } catch {
    const e = new Error('Cannot reach the server');
    e.type = 'network';
    throw e;
  }
  if (!res.ok) {
    await handleResponse(res); // will throw
  }
  return res.blob();
}

/** Health check — public, no credentials needed. */
export async function getHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
