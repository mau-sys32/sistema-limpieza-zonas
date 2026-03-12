import { Router } from "express";
import admin from "firebase-admin";
import { db, FieldValue } from "../../firebaseAdmin.js";

const router = Router();

const col = db.collection("tasks");
const usersCol = db.collection("users");
const reportsCol = db.collection("reports");
const notificationsCol = db.collection("notifications");

/* =========================
   AUTH + ROLE
========================= */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "No token" });
    }

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
      ? String(snap.data()?.rol || snap.data()?.role || "empleado").toLowerCase()
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

// Todas las rutas requieren auth + role
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

  return v || "Pendiente";
}

function pickTask(body = {}) {
  return {
    fecha: String(body.fecha || "").trim(),
    employeeId: String(body.employeeId || "").trim(),
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

async function createInternalNotification({
  audienceTags,
  title,
  body,
  route = "/tareas",
  type = "general",
  taskId = null,
  reportId = null,
  extra = {},
}) {
  if (!Array.isArray(audienceTags) || audienceTags.length === 0) return null;

  const docRef = await notificationsCol.add({
    audienceTags,
    title,
    body,
    type,
    route,
    taskId,
    reportId,
    readBy: [],
    createdAt: FieldValue.serverTimestamp(),
    ...extra,
  });

  return docRef.id;
}

async function sendPushToUser({
  employeeId,
  title,
  body,
  route = "/tareas",
  taskId = "",
  extraData = {},
}) {
  try {
    console.log("[FCM] employeeId recibido:", employeeId);

    if (!employeeId) {
      console.log("[FCM] employeeId vacío");
      return { sent: false, reason: "employeeId vacío" };
    }

    const userSnap = await usersCol.doc(employeeId).get();

    if (!userSnap.exists) {
      console.log("[FCM] usuario no encontrado:", employeeId);
      return { sent: false, reason: "usuario no encontrado" };
    }

    const userData = userSnap.data() || {};
    const token = String(userData.fcmToken || "").trim();

    console.log("[FCM] userData:", {
      id: employeeId,
      nombre: userData.nombre,
      rol: userData.rol || userData.role,
      hasToken: !!token,
      tokenPreview: token ? `${token.slice(0, 25)}...` : "",
    });

    if (!token) {
      console.log("[FCM] usuario sin token");
      return { sent: false, reason: "usuario sin fcmToken" };
    }

    const message = {
      token,
      notification: {
        title,
        body,
      },
      data: {
        route: String(route),
        taskId: String(taskId || ""),
        title: String(title),
        body: String(body),
        ...Object.fromEntries(
          Object.entries(extraData).map(([k, v]) => [k, String(v ?? "")])
        ),
      },
      android: {
        priority: "high",
        notification: {
          channelId: "cleaning_app_high",
        },
      },
    };

    console.log("[FCM] enviando mensaje:", JSON.stringify(message, null, 2));

    const result = await admin.messaging().send(message);

    console.log("[FCM] enviado ok:", result);

    return { sent: true, result };
  } catch (error) {
    console.error("[FCM] ERROR REAL:", error);
    return { sent: false, reason: error.message || "error enviando push" };
  }
}

async function getManagers() {
  const result = [];

  for (const roleValue of ["admin", "supervisor"]) {
    const snap = await usersCol.where("rol", "==", roleValue).get();

    snap.forEach((doc) => {
      result.push({
        id: doc.id,
        ...doc.data(),
      });
    });
  }

  return result;
}

async function notifyManagers({
  title,
  body,
  route = "/reportes",
  type = "general_manager_alert",
  taskId = null,
  reportId = null,
  extra = {},
}) {
  const notificationId = await createInternalNotification({
    audienceTags: ["role:admin", "role:supervisor"],
    title,
    body,
    route,
    type,
    taskId,
    reportId,
    extra,
  });

  const managers = await getManagers();

  const pushResults = [];

  for (const manager of managers) {
    const token = String(manager.fcmToken || "").trim();
    if (!token) {
      pushResults.push({
        managerId: manager.id,
        sent: false,
        reason: "sin token",
      });
      continue;
    }

    try {
      const message = {
        token,
        notification: {
          title,
          body,
        },
        data: {
          route: String(route),
          taskId: String(taskId || ""),
          reportId: String(reportId || ""),
          type: String(type),
          ...Object.fromEntries(
            Object.entries(extra).map(([k, v]) => [k, String(v ?? "")])
          ),
        },
        android: {
          priority: "high",
          notification: {
            channelId: "cleaning_app_high",
          },
        },
      };

      const result = await admin.messaging().send(message);

      pushResults.push({
        managerId: manager.id,
        sent: true,
        result,
      });
    } catch (error) {
      console.error("[FCM][MANAGERS] error:", error);
      pushResults.push({
        managerId: manager.id,
        sent: false,
        reason: error.message || "error enviando push",
      });
    }
  }

  return {
    notificationId,
    pushes: pushResults,
  };
}

/* =========================
   GET /api/tareas
========================= */
router.get("/", async (req, res) => {
  try {
    const { fecha, employeeId, zoneId } = req.query;

    const isManager = isManagerRole(req.role);

    let q = col;

    if (!isManager) {
      q = q.where("employeeId", "==", req.uid);
    } else {
      if (employeeId) q = q.where("employeeId", "==", String(employeeId));
    }

    if (fecha) q = q.where("fecha", "==", String(fecha));
    if (zoneId) q = q.where("zoneId", "==", String(zoneId));

    const snap = await q.get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    data.sort((a, b) => {
      const fa = String(a.fecha || "");
      const fb = String(b.fecha || "");
      if (fa !== fb) return fb.localeCompare(fa);
      return String(b.id).localeCompare(String(a.id));
    });

    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

/* =========================
   GET /api/tareas/mias
========================= */
router.get("/mias", async (req, res) => {
  try {
    const snap = await col.where("employeeId", "==", req.uid).get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    data.sort((a, b) => {
      const fa = String(a.fecha || "");
      const fb = String(b.fecha || "");
      if (fa !== fb) return fb.localeCompare(fa);
      return String(b.id).localeCompare(String(a.id));
    });

    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

/* =========================
   POST /api/tareas
   SOLO admin/supervisor
========================= */
router.post("/", requireRole(["admin", "supervisor"]), async (req, res) => {
  try {
    const t = pickTask({
      ...req.body,
      createdBy: req.uid,
    });

    const err = validateTask(t);
    if (err) {
      return res.status(400).json({ ok: false, error: err });
    }

    const docRef = await col.add({
      ...t,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const taskId = docRef.id;

    const notifTitle = "Nueva tarea asignada";
    const notifBody = t.zoneNombre
      ? `Se te asignó una tarea en ${t.zoneNombre}`
      : "Se te asignó una nueva tarea";

    let notificationId = null;

    try {
      notificationId = await createInternalNotification({
        audienceTags: [`user:${t.employeeId}`, "role:empleado"],
        title: notifTitle,
        body: notifBody,
        route: "/tareas",
        type: "task_assigned",
        taskId,
        extra: {
          zoneId: t.zoneId,
          zoneNombre: t.zoneNombre,
          prioridad: t.prioridad,
          createdBy: req.uid,
        },
      });

      console.log("[TASKS][POST] notificación creada:", notificationId);
    } catch (notifError) {
      console.error("[TASKS][POST] error guardando notificación:", notifError);
    }

    const pushResult = await sendPushToUser({
      employeeId: t.employeeId,
      title: notifTitle,
      body: notifBody,
      route: "/tareas",
      taskId,
      extraData: {
        zoneId: t.zoneId,
        zoneNombre: t.zoneNombre,
        prioridad: t.prioridad,
        type: "task_assigned",
      },
    });

    const createdSnap = await docRef.get();

    res.status(201).json({
      ok: true,
      data: {
        id: taskId,
        ...createdSnap.data(),
      },
      notification: {
        created: Boolean(notificationId),
        id: notificationId || null,
      },
      push: pushResult,
    });
  } catch (e) {
    console.error("[TASKS][POST] Error:", e);
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

/* =========================
   PATCH /api/tareas/:id
   SOLO admin/supervisor
========================= */
router.patch("/:id", requireRole(["admin", "supervisor"]), async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "tarea no encontrada" });
    }

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
   SOLO admin/supervisor
========================= */
router.delete("/:id", requireRole(["admin", "supervisor"]), async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "tarea no encontrada" });
    }

    await ref.delete();
    res.status(200).json({ ok: true, data: { id } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

/* =========================
   EMPLEADO: start / finish
========================= */
router.post("/:id/start", async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "tarea no encontrada" });
    }

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

    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "tarea no encontrada" });
    }

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
   EMPLEADO: evidencia
   -> notifica admin/supervisor
========================= */
router.post("/:id/evidence", async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = col.doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "tarea no encontrada" });
    }

    const task = snap.data();
    if (!ensureOwnTaskOrManager(task, req)) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    const comment = String(req.body?.comment || "").trim();
    const imageUrl = String(req.body?.imageUrl || "").trim();

    if (!comment) {
      return res.status(400).json({ ok: false, error: "comment requerido" });
    }

    const evRef = await ref.collection("evidences").add({
      uid: req.uid,
      role: req.role,
      comment,
      imageUrl,
      createdAt: FieldValue.serverTimestamp(),
    });

    await ref.update({
      lastEvidence: {
        uid: req.uid,
        role: req.role,
        comment,
        imageUrl,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    const reportDoc = {
      createdAt: FieldValue.serverTimestamp(),
      employeeId: String(task?.employeeId || req.uid),
      employeeNombre: String(task?.employeeNombre || "Empleado"),
      taskId: id,
      zoneId: String(task?.zoneId || ""),
      zoneNombre: String(task?.zoneNombre || ""),
      observaciones: comment,
      photoURL: imageUrl,
      status: "pendiente",
      source: "mobile-evidence",
      evidenceId: evRef.id,
    };

    const repRef = await reportsCol.add(reportDoc);

    const managerTitle = "Nueva evidencia recibida";
    const managerBody = task?.zoneNombre
      ? `${task.employeeNombre || "Un empleado"} subió evidencia en ${task.zoneNombre}`
      : `${task.employeeNombre || "Un empleado"} subió evidencia de una tarea`;

    const managerNotifyResult = await notifyManagers({
      title: managerTitle,
      body: managerBody,
      route: "/reportes",
      type: "task_evidence",
      taskId: id,
      reportId: repRef.id,
      extra: {
        employeeId: String(task?.employeeId || req.uid),
        employeeNombre: String(task?.employeeNombre || "Empleado"),
        zoneId: String(task?.zoneId || ""),
        zoneNombre: String(task?.zoneNombre || ""),
        evidenceId: evRef.id,
      },
    });

    return res.status(201).json({
      ok: true,
      data: {
        taskId: id,
        evidenceId: evRef.id,
        reportId: repRef.id,
        saved: true,
      },
      managerNotification: managerNotifyResult,
    });
  } catch (e) {
    console.error("[TASKS][EVIDENCE] Error:", e);
    res.status(500).json({ ok: false, error: e.message || "error" });
  }
});

export default router;