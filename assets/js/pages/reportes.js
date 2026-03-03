// assets/js/pages/reportes.js
import { db } from "../firebase/config.js";
import { Modal } from "../ui.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const Reportes = { view, mount };

function view() {
  return `
    <section class="page">
      <header class="page__header">
        <div>
          <h1>Reportes</h1>
          <p class="sub">Incidencias enviadas por empleados (Firestore: reports).</p>
        </div>
      </header>

      <div class="card section">
        <div class="toolbar">
          <div class="toolbar__left" style="gap:10px; align-items:center;">
            <strong>Incidencias</strong>
            <span class="badge">reports</span>

            <div style="display:flex; gap:8px; margin-left:10px; flex-wrap:wrap;">
              <button class="btn btn--ghost" id="rpFilterAll">Todos</button>
              <button class="btn btn--ghost" id="rpFilterPend">Pendientes</button>
              <button class="btn btn--ghost" id="rpFilterRes">Resueltos</button>
            </div>
          </div>

          <div class="toolbar__right">
            <span class="muted" id="rpCount">—</span>
          </div>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Empleado</th>
                <th>Zona</th>
                <th>Descripción</th>
                <th>Foto</th>
                <th>Estado</th>
                <th style="text-align:right;">Acciones</th>
              </tr>
            </thead>
            <tbody id="rpRows">
              <tr><td colspan="7" class="muted">Cargando…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function mount() {
  const tbody = document.getElementById("rpRows");
  const count = document.getElementById("rpCount");

  const btnAll  = document.getElementById("rpFilterAll");
  const btnPend = document.getElementById("rpFilterPend");
  const btnRes  = document.getElementById("rpFilterRes");

  let allRows = [];
  let filter = "all"; // all | pendiente | resuelto

  const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));

  window.__unsubReports && window.__unsubReports();
  window.__unsubReports = onSnapshot(q, (snap) => {
    allRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });

  btnAll?.addEventListener("click", () => { filter = "all"; setFilterUI(); render(); });
  btnPend?.addEventListener("click", () => { filter = "pendiente"; setFilterUI(); render(); });
  btnRes?.addEventListener("click", () => { filter = "resuelto"; setFilterUI(); render(); });

  function setFilterUI() {
    const setActive = (el, on) => el && el.classList.toggle("is-active", !!on);
    setActive(btnAll, filter === "all");
    setActive(btnPend, filter === "pendiente");
    setActive(btnRes, filter === "resuelto");
  }
  setFilterUI();

  function render() {
    if (!tbody) return;

    const rows = allRows.filter(r => {
      const st = String(r.status || "pendiente").toLowerCase();
      if (filter === "pendiente") return st !== "resuelto";
      if (filter === "resuelto") return st === "resuelto";
      return true;
    });

    if (count) count.textContent = `${rows.length} reporte(s)`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Sin reportes.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const fecha = fmtDate(r.createdAt);
      const estado = String(r.status || "pendiente").toLowerCase();

      const badge = estado === "resuelto"
        ? `<span class="badge badge--good">Resuelto</span>
           <div class="muted" style="font-size:12px;margin-top:4px;">
             ${r.resolvedAt ? "Resuelto: " + fmtDate(r.resolvedAt) : ""}
           </div>`
        : `<span class="badge">Pendiente</span>`;

      const foto = r.photoURL
        ? `
          <div style="display:flex; align-items:center; gap:10px;">
            <a href="${r.photoURL}" target="_blank" rel="noopener" title="Abrir foto">
              <img src="${r.photoURL}" alt="foto" style="height:46px;width:72px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.10);">
            </a>
            <a class="btn btn--ghost" href="${r.photoURL}" target="_blank" rel="noopener">Abrir</a>
          </div>
        `
        : `<span class="muted">—</span>`;

      const btnResolve = estado === "resuelto"
        ? `<button class="btn btn--ghost" disabled>Resuelto</button>`
        : `<button class="btn btn--primary" data-act="resolve" data-id="${r.id}">Marcar resuelto</button>`;

      const btnDetail = `<button class="btn btn--ghost" data-act="detail" data-id="${r.id}">Ver detalle</button>`;

      return `
        <tr>
          <td>${fecha}</td>
          <td><strong>${esc(r.employeeNombre || "—")}</strong></td>
          <td>${esc(r.zoneNombre || "—")}</td>
          <td>${clip(esc(r.observaciones || ""), 80)}</td>
          <td>${foto}</td>
          <td>${badge}</td>
          <td style="text-align:right; white-space:nowrap;">
            ${btnDetail}
            ${btnResolve}
          </td>
        </tr>
      `;
    }).join("");
  }

  tbody?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;

    const r = allRows.find(x => String(x.id) === String(id));
    if (!r) return;

    if (act === "detail") {
      openDetail(r);
      return;
    }

    if (act === "resolve") {
      const ok = confirm("¿Marcar este reporte como resuelto?");
      if (!ok) return;

      try {
        await updateDoc(doc(db, "reports", id), {
          status: "resuelto",
          resolvedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error(err);
        alert("Error: " + (err?.message || err));
      }
    }
  });

  function openDetail(r) {
    const estado = String(r.status || "pendiente").toLowerCase();

    Modal.open({
      title: "Detalle del reporte",
      body: `
        <div class="kgrid" style="gap:12px;">
          <div class="col-12">
            <div class="field">
              <label class="muted">Empleado</label>
              <div class="input" style="display:flex;align-items:center;">${esc(r.employeeNombre || "—")}</div>
            </div>
          </div>

          <div class="col-12">
            <div class="field">
              <label class="muted">Zona</label>
              <div class="input" style="display:flex;align-items:center;">${esc(r.zoneNombre || "—")}</div>
            </div>
          </div>

          <div class="col-12">
            <div class="field">
              <label class="muted">Fecha</label>
              <div class="input" style="display:flex;align-items:center;">${fmtDate(r.createdAt)}</div>
            </div>
          </div>

          <div class="col-12">
            <div class="field">
              <label class="muted">Estado</label>
              <div class="input" style="display:flex;align-items:center;">
                ${estado === "resuelto" ? "Resuelto" : "Pendiente"}
                ${r.resolvedAt ? `<span class="muted" style="margin-left:10px;">(${fmtDate(r.resolvedAt)})</span>` : ""}
              </div>
            </div>
          </div>

          <div class="col-12">
            <div class="field">
              <label class="muted">Descripción</label>
              <textarea class="input" rows="5" readonly>${(r.observaciones || "")}</textarea>
            </div>
          </div>

          <div class="col-12">
            <div class="field">
              <label class="muted">Foto</label>
              ${
                r.photoURL
                  ? `<a href="${r.photoURL}" target="_blank" rel="noopener">
                       <img src="${r.photoURL}" style="width:100%;max-height:320px;object-fit:contain;border-radius:14px;border:1px solid rgba(255,255,255,.10);">
                     </a>`
                  : `<div class="muted">Sin foto.</div>`
              }
            </div>
          </div>
        </div>
      `,
      foot: `
        <button class="btn" data-close="1">Cerrar</button>
        ${
          estado !== "resuelto"
            ? `<button class="btn btn--primary" id="rpResolveNow">Marcar resuelto</button>`
            : ""
        }
      `
    });

    document.getElementById("rpResolveNow")?.addEventListener("click", async () => {
      const ok = confirm("¿Marcar este reporte como resuelto?");
      if (!ok) return;
      try {
        await updateDoc(doc(db, "reports", r.id), {
          status: "resuelto",
          resolvedAt: new Date().toISOString()
        });
        Modal.close();
      } catch (err) {
        console.error(err);
        alert("Error: " + (err?.message || err));
      }
    });
  }
}

/* ===== helpers ===== */

function fmtDate(v) {
  if (!v) return "—";
  if (typeof v?.toDate === "function") return v.toDate().toLocaleString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clip(s, n = 90) {
  const t = String(s || "");
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}