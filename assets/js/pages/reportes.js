import { Store } from "../store.js";
import { Modal } from "../ui.js";

export const Reportes = {
  view() {
    return `
      <div class="card section">
        <div class="toolbar">
          <div class="toolbar__left">
            <div>
              <h1 class="h1">Rotación diaria</h1>
              <p class="sub">Asigna automáticamente empleados a zonas para el día de hoy.</p>
            </div>
          </div>

          <div class="toolbar__right">
            <button class="btn" id="btnVerRot">Ver rotación</button>
            <button class="btn btn--primary" id="btnGenRot">Generar rotación de hoy</button>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Zona asignada</th>
            </tr>
          </thead>
          <tbody id="rotRows"></tbody>
        </table>

        <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn--primary" id="btnCrearTareasDia">Crear tareas del día (según rotación)</button>
          <span class="muted" id="rotMeta"></span>
        </div>
      </div>
    `;
  },

  mount() {
    const rowsEl = document.getElementById("rotRows");
    const metaEl = document.getElementById("rotMeta");

    const render = () => {
      const rot = Store.rotacion.getHoy();

      if (!rot) {
        rowsEl.innerHTML = `<tr><td colspan="2" class="muted">No hay rotación generada hoy.</td></tr>`;
        metaEl.textContent = "Genera la rotación para asignar empleados.";
        return;
      }

      rowsEl.innerHTML = rot.asignaciones.map(a => `
        <tr>
          <td><strong>${esc(a.empleado)}</strong></td>
          <td>${esc(a.zona)}</td>
        </tr>
      `).join("");

      metaEl.textContent = `Rotación ${rot.dateKey} · ${rot.asignaciones.length} asignación(es).`;
    };

    document.getElementById("btnGenRot").addEventListener("click", () => {
      const r = Store.rotacion.generarHoy();
      if (!r.ok) {
        Modal.open({
          title: "No se puede generar rotación",
          body: `<p class="sub">${esc(r.msg)}</p>`,
          footer: `<button class="btn" data-close="1">Cerrar</button>`
        });
        return;
      }
      render();
    });

    document.getElementById("btnVerRot").addEventListener("click", render);

    document.getElementById("btnCrearTareasDia").addEventListener("click", () => {
      const rot = Store.rotacion.getHoy();
      if (!rot) {
        Modal.open({
          title: "Sin rotación",
          body: `<p class="sub">Primero genera la rotación de hoy.</p>`,
          footer: `<button class="btn" data-close="1">Cerrar</button>`
        });
        return;
      }

      // crea una tarea por asignación
      const existentes = Store.tareas.list();
      const hoy = rot.dateKey;

      let creadas = 0;

      for (const a of rot.asignaciones) {
const dup = existentes.some(t => {
  const d = (t.fecha || "").slice(0, 10); // YYYY-MM-DD
  return d === hoy && t.responsableId === a.empleadoId && t.zona === a.zona;
});
        if (dup) continue;

        Store.tareas.create({
          zona: a.zona,
          prioridad: "Media",
          responsableId: a.empleadoId,
          responsableNombre: a.empleado,
          fecha: `${hoy}T08:00:00.000Z`
        });

        creadas++;
      }

      Modal.open({
        title: "Tareas del día",
        body: `<p class="sub">Se crearon <strong>${creadas}</strong> tarea(s) según la rotación de hoy.</p>`,
        footer: `<button class="btn btn--primary" data-close="1">Listo</button>`
      });

      render();
    });

    render();
  }
};

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
