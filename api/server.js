// api/server.js
import express from "express";
import cors from "cors";

import zonesRouter from "./middleware/routes/zones.routes.js";
import tasksRouter from "./middleware/routes/task.routes.js";

//  import authRouter from "./routes/auth.routes.js";

const app = express();

//  middlewares base
app.use(cors());
app.use(express.json());

//  healthcheck
app.get("/", (req, res) => res.send("API OK 🚀"));

//  prefijo REST
app.use("/api/zonas", zonesRouter);
app.use("/api/tareas", tasksRouter);
// app.use("/api/auth", authRouter); //

//  debug rutas 
app.get("/__routes", (req, res) => {
  res.json({
    ok: true,
    routes: [
      "GET  /",
      "GET  /api/zonas",
      "POST /api/zonas",
      "PUT  /api/zonas/:id",
      "DELETE /api/zonas/:id",
      "GET  /api/tareas",
      "POST /api/tareas",
      "PATCH /api/tareas/:id",
      "DELETE /api/tareas/:id",
    ],
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
