// assets/js/pages/personal.js
import { db } from "../firebase/config.js";
import { StatusUI } from "../ui.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const Personal = { view, mount };

function view() {
  return `
  <section class="page">
    <div class="card section">
      <div class="toolbar">
        <div class="toolbar__left">
          <div>
            <h1 class="h1">Personal</h1>
            <p class="sub">Alta y listado de empleados (Firestore: users).</p>
          </div>
        </div>

        <div class="toolbar__right">
          <input id="empSearch" class="input" type="search" placeholder="Buscar empleado..." />
          <button id="btnNewEmp" class="btn btn--primary">+ Empleado</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="empTbody">
            <tr><td colspan="5" class="muted">Cargando personal...</td></tr>
          </tbody>
        </table>
      </div>

      <div class="footerline">
        <span id="empCount" class="muted">—</span>
        <span id="empInlineMsg" class="muted" style="margin-left:12px;"></span>
      </div>
    </div>

    ${modalMarkup()}
  </section>`;
}

function mount() {
  const tbody = qs("#empTbody");
  const count = qs("#empCount");
  const inlineMsg = qs("#empInlineMsg");
  const search = qs("#empSearch");
  const btnNew = qs("#btnNewEmp");

  const modal = qs("#empModal");
  const mTitle = qs("#empModalTitle");
  const mUid = qs("#empUid");
  const mNombre = qs("#empNombre");
  const mCorreo = qs("#empCorreo");
  const mRol = qs("#empRol");
  const mActivo = qs("#empActivo");
  const btnSave = qs("#empSave");
  const btnCancel = qs("#empCancel");
  const btnClose = qs("#empClose");
  const msg = qs("#empMsg");

  let rows = [];
  let editingUid = null;

  btnNew?.addEventListener("click", openModalForCreate);
  btnCancel?.addEventListener("click", closeModal);
  btnClose?.addEventListener("click", closeModal);

  search?.addEventListener("input", () => renderTable(filterRows(rows, search.value)));

  // delegación de eventos para Editar/Eliminar
  tbody?.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn) return;

    inlineMsg.textContent = "";
    const act = btn.dataset.act;
    const id = btn.dataset.id;

    const u = rows.find(x => x.id === id);
    if (!u) return;

    try {
      if (act === "edit") {
        openModalForEdit(u);
        return;
      }

      if (act === "del") {
        const ok = confirm(`¿Eliminar perfil "${u.nombre}"?\n\nEsto SOLO borra Firestore (users).`);
        if (!ok) return;
        await deleteDoc(doc(db, "users", id));
        await load();
        return;
      }
    } catch (e) {
      inlineMsg.textContent = `Error: ${e?.message || e}`;
      console.error(e);
    }
  });

  btnSave?.addEventListener("click", async () => {
    msg.textContent = "";
    inlineMsg.textContent = "";
    btnSave.disabled = true;

    try {
      const uid = (mUid.value || "").trim();
      const nombre = (mNombre.value || "").trim();
      const correo = (mCorreo.value || "").trim();
      const rol = (mRol.value || "").trim().toLowerCase();
      const activo = !!mActivo.checked;

      if (!uid) throw new Error("Falta UID (de Authentication).");
      if (!nombre) throw new Error("Falta nombre.");
      if (!correo) throw new Error("Falta correo.");
      if (!rol) throw new Error("Falta rol.");

      const ref = doc(db, "users", uid);
      const exists = await getDoc(ref).then(s => s.exists());

      if (!exists) {
        await setDoc(ref, {
          nombre,
          correo,
          rol,
          activo,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(ref, {
          nombre,
          correo,
          rol,
          activo,
          updatedAt: serverTimestamp()
        });
      }

      closeModal();
      await load();
    } catch (e) {
      msg.textContent = e?.message || String(e);
    } finally {
      btnSave.disabled = false;
    }
  });

  load();

  async function load() {
    inlineMsg.textContent = "";
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Cargando personal...</td></tr>`;

    try {
      const q = query(collection(db, "users"), orderBy("nombre", "asc"));
      const snap = await getDocs(q);
      rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTable(filterRows(rows, search.value));
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Error cargando personal.</td></tr>`;
      count.textContent = `Mostrando 0 empleado(s).`;
      inlineMsg.textContent = `Error: ${e?.message || e}`;
    }
  }

  function renderTable(list) {
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Sin resultados.</td></tr>`;
      count.textContent = `Mostrando 0 empleado(s).`;
      return;
    }

    tbody.innerHTML = list.map(u => {
      const rolTxt = (u.rol || "").toLowerCase();
      const activo = !!u.activo;

      const rolPill = `<span class="pill">${esc(rolTxt || "—")}</span>`;
      const estadoBadge = activo
        ? `<span class="badge badge--good">Activo</span>`
        : `<span class="badge badge--bad">Inactivo</span>`;

      return `
        <tr>
          <td><strong>${esc(u.nombre || "")}</strong></td>
          <td>${esc(u.correo || "")}</td>
          <td>${rolPill}</td>
          <td>${estadoBadge}</td>
          <td style="text-align:right;">
            <button class="btn btn--ghost" data-act="edit" data-id="${u.id}">Editar</button>
            <button class="btn btn--danger" data-act="del" data-id="${u.id}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join("");

    count.textContent = `Mostrando ${list.length} empleado(s).`;
  }

  function openModalForCreate() {
    editingUid = null;
    mTitle.textContent = "Nuevo empleado";
    msg.textContent = "";

    mUid.value = "";
    mNombre.value = "";
    mCorreo.value = "";
    mRol.value = "empleado";
    mActivo.checked = true;

    mUid.disabled = false;
    openModal();
  }

  function openModalForEdit(u) {
    editingUid = u.id;
    mTitle.textContent = "Editar empleado";
    msg.textContent = "";

    mUid.value = u.id;
    mNombre.value = u.nombre || "";
    mCorreo.value = u.correo || "";
    mRol.value = (u.rol || "empleado").toLowerCase();
    mActivo.checked = !!u.activo;

    mUid.disabled = true;
    openModal();
  }

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => (mNombre?.focus?.()), 20);
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }
}


  // Modal markup

