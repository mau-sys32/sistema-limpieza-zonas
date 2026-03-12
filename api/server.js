// api/server.js
import express from "express";
import cors from "cors";

import meRouter from "./middleware/routes/me.routes.js";
import zonesRouter from "./middleware/routes/zones.routes.js";
import tasksRouter from "./middleware/routes/task.routes.js";
import personalRouter from "./middleware/routes/personal.routes.js";
import reportesPublicosRouter from "./middleware/routes/reportes_publicos.routes.js";

import admin from "firebase-admin";
import "./firebaseAdmin.js";

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
}));
app.options("*", cors());

app.use(express.json());

// healthcheck
app.get("/", (req, res) => res.send("API OK"));

// prefijo REST
app.use("/api/me", meRouter);
app.use("/api/zonas", zonesRouter);
app.use("/api/tareas", tasksRouter);
app.use("/api/personal", personalRouter);
app.use("/api/reportes-publicos", reportesPublicosRouter);

// debug firebase users
app.get("/api/debug/users", async (req, res) => {
  try {
    const snap = await admin.firestore().collection("users").get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// debug rutas
app.get("/__routes", (req, res) => {
  res.json({
    ok: true,
    routes: [
      "GET  /",
      "GET  /api/me",
      "GET  /api/zonas",
      "POST /api/zonas",
      "PUT  /api/zonas/:id",
      "DELETE /api/zonas/:id",
      "GET  /api/tareas",
      "POST /api/tareas",
      "PATCH /api/tareas/:id",
      "DELETE /api/tareas/:id",
      "GET  /api/personal",
      "POST /api/personal",
      "PATCH /api/personal/:id",
      "DELETE /api/personal/:id",
      "POST /api/reportes-publicos",
      "POST /api/reportes-publicos/photo",
    ],
  });
});

app.get("/api/debug/auth-header", (req, res) => {
  res.json({
    hasAuth: !!req.headers.authorization,
    authorizationPreview: (req.headers.authorization || "").slice(0, 25),
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API corriendo en puerto ${PORT}`);
});