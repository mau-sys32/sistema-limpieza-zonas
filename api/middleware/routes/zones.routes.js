// api/middleware/routes/zones.routes.js
import { Router } from "express";
import { db, FieldValue } from "../../firebaseAdmin.js";
import { requireAuth } from "../auth.middleware.js";
import { requireRole } from "../roles.middleware.js";

const router = Router();
const col = db.collection("zones");

function pickZone(body = {}) {
  return {
    nombre: String(body.nombre || "").trim(),
    area: String(body.area || "").trim(),
    frecuencia: String(body.frecuencia || "").trim(),
    prioridad: String(body.prioridad || "Media").trim(),
    estado: String(body.estado || "Pendiente").trim(),
    responsableId: body.responsableId ?? null,
    responsableNombre: body.responsableNombre ?? null,
  };
}

function validateZone(z) {
  if (!z.nombre) return "nombre requerido";
  return null;
}

// GET /api/zonas  (cualquier usuario logueado)
router.get("/", requireAuth, async (req, res) => {
  try {
    const snap = await col.orderBy("createdAt", "desc").get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

// POST /api/zonas  (solo admin/supervisor)
router.post("/", requireAuth, requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const z = pickZone(req.body);
    const err = validateZone(z);
    if (err) return res.status(400).json({ ok: false, error: err });

    const docRef = await col.add({
      ...z,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const createdSnap = await docRef.get();
    res.status(201).json({ ok: true, data: { id: docRef.id, ...createdSnap.data() } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

// PATCH /api/zonas/:id  (solo admin/supervisor)
router.patch("/:id", requireAuth, requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "zona no encontrada" });

    const current = snap.data();
    const merged = { ...current, ...req.body };
    const patch = pickZone(merged);

    const err = validateZone(patch);
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

// DELETE /api/zonas/:id  (solo admin/supervisor)
router.delete("/:id", requireAuth, requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "zona no encontrada" });

    await ref.delete();
    res.status(200).json({ ok: true, data: { id } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

export default router;
