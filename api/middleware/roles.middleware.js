// api/middleware/roles.middleware.js
import { db } from "../firebaseAdmin.js";

export function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ ok: false, error: "No auth" });

      const snap = await db.collection("users").doc(uid).get();
      if (!snap.exists) return res.status(403).json({ ok: false, error: "Sin perfil" });

      const rol = snap.data().rol;
      if (!roles.includes(rol)) return res.status(403).json({ ok: false, error: "Sin permiso" });

      req.rol = rol;
      next();
    } catch (e) {
      return res.status(500).json({ ok: false, error: "Error rol" });
    }
  };
}
