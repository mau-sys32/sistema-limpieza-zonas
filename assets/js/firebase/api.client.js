// assets/js/api.client.js
import { auth } from "./firebase/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const API_BASE = "https://sistema-limpieza-api.onrender.com";

let _authReady = null;
function waitAuthReady() {
  if (_authReady) return _authReady;
  _authReady = new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve(true);
    });
  });
  return _authReady;
}

async function authHeaders() {
  await waitAuthReady();

  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && data.error
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
};

window.Api = Api;