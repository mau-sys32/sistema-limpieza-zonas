// api/middleware/auth.js
import { authAdmin } from "../firebaseAdmin.js";

export async function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const decoded = await authAdmin.verifyIdToken(token);
    req.user = decoded; // uid, email, etc
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
