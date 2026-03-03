// assets/js/api.client.js
import { auth } from "./firebase/config.js";

// 👉 API backend Express
const BASE_URL = "http://localhost:4000";

/* =========================
   HEADERS CON TOKEN FIREBASE
========================= */
async function authHeaders() {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;

    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  } catch (e) {
    console.warn("Token error:", e);
    return { "Content-Type": "application/json" };
  }
}

/* =========================
   REQUEST BASE
========================= */
async function request(path, { method = "GET", body } = {}) {
  const url = `${BASE_URL}${path}`;

  const opts = {
    method,
    headers: await authHeaders(),
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new Error("No se pudo conectar con la API.");
  }

  const ct = res.headers.get("content-type") || "";
  let data;

  try {
    data = ct.includes("application/json")
      ? await res.json()
      : await res.text();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data?.error
        ? data.error
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

/* =========================
   API PUBLICA
========================= */
export const Api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),

  /* ===== ZONAS ===== */
  zonesList: () => request("/api/zonas"),
  zonesCreate: (payload) => request("/api/zonas", { method: "POST", body: payload }),
  zonesUpdate: (id, payload) => request(`/api/zonas/${id}`, { method: "PATCH", body: payload }),
  zonesDelete: (id) => request(`/api/zonas/${id}`, { method: "DELETE" }),

  /* ===== TAREAS ===== */
  tasksList: () => request("/api/tareas"),
  tasksCreate: (payload) => request("/api/tareas", { method: "POST", body: payload }),
  tasksUpdate: (id, payload) => request(`/api/tareas/${id}`, { method: "PATCH", body: payload }),
  tasksDelete: (id) => request(`/api/tareas/${id}`, { method: "DELETE" }),

  /* ===== PERSONAL ===== */
  personalList: () => request("/api/personal"),
  personalCreate: (payload) => request("/api/personal", { method: "POST", body: payload }),
  personalUpdate: (id, payload) => request(`/api/personal/${id}`, { method: "PATCH", body: payload }),
  personalDelete: (id) => request(`/api/personal/${id}`, { method: "DELETE" }),
};