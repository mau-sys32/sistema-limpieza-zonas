// assets/js/api.client.js
import { auth } from "./firebase/config.js";

const BASE_URL = "http://localhost:4000";

async function authHeaders() {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }

  if (!res.ok) {
    const msg = (data && typeof data === "object" && data.error)
      ? data.error
      : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export const Api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),

  // helpers (opcional)
  zonesList: () => request("/api/zonas"),
  zonesCreate: (payload) => request("/api/zonas", { method: "POST", body: payload }),
  zonesUpdate: (id, payload) => request(`/api/zonas/${id}`, { method: "PATCH", body: payload }),
  zonesDelete: (id) => request(`/api/zonas/${id}`, { method: "DELETE" }),

  tasksList: () => request("/api/tareas"),
  tasksCreate: (payload) => request("/api/tareas", { method: "POST", body: payload }),
  tasksUpdate: (id, payload) => request(`/api/tareas/${id}`, { method: "PATCH", body: payload }),
  tasksDelete: (id) => request(`/api/tareas/${id}`, { method: "DELETE" }),
};
