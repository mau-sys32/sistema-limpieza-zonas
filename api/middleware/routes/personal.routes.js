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

// POST /api/personal  -> crea empleado
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

    const ref = await col.add(payload);
    return res.status(201).json({ id: ref.id, ...payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

function buildSafePatch(body = {}) {
  const safe = {};

  if (body.nombre != null) safe.nombre = String(body.nombre).trim();
  if (body.correo != null) safe.correo = String(body.correo).trim().toLowerCase();
  if (body.rol != null) safe.rol = String(body.rol).trim().toLowerCase();
  if (body.activo != null) safe.activo = !!body.activo;

  safe.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  return safe;
}

// PATCH /api/personal/:id
router.patch("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const safe = buildSafePatch(req.body);

    await col.doc(id).update(safe);
    return res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// PUT /api/personal/:id
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const safe = buildSafePatch(req.body);

    await col.doc(id).update(safe);
    return res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// DELETE /api/personal/:id
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