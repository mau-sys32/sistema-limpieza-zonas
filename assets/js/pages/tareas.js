// assets/js/pages/tareas.js
import { db, auth } from "../firebase/config.js";
import { StatusUI, Modal } from "../ui.js";

import {
  tasksList,
  tasksCreate,
  tasksUpdate,
  tasksDelete,
  tasksStart,
  tasksFinish
} from "../firebase/tasks.db.js";

import { zonesList } from "../firebase/zones.db.js";
import { uploadImageToCloudinary } from "../cloudinary.js";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const Tareas = { view, mount };

function view() {
  return `
  <section class="page">
    <header class="page__header">
      <div>
        <h1>Tareas</h1>
        <p class="sub">Asignación y control de tareas.</p>
      </div>

      <div class="page__actions">
        <input id="taskSearch" class="input" type="search" placeholder="Buscar tarea..." />
        <button id="btnNewTask" class="btn btn--primary">+ Tarea</button>
      </div>
    </header>

    <div class="card section">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Empleado</th>
              <th>Zona</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="taskTbody">
            <tr><td colspan="6" class="muted">Cargando tareas...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="footerline">
        <span id="taskCount" class="muted">—</span>
        <span id="taskInlineMsg" class="muted" style="margin-left:12px;"></span>
      </div>
    </div>

    ${modalMarkup()}
  </section>`;
}

