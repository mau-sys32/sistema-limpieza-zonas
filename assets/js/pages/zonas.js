// assets/js/pages/zonas.js
import { Modal } from "../ui.js";
import { zonesList, zonesCreate, zonesUpdate, zonesDelete } from "../firebase/zones.db.js";
import { tasksList } from "../firebase/tasks.db.js";

export const Zonas = {
  view() {
    return `
      <div class="card section">
        <div class="toolbar">
          <div class="toolbar__left">
            <div>
              <h1 class="h1">Zonas</h1>
              <p class="sub">Alta, edición y listado de zonas.</p>
            </div>
          </div>

          <div class="toolbar__right">
            <input class="input" id="zonaSearch" placeholder="Buscar zona..." />
            <button class="btn btn--primary" id="btnAddZona">+ Zona</button>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Zona</th>
              <th>Área</th>
              <th>Frecuencia</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="zonasRows"></tbody>
        </table>

        <p class="sub" id="zonasMeta" style="margin-top:10px;"></p>
      </div>
    `;
  },

  async mount() {
    const rowsEl = document.getElementById("zonasRows");
    const searchEl = document.getElementById("zonaSearch");
    const metaEl = document.getElementById("zonasMeta");

    let cache = [];
    let tasks = [];
    let zoneState = new Map();

    const normalizeTaskEstado = (s) => {
      const v = (s || "").toLowerCase().trim();
      if (v === "en proceso") return "En proceso";
      if (v === "pendiente") return "Pendiente";
      if (v === "finalizada" || v === "completada") return "Finalizada";
      return "Pendiente";
    };

    const computeZoneEstado = (zoneId) => {
      const zid = String(zoneId || "");
      const list = tasks.filter(t => String(t.zoneId || "") === zid);
      if (!list.length) return null;

      const estados = list.map(t => normalizeTaskEstado(t.estado));
      if (estados.includes("En proceso")) return "En proceso";
      if (estados.includes("Pendiente")) return "Pendiente";
      return "Finalizada";
    };

    const badgeEstado = (s) => {
      if (s === "Finalizada") return `<span class="badge badge--good">Finalizada</span>`;
      if (s === "En proceso") return `<span class="badge badge--warn">En proceso</span>`;
      return `<span class="badge badge--bad">Pendiente</span>`;
    };

    const render = () => {
      const q = (searchEl?.value || "").toLowerCase().trim();

      const data = cache.filter(z =>
        ((z.nombre || "") + " " + (z.area || "")).toLowerCase().includes(q)
      );

      rowsEl.innerHTML = data.length ? data.map(z => {
        const derived = zoneState.get(String(z.id)) || null;
        const estadoShow = derived || (z.estado || "Pendiente");

        return `
          <tr>
            <td><strong>${esc(z.nombre)}</strong></td>
            <td>${esc(z.area)}</td>
            <td>${esc(z.frecuencia)}</td>
            <td>${esc(z.prioridad)}</td>
            <td>${badgeEstado(estadoShow)}</td>
            <td style="text-align:right; display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
              <button class="btn" data-edit="${z.id}">Editar</button>
              <button class="btn" data-del="${z.id}">Eliminar</button>
            </td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="6" class="muted">Sin zonas aún.</td></tr>`;

      metaEl.textContent = `Mostrando ${data.length} zona(s).`;
    };

    async function refresh() {
      metaEl.textContent = "Cargando zonas…";

      cache = await zonesList();
      tasks = await tasksList();

      zoneState = new Map();
      for (const z of cache) {
        const st = computeZoneEstado(z.id);
        if (st) zoneState.set(String(z.id), st);
      }

      render();
    }

    function openCreate() {
      Modal.open({
        title: "Nueva zona",
        body: formHTML(),
        footer: `
          <button class="btn" data-close="1">Cancelar</button>
          <button class="btn btn--primary" id="mzSave">Guardar</button>
        `
      });

      document.getElementById("mzSave")?.addEventListener("click", async () => {
        const zona = readForm();
        if (!zona.nombre) return shake("mzNombre");

        await zonesCreate(zona);
        Modal.close();
        await refresh();
      }, { once: true });
    }

    function openEdit(id) {
      const zid = String(id);
      const z = cache.find(x => String(x.id) === zid);
      if (!z) return;

      Modal.open({
        title: "Editar zona",
        body: formHTML(z),
        footer: `
          <button class="btn" data-close="1">Cerrar</button>
          <button class="btn btn--primary" id="ezSave">Guardar cambios</button>
        `
      });

      document.getElementById("ezSave")?.addEventListener("click", async () => {
        const patch = readForm();
        if (!patch.nombre) return shake("mzNombre");

        await zonesUpdate(zid, patch);
        Modal.close();
        await refresh();
      }, { once: true });
    }

    function openDelete(id) {
      const zid = String(id);

      Modal.open({
        title: "Eliminar zona",
        body: `<p class="sub">¿Seguro que deseas eliminar esta zona? Esta acción no se puede deshacer.</p>`,
        footer: `
          <button class="btn" data-close="1">Cancelar</button>
          <button class="btn btn--primary" id="btnConfirmDel">Eliminar</button>
        `
      });

      document.getElementById("btnConfirmDel")?.addEventListener("click", async () => {
        await zonesDelete(zid);
        Modal.close();
        await refresh();
      }, { once: true });
    }

    document.getElementById("btnAddZona")?.addEventListener("click", openCreate);
    searchEl?.addEventListener("input", render);

    rowsEl.addEventListener("click", (e) => {
      const edit = e.target.closest("button[data-edit]")?.dataset?.edit;
      const del = e.target.closest("button[data-del]")?.dataset?.del;
      if (edit) openEdit(edit);
      if (del) openDelete(del);
    });

    await refresh();
  }
};

function formHTML(z = {}) {
  const prio = z.prioridad || "Media";
  const estado = z.estado || "Pendiente";

  return `
    <div class="kgrid">
      <div class="col-6">
        <div class="field">
          <label class="muted">Nombre *</label>
          <input class="input" id="mzNombre" value="${esc(z.nombre)}" placeholder="Ej. Baños PB" />
        </div>
      </div>

      <div class="col-6">
        <div class="field">
          <label class="muted">Área</label>
          <input class="input" id="mzArea" value="${esc(z.area)}" placeholder="Ej. Planta baja" />
        </div>
      </div>

      <div class="col-6">
        <div class="field">
          <label class="muted">Frecuencia</label>
          <input class="input" id="mzFreq" value="${esc(z.frecuencia)}" placeholder="Ej. diaria" />
        </div>
      </div>

      <div class="col-6">
        <div class="field">
          <label class="muted">Prioridad</label>
          <select class="select" id="mzPrio">
            ${["Alta","Media","Baja"].map(p => `<option ${p===prio?"selected":""}>${p}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="col-6">
        <div class="field">
          <label class="muted">Estado</label>
          <select class="select" id="mzEstado">
            ${["Pendiente","En proceso","Finalizada"].map(s => `<option ${s===estado?"selected":""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>
  `;
}

function readForm() {
  return {
    nombre: document.getElementById("mzNombre")?.value || "",
    area: document.getElementById("mzArea")?.value || "",
    frecuencia: document.getElementById("mzFreq")?.value || "",
    prioridad: document.getElementById("mzPrio")?.value || "Media",
    estado: document.getElementById("mzEstado")?.value || "Pendiente",
  };
}

function shake(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "rgba(239,68,68,.6)";
  el.focus();
  setTimeout(() => (el.style.borderColor = ""), 900);
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
