// api/middleware/routes/task.routes.js
import { Router } from "express";
import admin from "firebase-admin";
import { db, FieldValue } from "../../firebaseAdmin.js";

const router = Router();

const col = db.collection("tasks");
const usersCol = db.collection("users"); // ✅ ANTES de usarlo
const reportsCol = db.collection("reports");

/* =========================
   AUTH + ROLE
========================= */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, error: "No token" });

    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Token inválido" });
  }
}

async function attachRole(req, res, next) {
  try {
    const snap = await usersCol.doc(req.uid).get();
    req.role = snap.exists
      ? String(snap.data()?.rol || "empleado").toLowerCase()
      : "empleado";
    next();
  } catch (e) {
    return res.status(500).json({ ok: false, error: "No se pudo leer rol" });
  }
}

function requireRole(roles = []) {
  const allowed = roles.map((r) => String(r).toLowerCase());
  return (req, res, next) => {
    const role = String(req.role || "empleado").toLowerCase();
    if (!allowed.includes(role)) {
      console.log("[TASKS] BLOCKED", { role, uid: req.uid });
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }
    console.log("[TASKS] ALLOWED", { role, uid: req.uid });
    next();
  };
}

function isManagerRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "supervisor";
}

function ensureOwnTaskOrManager(task, req) {
  if (isManagerRole(req.role)) return true;
  const employeeId = String(task?.employeeId || "");
  return employeeId && employeeId === req.uid;
}

// ✅ TODAS las rutas requieren auth + role (UNA sola vez)
router.use(requireAuth, attachRole);

/* =========================
   HELPERS
========================= */
function normalizeEstado(s) {
  const v = String(s || "").trim();
  const low = v.toLowerCase();

  if (low === "completada" || low === "completado") return "Finalizada";
  if (low === "finalizada" || low === "finalizado") return "Finalizada";
  if (low === "en proceso" || low === "en_proceso") return "En proceso";
  if (low === "pendiente") return "Pendiente";

  return v ? v : "Pendiente";
}

function pickTask(body = {}) {
  return {
    fecha: String(body.fecha || "").trim(), // yyyy-mm-dd
    employeeId: String(body.employeeId || "").trim(), // UID Firebase del empleado
    employeeNombre: String(body.employeeNombre || "").trim(),
    employeeCorreo: String(body.employeeCorreo || "").trim(),
    zoneId: String(body.zoneId || "").trim(),
    zoneNombre: String(body.zoneNombre || "").trim(),
    zoneArea: String(body.zoneArea || "").trim(),
    prioridad: String(body.prioridad || "Media").trim(),
    estado: normalizeEstado(body.estado || "Pendiente"),
    inicio: body.inicio ?? null,
    fin: body.fin ?? null,
    createdBy: String(body.createdBy || "").trim(),
  };
}

function validateTask(t) {
  if (!t.fecha) return "fecha requerida";
  if (!t.employeeId) return "employeeId requerido";
  if (!t.zoneId) return "zoneId requerido";
  return null;
}

