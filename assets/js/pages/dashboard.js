// assets/js/pages/dashboard.js
import { db, auth } from "../firebase/config.js";
import { StatusUI } from "../ui.js";
import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const Dashboard = { view, mount };

function view() {
  return `
  <section class="page">
    <header class="page__header">
      <div>
        <h1>Dashboard</h1>
        <p class="sub">Resumen general del sistema (Firestore en tiempo real).</p>
      </div>
    </header>

    <div class="kgrid">
      <div class="col-4">
        <div class="card kpi">
          <div class="kpi__top">
            <span class="kpi__label">Zonas</span>
            <span class="badge">Total</span>
          </div>
          <div class="kpi__value" id="kpiZonas">—</div>
          <div class="sub">Registradas en el sistema</div>
        </div>
      </div>

      <div class="col-4">
        <div class="card kpi">
          <div class="kpi__top">
            <span class="kpi__label">Pendientes</span>
            <span class="badge badge--bad">Tareas</span>
          </div>
          <div class="kpi__value" id="kpiPend">—</div>
          <div class="sub">Por ejecutar</div>
        </div>
      </div>

      <div class="col-4">
        <div class="card kpi">
          <div class="kpi__top">
            <span class="kpi__label">Cumplimiento</span>
            <span class="badge badge--good">Finalizadas</span>
          </div>
          <div class="kpi__value" id="kpiCumpl">—</div>
          <div class="sub">Finalizadas / Total</div>
        </div>
      </div>

      <div class="col-12">
        <div class="card section">
          <div class="toolbar">
            <div class="toolbar__left">
              <strong>Actividad reciente</strong>
              <span class="badge">tareas</span>
            </div>
            <div class="toolbar__right">
              <button class="btn" id="btnRefreshDash">Actualizar</button>
            </div>
          </div>

          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Zona</th>
                  <th>Estado</th>
                  <th>Tiempo</th>
                </tr>
              </thead>
              <tbody id="dashRows">
                <tr><td colspan="4" class="muted">Cargando…</td></tr>
              </tbody>
            </table>
          </div>

          <div class="footerline">
            <span class="muted" id="dashMeta">—</span>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function mount() {
  const session = window.AppState?.session || window.__SESSION__ || null;
  const rol = (session?.rol || "").toLowerCase();
  const isManager = rol === "admin" || rol === "supervisor";

  const pill = document.getElementById("pillStatus");
  const kZ = document.getElementById("kpiZonas");
  const kP = document.getElementById("kpiPend");
  const kC = document.getElementById("kpiCumpl");
  const tbody = document.getElementById("dashRows");
  const meta = document.getElementById("dashMeta");

  let zonas = [];
  let tareas = [];

  attachRealtime();

  document.getElementById("btnRefreshDash")?.addEventListener("click", () => {
    render();
    if (pill) {
      const old = pill.textContent;
      pill.textContent = "Actualizado ✅";
      setTimeout(() => (pill.textContent = old), 900);
    }
  });

  function attachRealtime() {
    const uid = auth.currentUser?.uid || null;
    if (!uid) return;

    // ZONAS realtime
    window.__unsubZones && window.__unsubZones();
    window.__unsubZones = onSnapshot(collection(db, "zones"), (snap) => {
      zonas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    });

    // TASKS realtime (manager: todas / empleado: solo suyas)
    const qTasks = isManager
      ? collection(db, "tasks")
      : query(collection(db, "tasks"), where("employeeId", "==", uid));

    window.__unsubDashTasks && window.__unsubDashTasks();
    window.__unsubDashTasks = onSnapshot(qTasks, (snap) => {
      tareas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    });
  }

  function render() {
    if (!tbody) return;

    const total = tareas.length;
    const pend = tareas.filter(t => normEstado(t.estado) === "pendiente").length;
    const proc = tareas.filter(t => normEstado(t.estado) === "en proceso").length;
    const fin  = tareas.filter(t => normEstado(t.estado) === "finalizada").length;

    if (kZ) kZ.textContent = String(zonas.length);
    if (kP) kP.textContent = String(pend);

    const pct = total === 0 ? 0 : Math.round((fin / total) * 100);
    if (kC) kC.textContent = `${fin} / ${total} (${pct}%)`;

    // últimas 10 por updatedAt/fin/createdAt/fecha
    const sorted = [...tareas].sort((a, b) => (toMillis(b.updatedAt || b.fin || b.createdAt || b.fecha) - toMillis(a.updatedAt || a.fin || a.createdAt || a.fecha)));
    const last = sorted.slice(0, 10);

    tbody.innerHTML = last.length
      ? last.map(t => `
        <tr>
          <td>${fmtDateTime(t.updatedAt || t.fin || t.createdAt || t.fecha)}</td>
          <td><strong>${esc(t.zoneNombre || "—")}</strong></td>
          <td>${StatusUI.badge(t.estado)}</td>
          <td>${diffMinutes(t.inicio, t.fin)}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="4" class="muted">Sin tareas aún.</td></tr>`;

    if (meta) meta.textContent = `Tareas: ${total} · Pend: ${pend} · Proc: ${proc} · Fin: ${fin}`;
    if (pill) pill.textContent = `Zonas: ${zonas.length} · Tareas: ${total}`;
  }
}

/* ===== helpers Timestamp-safe ===== */

function normEstado(s) {
  const v = String(s || "").toLowerCase();
  if (v.includes("final")) return "finalizada";
  if (v.includes("proceso")) return "en proceso";
  return "pendiente";
}

function toDate(v) {
  if (!v) return null;
  if (typeof v === "object" && typeof v.toDate === "function") return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function toMillis(v) {
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
  return `${Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000))} min`;
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
