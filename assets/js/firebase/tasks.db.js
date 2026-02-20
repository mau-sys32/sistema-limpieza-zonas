// assets/js/firebase/tasks.db.js  (REST)
import { Api } from "../api.client.js";

export async function tasksList() {
  const r = await Api.get("/api/tareas");
  return r?.data ?? [];
}

export async function tasksCreate(payload) {
  const r = await Api.post("/api/tareas", payload);
  return r?.data ?? null;
}

export async function tasksUpdate(id, patch) {
  const r = await Api.patch(`/api/tareas/${id}`, patch);
  return r?.data ?? null;
}

export async function tasksDelete(id) {
  const r = await Api.del(`/api/tareas/${id}`);
  return r?.data ?? null;
}
