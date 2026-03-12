import { Router } from "express";
import { db, FieldValue } from "../../firebaseAdmin.js";

const router = Router();

const publicReportsCol = db.collection("reports_public");
const notificationsCol = db.collection("notifications");

/* =========================
   POST /api/reportes-publicos
========================= */
router.post("/", async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const departamento = String(req.body?.departamento || "").trim();
    const zona = String(req.body?.zona || "").trim();
    const comentarios = String(req.body?.comentarios || "").trim();
    const photoURL = String(req.body?.photoURL || "").trim();

    if (!nombre || !comentarios) {
      return res.status(400).json({
        ok: false,
        error: "nombre y comentarios son requeridos",
      });
    }

    const doc = {
      reporterNombre: nombre,
      departamento,
      area: zona,
      comentarios,
      photoUrl: photoURL,
      status: "pendiente",
      source: "quick-report-public",
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await publicReportsCol.add(doc);

    await notificationsCol.add({
      audienceTags: ["role:admin", "role:supervisor"],
      title: "Nuevo reporte recibido",
      body: zona
        ? `${nombre} envió un reporte rápido en ${zona}`
        : `${nombre} envió un reporte rápido`,
      type: "quick_report",
      route: "/reportes",
      reportId: ref.id,
      readBy: [],
      createdAt: FieldValue.serverTimestamp(),
      reporterNombre: nombre,
      area: zona,
      departamento,
      source: "quick-report-public",
    });

    return res.status(201).json({
      ok: true,
      data: {
        id: ref.id,
        ...doc,
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message || "error",
    });
  }
});

/* =========================
   POST /api/reportes-publicos/photo
========================= */
router.post("/photo", async (req, res) => {
  try {
    const photoURL = String(req.body?.photoURL || "").trim();

    return res.status(200).json({
      ok: true,
      photoURL: photoURL || "",
      uploaded: Boolean(photoURL),
      message: photoURL
        ? "photoURL recibida correctamente"
        : "No se recibió photoURL; se continuará sin foto remota",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message || "error",
    });
  }
});

export default router;