/* =========================
   GET /api/tareas
   - manager: ve todas (con filtros)
   - empleado: SIEMPRE ve solo sus tareas (se fuerza employeeId = uid)
========================= */
router.get("/", async (req, res) => {
  try {
    const { fecha, employeeId, zoneId } = req.query;

    const role = req.role;
    const isManager = isManagerRole(role);

    let q = col;

    // empleado: forzamos sus tareas
    if (!isManager) {
      q = q.where("employeeId", "==", req.uid);
    } else {
      if (employeeId) q = q.where("employeeId", "==", String(employeeId));
    }

    if (fecha) q = q.where("fecha", "==", String(fecha));
    if (zoneId) q = q.where("zoneId", "==", String(zoneId));

    const snap = await q.get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // ✅ orden en memoria (fecha desc; si empata, por id)
    data.sort((a, b) => {
      const fa = String(a.fecha || "");
      const fb = String(b.fecha || "");
      if (fa != fb) return fb.localeCompare(fa);
      return String(b.id).localeCompare(String(a.id));
    });

    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

/* =========================
   GET /api/tareas/mias
   - empleado: sus tareas
   - manager: también puede usarlo (devuelve vacío o sus tareas si fuera empleado)
========================= */
router.get("/mias", async (req, res) => {
  try {
    const snap = await col.where("employeeId", "==", req.uid).get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    data.sort((a, b) => {
      const fa = String(a.fecha || "");
      const fb = String(b.fecha || "");
      if (fa != fb) return fb.localeCompare(fa);
      return String(b.id).localeCompare(String(a.id));
    });

    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

/* =========================
   POST /api/tareas
   ✅ SOLO admin/supervisor
========================= */
router.post("/", requireRole(["admin", "supervisor"]), async (req, res) => {
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

/* =========================
   PATCH /api/tareas/:id
   ✅ SOLO admin/supervisor
========================= */
router.patch("/:id", requireRole(["admin", "supervisor"]), async (req, res) => {
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

/* =========================
   DELETE /api/tareas/:id
   ✅ SOLO admin/supervisor
========================= */
router.delete("/:id", requireRole(["admin", "supervisor"]), async (req, res) => {
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

/* =========================
   EMPLEADO: start/finish
   - empleado solo si la tarea es suya
   - manager también permitido (por si lo ocupas)
========================= */
router.post("/:id/start", async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "tarea no encontrada" });

    const task = snap.data();
    if (!ensureOwnTaskOrManager(task, req)) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    await ref.update({
      estado: "En proceso",
      inicio: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const after = await ref.get();
    res.json({ ok: true, data: { id, ...after.data() } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

router.post("/:id/finish", async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "tarea no encontrada" });

    const task = snap.data();
    if (!ensureOwnTaskOrManager(task, req)) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    await ref.update({
      estado: "Finalizada",
      fin: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const after = await ref.get();
    res.json({ ok: true, data: { id, ...after.data() } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

/* =========================
   EMPLEADO: evidencia (JSON)
   - comment requerido
   - imageUrl opcional (Cloudinary)
   - guarda en subcolección evidences
   - (opcional) guarda última evidencia en el doc de la tarea
========================= */
router.post("/:id/evidence", async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "tarea no encontrada" });

    const task = snap.data();
    if (!ensureOwnTaskOrManager(task, req)) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    const comment = String(req.body?.comment || "").trim();
    const imageUrl = String(req.body?.imageUrl || "").trim(); // Cloudinary secure_url

    if (!comment) return res.status(400).json({ ok: false, error: "comment requerido" });

    // 1) Guardar evidencia en subcolección tasks/{id}/evidences
    const evRef = await ref.collection("evidences").add({
      uid: req.uid,
      role: req.role,
      comment,
      imageUrl,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2) Guardar "última evidencia" en la tarea (opcional pero útil)
    await ref.update({
      lastEvidence: {
        uid: req.uid,
        role: req.role,
        comment,
        imageUrl,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    // ✅ 3) Crear reporte en Firestore (para que aparezca en la WEB y en el módulo Reportes móvil)
    // Mapeo exacto a como tu web crea reports:
    const reportDoc = {
      createdAt: FieldValue.serverTimestamp(),
      employeeId: String(task?.employeeId || req.uid),
      employeeNombre: String(task?.employeeNombre || "Empleado"),
      taskId: id,
      zoneId: String(task?.zoneId || ""),
      zoneNombre: String(task?.zoneNombre || ""),
      observaciones: comment,
      photoURL: imageUrl,       // 👈 tu web usa photoURL
      status: "pendiente",
      source: "mobile-evidence", // opcional para rastrear
      evidenceId: evRef.id,      // opcional
    };

    const repRef = await reportsCol.add(reportDoc);

    return res.status(201).json({
      ok: true,
      data: {
        taskId: id,
        evidenceId: evRef.id,
        reportId: repRef.id,
        saved: true
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

export default router;