function mount() {
  const session = window.AppState?.session || null;
  const rol = (session?.rol || "").toLowerCase();

  const isManager = rol === "admin" || rol === "supervisor";
  const isEmpleado = rol === "empleado";

  const tbody = qs("#taskTbody");
  const count = qs("#taskCount");
  const inlineMsg = qs("#taskInlineMsg");
  const search = qs("#taskSearch");
  const btnNew = qs("#btnNewTask");

  const modal = qs("#taskModal");
  const mTitle = qs("#taskModalTitle");
  const mFecha = qs("#tFecha");
  const mEmp = qs("#tEmpleado");
  const mZona = qs("#tZona");
  const mPrior = qs("#tPrioridad");
  const mEstado = qs("#tEstado");
  const msg = qs("#taskMsg");
  const btnSave = qs("#taskSave");
  const btnCancel = qs("#taskCancel");
  const btnClose = qs("#taskClose");

  let all = [];
  let empleados = [];
  let zonas = [];
  let editingId = null;

  if (!isManager && btnNew) btnNew.style.display = "none";

  btnNew?.addEventListener("click", () => openCreate());
  btnCancel?.addEventListener("click", closeModal);
  btnClose?.addEventListener("click", closeModal);
  search?.addEventListener("input", () => renderTable(filterRows(all, search.value)));

  tbody?.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn || btn.disabled) return;

    inlineMsg.textContent = "";

    const act = btn.dataset.act;
    const id = btn.dataset.id;

    const t = all.find((x) => String(x.id) === String(id));
    if (!t) return;

    try {
      if (act === "edit") {
        openEdit(t);
        return;
      }

      if (act === "del") {
        if (!isManager) return;

        const ok = confirm(`¿Eliminar tarea de "${t.employeeNombre}" en "${t.zoneNombre}"?`);
        if (!ok) return;

        await tasksDelete(id);
        await addHistory("ELIMINADA", t, { estado: t.estado || "Pendiente" });
        inlineMsg.textContent = "Eliminada ✅";
        await refreshTasks();
        return;
      }

      if (act === "start") {
        const uid = auth.currentUser?.uid || "";
        if (!canStart(t, uid)) {
          inlineMsg.textContent = "No puedes iniciar esta tarea.";
          return;
        }

        const updated = await tasksStart(id);

        await addHistory(
          "INICIADA",
          { ...t, ...updated },
          {
            estado: updated?.estado || "En proceso",
            inicio: updated?.inicio ?? t.inicio ?? null
          }
        );

        inlineMsg.textContent = "Iniciada ✅";
        await refreshTasks();
        return;
      }

      if (act === "finish") {
        const uid = auth.currentUser?.uid || "";
        if (!canFinish(t, uid)) {
          inlineMsg.textContent = "No puedes finalizar esta tarea.";
          return;
        }

        const updated = await tasksFinish(id);

        await addHistory(
          "FINALIZADA",
          { ...t, ...updated },
          {
            estado: updated?.estado || "Finalizada",
            fin: updated?.fin ?? t.fin ?? null
          }
        );

        inlineMsg.textContent = "Finalizada ✅";
        await refreshTasks();
        return;
      }

      if (act === "report") {
        if (!session) {
          alert("Sin sesión.");
          return;
        }
        openReportModal(t, session);
      }
    } catch (e) {
      inlineMsg.textContent = `Error: ${e?.message || e}`;
      console.error(e);
    }
  });

  btnSave?.addEventListener("click", async () => {
    if (!isManager) return;

    btnSave.disabled = true;
    msg.textContent = "";
    inlineMsg.textContent = "";

    try {
      const fecha = (mFecha.value || "").trim();
      const empId = mEmp.value;
      const zonaId = mZona.value;
      const prioridad = mPrior.value;
      const estado = mEstado.value;

      if (!fecha) throw new Error("Falta fecha.");
      if (!empId) throw new Error("Selecciona empleado.");
      if (!zonaId) throw new Error("Selecciona zona.");

      const emp = empleados.find((e) => e.id === empId);
      const zona = zonas.find((z) => z.id === zonaId);

      if (!emp) throw new Error("Empleado inválido.");
      if (!zona) throw new Error("Zona inválida.");

      const now = new Date().toISOString();

      const payload = {
        fecha,
        employeeId: emp.id,
        employeeNombre: emp.nombre || "",
        employeeCorreo: emp.correo || "",
        zoneId: zona.id,
        zoneNombre: zona.nombre || "",
        zoneArea: zona.area || "",
        prioridad,
        estado,
        inicio: null,
        fin: null,
        createdBy: auth.currentUser?.uid || "",
        createdAt: now,
        updatedAt: now
      };

      if (!editingId) {
        const created = await tasksCreate(payload);
        const newId = created?.id ?? created?.taskId ?? "";
        await addHistory("CREADA", { id: newId, ...payload }, { estado });
      } else {
        await tasksUpdate(editingId, payload);
        await addHistory("EDITADA", { id: editingId, ...payload }, { estado });
      }

      closeModal();
      await refreshTasks();
    } catch (e) {
      msg.textContent = e?.message || String(e);
    } finally {
      btnSave.disabled = false;
    }
  });

  init();

  async function init() {
    if (isManager) {
      await Promise.all([loadEmpleados(), loadZonas()]);
    }
    attachPolling();
  }

  async function loadEmpleados() {
    const qEmp = query(collection(db, "users"), where("activo", "==", true));
    const snap = await getDocs(qEmp);

    empleados = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => (u.rol || "").toLowerCase() === "empleado")
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

    mEmp.innerHTML =
      `<option value="">Selecciona...</option>` +
      empleados
        .map(
          (u) => `<option value="${u.id}">${esc(u.nombre)} (${esc(u.correo)})</option>`
        )
        .join("");
  }

  async function loadZonas() {
    const z = await zonesList();
    zonas = Array.isArray(z) ? z : [];

    mZona.innerHTML =
      `<option value="">Selecciona...</option>` +
      zonas
        .map(
          (z) => `<option value="${z.id}">${esc(z.nombre)} — ${esc(z.area || "")}</option>`
        )
        .join("");
  }

  async function refreshTasks() {
    const uid = auth.currentUser?.uid || null;
    if (!uid) {
      all = [];
      renderTable([]);
      return;
    }

    const list = await tasksList();
    let rows = Array.isArray(list) ? list : [];

    if (!isManager) {
      rows = rows.filter((t) => (t.employeeId || "") === uid);
    }

    all = rows
      .map((t) => ({ ...t, id: String(t.id) }))
      .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));

    renderTable(filterRows(all, search.value));
  }

  function attachPolling() {
    inlineMsg.textContent = "";
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Cargando tareas...</td></tr>`;

    const uid = auth.currentUser?.uid || null;
    if (!uid) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin sesión.</td></tr>`;
      count.textContent = `Mostrando 0 tarea(s).`;
      return;
    }

    window.__unsubTasks && window.__unsubTasks();

    let alive = true;
    let pulling = false;

    async function pull() {
      if (!alive || pulling) return;
      pulling = true;

      try {
        await refreshTasks();
      } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="6" class="muted">Error cargando tareas.</td></tr>`;
        count.textContent = "Mostrando 0 tarea(s).";
        inlineMsg.textContent = `Error: ${err?.message || err}`;
      } finally {
        pulling = false;
      }
    }

    pull();
    const timer = setInterval(pull, 5000);

    window.__unsubTasks = () => {
      alive = false;
      clearInterval(timer);
    };
  }

  function canStart(t, uid) {
    const est = (t.estado || "").toLowerCase();
    return est === "pendiente" && String(t.employeeId || "") === String(uid);
  }

  function canFinish(t, uid) {
    const est = (t.estado || "").toLowerCase();
    return est === "en proceso" && String(t.employeeId || "") === String(uid) && !!t.inicio;
  }

  function renderTable(list) {
    const uid = auth.currentUser?.uid || null;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin tareas.</td></tr>`;
      count.textContent = `Mostrando 0 tarea(s).`;
      return;
    }

    tbody.innerHTML = list
      .map((t) => {
        let acciones = `<span class="muted">—</span>`;

        if (isManager) {
          acciones = `
            <button class="btn btn--ghost" data-act="edit" data-id="${t.id}">Editar</button>
            <button class="btn btn--danger" data-act="del" data-id="${t.id}">Eliminar</button>
          `;
        } else if (isEmpleado) {
          const startOk = canStart(t, uid);
          const finishOk = canFinish(t, uid);

          acciones = `
            <button class="btn btn--start" data-act="start" data-id="${t.id}" ${startOk ? "" : "disabled"}>Comenzar</button>
            <button class="btn" data-act="report" data-id="${t.id}">Reportar</button>
            <button class="btn btn--finish" data-act="finish" data-id="${t.id}" ${finishOk ? "" : "disabled"}>Finalizar</button>
          `;
        }

        return `
          <tr>
            <td>${esc(t.fecha || "")}</td>
            <td><strong>${esc(t.employeeNombre || "")}</strong></td>
            <td>${esc(t.zoneNombre || "")}</td>
            <td><span class="pill">${esc(t.prioridad || "")}</span></td>
            <td>${StatusUI.badge(t.estado)}</td>
            <td style="text-align:right;">${acciones}</td>
          </tr>
        `;
      })
      .join("");

    count.textContent = `Mostrando ${list.length} tarea(s).`;
  }

  function openCreate() {
    if (!isManager) return;

    editingId = null;
    mTitle.textContent = "Nueva tarea";
    msg.textContent = "";

    mFecha.value = today();
    mEmp.value = "";
    mZona.value = "";
    mPrior.value = "Media";
    mEstado.value = "Pendiente";

    openModal();
  }

  function openEdit(t) {
    if (!isManager) return;

    editingId = t.id;
    mTitle.textContent = "Editar tarea";
    msg.textContent = "";

    mFecha.value = t.fecha || today();
    mEmp.value = t.employeeId || "";
    mZona.value = t.zoneId || "";
    mPrior.value = t.prioridad || "Media";
    mEstado.value = t.estado || "Pendiente";

    openModal();
  }

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function openReportModal(task, session) {
    Modal.init?.();

    Modal.open({
      title: "Reportar incidencia",
      body: `
        <div class="field">
          <label class="muted">Zona</label>
          <input class="input" value="${esc(task.zoneNombre || "—")}" disabled />
        </div>

        <div class="field">
          <label class="muted">Descripción *</label>
          <textarea class="input" id="rpObs" rows="4" placeholder="Describe el problema..."></textarea>
        </div>

        <div class="field">
          <label class="muted">Foto (opcional)</label>
          <input class="input" id="rpFile" type="file" accept="image/*" />
          <p class="muted" style="font-size:12px;margin-top:8px;">
            La foto se sube a Cloudinary y el link se guarda en Firestore.
          </p>
        </div>

        <p class="sub" id="rpMsg" style="margin-top:10px;"></p>
      `,
      footer: `
        <button class="btn" data-close="1">Cerrar</button>
        <button class="btn btn--primary" id="rpSend">Enviar</button>
      `
    });

    const btnSend = document.getElementById("rpSend");
    const msgEl = document.getElementById("rpMsg");

    btnSend?.addEventListener("click", async () => {
      const obs = (document.getElementById("rpObs")?.value || "").trim();
      const file = document.getElementById("rpFile")?.files?.[0] || null;

      if (!obs) {
        msgEl.textContent = "Escribe la descripción.";
        return;
      }

      btnSend.disabled = true;
      msgEl.textContent = "Enviando...";

      try {
        let photoURL = "";

        if (file) {
          photoURL = await uploadImageToCloudinary(file);
        }

        await addDoc(collection(db, "reports"), {
          createdAt: serverTimestamp(),
          employeeId: session.uid,
          employeeNombre: session.nombre || "Empleado",
          taskId: String(task.id || ""),
          zoneId: String(task.zoneId || ""),
          zoneNombre: task.zoneNombre || "",
          observaciones: obs,
          photoURL,
          status: "pendiente"
        });

        msgEl.textContent = "✅ Reporte enviado.";
        setTimeout(() => Modal.close(), 700);
      } catch (err) {
        console.error(err);
        msgEl.textContent = "❌ Error: " + (err?.message || err);
        btnSend.disabled = false;
      }
    });
  }

  async function addHistory(accion, task, patch = {}) {
    const actorId = auth.currentUser?.uid || "";
    const actorRol = rol || "empleado";
    const now = new Date().toISOString();

    const payload = {
      taskId: task.id || task.taskId || "",
      employeeId: task.employeeId || "",
      employeeNombre: task.employeeNombre || "",
      zoneId: task.zoneId || "",
      zoneNombre: task.zoneNombre || "",
      accion,
      estado: patch.estado || task.estado || "",
      inicio: patch.inicio ?? task.inicio ?? null,
      fin: patch.fin ?? task.fin ?? null,
      actorId,
      actorRol,
      createdAt: now
    };

    await addDoc(collection(db, "history"), payload);
  }
}