function modalMarkup() {
  return `
  <div id="empModal" class="modal" aria-hidden="true">
    <div class="modal__backdrop" data-close="1"></div>
    <div class="modal__panel">
      <div class="modal__head">
        <h3 id="empModalTitle">Nuevo empleado</h3>
        <button id="empClose" class="iconbtn" type="button" aria-label="Cerrar">✕</button>
      </div>

      <div class="modal__body">
        <div class="grid2">
          <div class="field">
            <label>UID (Authentication) *</label>
            <input id="empUid" class="input" placeholder="Pega el UID del usuario (Auth)" />
            <small class="muted">El ID del documento será este UID.</small>
          </div>

          <div class="field">
            <label>Rol *</label>
            <select id="empRol" class="input">
              <option value="empleado">empleado</option>
              <option value="supervisor">supervisor</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <div class="field">
            <label>Nombre *</label>
            <input id="empNombre" class="input" placeholder="Nombre completo" />
          </div>

          <div class="field">
            <label>Correo *</label>
            <input id="empCorreo" class="input" placeholder="correo@empresa.com" />
          </div>

          <div class="field">
            <label>Activo</label>
            <label class="switch">
              <input id="empActivo" type="checkbox" checked />
              <span class="switch__ui"></span>
              <span class="switch__txt">Sí</span>
            </label>
          </div>
        </div>

        <p id="empMsg" class="msg msg--warn"></p>
      </div>

      <div class="modal__foot">
        <button id="empCancel" class="btn btn--ghost" type="button">Cancelar</button>
        <button id="empSave" class="btn btn--primary" type="button">Guardar</button>
      </div>
    </div>
  </div>`;
}


   // Utils

function qs(sel, root = document) { return root.querySelector(sel); }

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
  return rows.filter(u =>
    (u.nombre || "").toLowerCase().includes(q) ||
    (u.correo || "").toLowerCase().includes(q) ||
    (u.rol || "").toLowerCase().includes(q)
  );
}
