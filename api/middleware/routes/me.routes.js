import express from "express";
import admin from "firebase-admin";

const router = express.Router();

// Middleware: valida Firebase ID token
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token" });

    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// GET /api/me
router.get("/", requireAuth, async (req, res) => {
  try {
    const uid = req.uid;

    const snap = await admin.firestore().collection("users").doc(uid).get();
    const role = snap.exists ? String(snap.data()?.rol || "empleado").toLowerCase() : "empleado";

    return res.json({ uid, role });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

export default router;