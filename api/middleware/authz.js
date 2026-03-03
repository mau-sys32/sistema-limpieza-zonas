import admin from "firebase-admin";

export async function requireAuth(req, res, next) {
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

export async function attachRole(req, res, next) {
  try {
    const snap = await admin.firestore().collection("users").doc(req.uid).get();
    req.role = snap.exists ? String(snap.data()?.rol || "empleado").toLowerCase() : "empleado";
    next();
  } catch (e) {
    return res.status(500).json({ error: "No se pudo leer rol" });
  }
}

export function requireRole(roles = []) {
  const allowed = roles.map(r => String(r).toLowerCase());
  return (req, res, next) => {
    const role = String(req.role || "empleado").toLowerCase();
    if (!allowed.includes(role)) return res.status(403).json({ error: "No autorizado" });
    next();
  };
}