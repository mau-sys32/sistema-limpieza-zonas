// assets/js/pages/historial.js
import { db } from "../firebase/config.js";
import { StatusUI } from "../ui.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const Historial = { view, mount };

function view() {
  return `
  <section class="page page--historial">
    <header class="page__header">
      <div>
        <h1>Historial</h1>
        <p class="sub">Consulta de registros (semana, quincena, mes).</p>
      </div>

      <div class="page__actions">
        <select id="hisRange" class="input">
          <option value="7">Semanal</option>
          <option value="15">Quincenal</option>
          <option value="30" selected>Mensual</option>
        </select>

        <input
          id="hisSearch"
          class="input"
          type="search"
          placeholder="Buscar por zona..."
        />

        <button id="hisCsv" class="btn">Exportar CSV</button>
      </div>
    </header>

    <div class="card section">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Zona</th>
              <th>Acción</th>
              <th>Estado</th>
              <th>Tiempo</th>
            </tr>
          </thead>
          <tbody id="hisTbody">
            <tr><td colspan="5" class="muted">Cargando…</td></tr>
          </tbody>
        </table>
      </div>

      <div class="footerline">
        <span id="hisCount" class="count-line">—</span>
      </div>
    </div>
  </section>`;
}

function mount() {
  const tbody = qs("#hisTbody");
  const count = qs("#hisCount");
  const range = qs("#hisRange");
  const search = qs("#hisSearch");
  const btnCsv = qs("#hisCsv");

  let tasks = [];
  let history = [];

  range.addEventListener("change", render);
  search.addEventListener("input", render);
  btnCsv.addEventListener("click", () => exportCSV(filter(tasks)));

  load();

  async function load() {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Cargando…</td></tr>`;

    try {
      // 1) Carga tareas
      const tasksSnap = await getDocs(collection(db, "tasks"));
      tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2) Carga history (para la columna "Acción" / último evento)
      const hisSnap = await getDocs(collection(db, "history"));
      history = hisSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      render();
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Error cargando historial.</td></tr>`;
      count.textContent = `Mostrando 0 registro(s).`;
    }
  }

  function getTaskDate(t) {
    // prioridad: updatedAt > fin > createdAt > fecha
    return toDate(t.updatedAt) || toDate(t.fin) || toDate(t.createdAt) || toDate(t.fecha) || null;
  }

  function filter(rows) {
    const days = Number(range.value || 30);
    const q = (search.value || "").trim().toLowerCase();
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);

    return rows
      .filter(t => {
        const d = getTaskDate(t);
        const ts = d ? d.getTime() : null;
        const inRange = ts == null ? true : ts >= since;

        const byZone = !q || String(t.zoneNombre || "").toLowerCase().includes(q);
        return inRange && byZone;
      })
      .sort((a, b) => {
        const A = getTaskDate(a)?.getTime() ?? 0;
        const B = getTaskDate(b)?.getTime() ?? 0;
        return B - A;
      });
  }

  function lastActionForTask(taskId) {
    // Busca el último evento en history para esa tarea
    const items = history.filter(h => String(h.taskId || "") === String(taskId || ""));
    if (!items.length) return "—";

    items.sort((a,b) => (toMillis(b.createdAt) - toMillis(a.createdAt)));
    return items[0]?.accion || "—";
  }

  function render() {
    const list = filter(tasks);

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Sin registros.</td></tr>`;
      count.textContent = `Mostrando 0 registro(s).`;
      return;
    }

    tbody.innerHTML = list.map(t => `
  <tr>
    <td class="cell-date">${fmtDateTime(getTaskDate(t))}</td>
    <td class="cell-zone"><strong>${esc(t.zoneNombre || "—")}</strong></td>
    <td class="cell-action">${esc(lastActionForTask(t.id))}</td>
    <td class="cell-status">${StatusUI.badge(t.estado)}</td>
    <td class="cell-time">${diffMinutes(t.inicio, t.fin)}</td>
  </tr>
`).join("");

    count.textContent = `Mostrando ${list.length} registro(s) · últimos ${range.value} días.`;
  }

  function exportCSV(list) {
    const headers = ["fecha","zona","accion","estado","inicio","fin","minutos"];

    const rows = list.map(t => {
      const fecha = fmtDateTime(getTaskDate(t));
      const accion = lastActionForTask(t.id);
      const ini = fmtDateTime(t.inicio);
      const fin = fmtDateTime(t.fin);
      const mins = diffMinutes(t.inicio, t.fin).replace(" min","");

      return ([
        fecha,
        t.zoneNombre || "",
        accion,
        t.estado || "",
        ini === "—" ? "" : ini,
        fin === "—" ? "" : fin,
        mins === "-" ? "" : mins
      ]);
    });

    const csv = [headers.join(","), ...rows.map(r => r.map(cellCSV).join(","))].join("\n");
    download("historial.csv", csv);
  }
}

/* ======================
   Helpers
====================== */

function qs(sel, root=document){ return root.querySelector(sel); }

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function cellCSV(v){
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
}

function download(name, content){
  const blob = new Blob([content], { type:"text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
}

function toDate(v) {
  if (!v) return null;

  // Firestore Timestamp real
  if (typeof v === "object" && typeof v.toDate === "function") return v.toDate();

  // serializado {seconds, nanoseconds}
  if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);

  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function toMillis(v){
  const d = toDate(v);
  return d ? d.getTime() : 0;
}

function fmtDateTime(v) {
  const d = toDate(v);
  return d ? d.toLocaleString() : "—";
}

function diffMinutes(inicio, fin) {
  const a = toDate(inicio);
  const b = toDate(fin) || new Date();
  if (!a) return "-";
  const min = Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
  return `${min} min`;
}
