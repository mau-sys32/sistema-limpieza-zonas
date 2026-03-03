// assets/js/firebase/personal.db.js (REST)
import { Api } from "../api.client.js";

export async function personalList() {
  // Api.get ya regresa el JSON directamente
  return await Api.get("/api/personal");
}

export async function personalCreate(emp) {
  return await Api.post("/api/personal", {
    nombre: (emp.nombre || "").trim(),
    correo: (emp.correo || "").trim().toLowerCase(),
    rol: emp.rol || "empleado",
    activo: emp.activo ?? true
  });
}

export async function personalUpdate(id, patch) {
  return await Api.patch(`/api/personal/${id}`, patch);
}

export async function personalDelete(id) {
  return await Api.del(`/api/personal/${id}`);
}