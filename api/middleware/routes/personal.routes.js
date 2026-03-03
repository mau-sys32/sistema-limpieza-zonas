// api/middleware/routes/personal.routes.js
import { Router } from "express";
import admin from "firebase-admin";

const router = Router();

// Colección real donde ya tienes tus empleados
const col = admin.firestore().collection("users");

// GET /api/personal  -> lista users
router.get("/", async (req, res) => {
  try {
    const snap = await col.orderBy("nombre", "asc").get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// POST /api/personal  -> crea empleado (ID automático, sin UID)
router.post("/", async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const correo = String(req.body?.correo || "").trim().toLowerCase();
    const rol = String(req.body?.rol || "empleado").trim().toLowerCase();
    const activo = req.body?.activo !== false;

    if (!nombre) return res.status(400).json({ error: "Falta nombre." });
    if (!correo) return res.status(400).json({ error: "Falta correo." });

    const payload = {
      nombre,
      correo,
      rol,
      activo,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await col.add(payload); // ✅ ID automático
    return res.status(201).json({ id: ref.id, ...payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// PATCH /api/personal/:id  -> actualiza
router.patch("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const patch = req.body || {};
    const safe = {};

    if (patch.nombre != null) safe.nombre = String(patch.nombre).trim();
    if (patch.correo != null) safe.correo = String(patch.correo).trim().toLowerCase();
    if (patch.rol != null) safe.rol = String(patch.rol).trim().toLowerCase();
    if (patch.activo != null) safe.activo = !!patch.activo;

    safe.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await col.doc(id).update(safe);
    return res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// DELETE /api/personal/:id  -> elimina
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await col.doc(id).delete();
    return res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;