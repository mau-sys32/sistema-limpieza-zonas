// api/middleware/routes/task.routes.js
import { Router } from "express";
import { db, FieldValue } from "../../firebaseAdmin.js";

const router = Router();
const col = db.collection("tasks");

function normalizeEstado(s) {
  const v = String(s || "").trim();
  const low = v.toLowerCase();

  if (low === "completada" || low === "completado") return "Finalizada";
  if (low === "finalizada" || low === "finalizado") return "Finalizada";
  if (low === "en proceso") return "En proceso";
  if (low === "pendiente") return "Pendiente";

  // si mandan algo raro, default seguro:
  return v ? v : "Pendiente";
}

function pickTask(body = {}) {
  return {
    fecha: String(body.fecha || "").trim(), // yyyy-mm-dd
    employeeId: String(body.employeeId || "").trim(),
    employeeNombre: String(body.employeeNombre || "").trim(),
    employeeCorreo: String(body.employeeCorreo || "").trim(), // opcional (tu front lo manda)
    zoneId: String(body.zoneId || "").trim(),
    zoneNombre: String(body.zoneNombre || "").trim(),
    zoneArea: String(body.zoneArea || "").trim(), // opcional (tu front lo manda)
    prioridad: String(body.prioridad || "Media").trim(),
    estado: normalizeEstado(body.estado || "Pendiente"),
    inicio: body.inicio ?? null,
    fin: body.fin ?? null,
    createdBy: String(body.createdBy || "").trim(), // opcional
  };
}

function validateTask(t) {
  if (!t.fecha) return "fecha requerida";
  if (!t.employeeId) return "employeeId requerido";
  if (!t.zoneId) return "zoneId requerido";
  return null;
}

/**
 * GET /api/tareas
 * filtros opcionales:
 *  - ?fecha=2026-02-18
 *  - ?employeeId=...
 *  - ?zoneId=...
 *
 * Nota: Evitamos combinaciones de where+orderBy que suelen pedir índice compuesto.
 */
router.get("/", async (req, res) => {
  try {
    const { fecha, employeeId, zoneId } = req.query;

    const hasFilters = !!(fecha || employeeId || zoneId);

    let q = col;

    if (fecha) q = q.where("fecha", "==", String(fecha));
    if (employeeId) q = q.where("employeeId", "==", String(employeeId));
    if (zoneId) q = q.where("zoneId", "==", String(zoneId));

    // Solo ordenamos cuando NO hay filtros (menos probabilidad de pedir índice)
    if (!hasFilters) q = q.orderBy("createdAt", "desc");

    const snap = await q.get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Si hay filtros, ordenamos en memoria por fecha desc (para UX)
    if (hasFilters) {
      data.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
    }

    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

// POST /api/tareas
router.post("/", async (req, res) => {
  try {
    const t = pickTask(req.body);
    const err = validateTask(t);
    if (err) return res.status(400).json({ ok: false, error: err });

    const docRef = await col.add({
      ...t,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const createdSnap = await docRef.get();
    res.status(201).json({ ok: true, data: { id: docRef.id, ...createdSnap.data() } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

// PATCH /api/tareas/:id
router.patch("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "tarea no encontrada" });

    const current = snap.data();
    const merged = { ...current, ...req.body };
    const patch = pickTask(merged);

    const err = validateTask(patch);
    if (err) return res.status(400).json({ ok: false, error: err });

    await ref.update({
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const after = await ref.get();
    res.json({ ok: true, data: { id, ...after.data() } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

// DELETE /api/tareas/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "tarea no encontrada" });

    await ref.delete();
    res.status(200).json({ ok: true, data: { id } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

export default router;