function modalMarkup() {
  return `
  <div id="taskModal" class="modal" aria-hidden="true">
    <div class="modal__backdrop"></div>
    <div class="modal__panel">
      <div class="modal__head">
        <h3 id="taskModalTitle">Nueva tarea</h3>
        <button id="taskClose" class="iconbtn" type="button" aria-label="Cerrar">✕</button>
      </div>

      <div class="modal__body">
        <div class="grid2">
          <div class="field">
            <label>Fecha *</label>
            <input id="tFecha" class="input" type="date" />
          </div>

          <div class="field">
            <label>Prioridad</label>
            <select id="tPrioridad" class="input">
              <option>Alta</option>
              <option selected>Media</option>
              <option>Baja</option>
            </select>
          </div>

          <div class="field">
            <label>Empleado *</label>
            <select id="tEmpleado" class="input"></select>
          </div>

          <div class="field">
            <label>Estado</label>
            <select id="tEstado" class="input">
              <option selected>Pendiente</option>
              <option>En proceso</option>
              <option>Finalizada</option>
            </select>
          </div>

          <div class="field" style="grid-column: 1 / -1;">
            <label>Zona *</label>
            <select id="tZona" class="input"></select>
          </div>
        </div>

        <p id="taskMsg" class="msg msg--warn"></p>
      </div>

      <div class="modal__foot">
        <button id="taskCancel" class="btn btn--ghost" type="button">Cancelar</button>
        <button id="taskSave" class="btn btn--primary" type="button">Guardar</button>
      </div>
    </div>
  </div>`;
}

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filterRows(rows, term) {
  const q = (term || "").trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((t) =>
    (t.employeeNombre || "").toLowerCase().includes(q) ||
    (t.zoneNombre || "").toLowerCase().includes(q) ||
    (t.estado || "").toLowerCase().includes(q) ||
    (t.prioridad || "").toLowerCase().includes(q) ||
    (t.fecha || "").toLowerCase().includes(q)
  );
}

function today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}