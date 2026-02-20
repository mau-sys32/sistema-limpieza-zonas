// assets/js/firebase/zones.db.js  (REST)
import { Api } from "../api.client.js";

export async function zonesList() {
  const r = await Api.get("/api/zonas");
  return r?.data ?? [];
}

export async function zonesCreate(z) {
  const payload = {
    nombre: (z.nombre || "").trim(),
    area: (z.area || "").trim(),
    frecuencia: (z.frecuencia || "").trim(),
    prioridad: z.prioridad || "Media",
    estado: z.estado || "Pendiente",
    responsableId: z.responsableId ?? null,
    responsableNombre: z.responsableNombre ?? null,
  };

  const r = await Api.post("/api/zonas", payload);
  return r?.data ?? null;
}

export async function zonesUpdate(id, patch) {
  const r = await Api.patch(`/api/zonas/${id}`, patch);
  return r?.data ?? null;
}

export async function zonesDelete(id) {
  const r = await Api.del(`/api/zonas/${id}`);
  return r?.data ?? null;
}
