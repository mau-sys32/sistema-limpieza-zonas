// js/firebase/personal.db.js (REST)
import { Api } from "../api.client.js";

export async function personalList() {
  const r = await Api.get("/api/personal");
  return r?.data || [];
}

export async function personalCreate(emp) {
  const r = await Api.post("/api/personal", {
    nombre: (emp.nombre || "").trim(),
    correo: (emp.correo || "").trim().toLowerCase(),
    rol: emp.rol || "empleado",
    activo: emp.activo ?? true
  });
  return r?.data;
}

export async function personalUpdate(id, patch) {
  const r = await Api.patch(`/api/personal/${id}`, patch);
  return r?.data;
}

export async function personalDelete(id) {
  const r = await Api.del(`/api/personal/${id}`);
  return r?.data;
}
