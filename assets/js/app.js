// assets/js/app.js

import { initRouter } from "./router.js";
import { Theme } from "./ui.js";

import { watchAuth, getMyProfile, logout } from "./firebase/auth.js";

import { Login } from "./pages/login.js";
import { Dashboard } from "./pages/dashboard.js";
import { Zonas } from "./pages/zonas.js";
import { Tareas } from "./pages/tareas.js";
import { Personal } from "./pages/personal.js";
import { Historial } from "./pages/historial.js";
import { Reportes } from "./pages/reportes.js";

Theme.init();

// estado global
window.AppState = window.AppState || { session: null };

const view = document.getElementById("view");
if (view) {
  view.innerHTML = `<section class="card section"><p class="sub">Cargando sesión…</p></section>`;
}

// inicia router solo cuando ya sepamos si hay sesión o no
let routerStarted = false;
function startRouterOnce() {
  if (routerStarted) return;
  initRouter();
  routerStarted = true;
}

//  Auth watcher
watchAuth(async (user) => {
  try {
    if (!user) {
      boot(null);
      startRouterOnce();
      if (!location.hash || !String(location.hash).includes("login")) {
        location.hash = "#/login";
      }
      return;
    }

    const profile = await getMyProfile(user.uid);

    if (!profile) {
      boot(null);
      startRouterOnce();
      location.hash = "#/login";
      return;
    }

    const session = {
      uid: user.uid,
      correo: (profile.correo || user.email || "").trim(),
      nombre: (profile.nombre || "").trim() || "Usuario",
      rol: String(profile.rol || "empleado").toLowerCase(),
      activo: profile.activo !== false,
    };

    boot(session);
    startRouterOnce();

    // si está en login o vacío -> dashboard
    if (!location.hash || String(location.hash).includes("login")) {
      location.hash = "#/dashboard";
    }
  } catch (e) {
    console.error(e);
    boot(null);
    startRouterOnce();
    location.hash = "#/login";
  }
});

function boot(session) {
  window.AppState = window.AppState || {};
  window.AppState.session = session;

  const rol = (session?.rol || "").toLowerCase();
  const isAdmin = rol === "admin";
  const isSupervisor = rol === "supervisor";
  const isManager = isAdmin || isSupervisor;

  //  vistas base 
  window.Views = {
    login: Login.view,
    dashboard: Dashboard.view,
    tareas: Tareas.view,
  };

  window.ViewMount = {
    login: Login.mount,
    dashboard: Dashboard.mount,
    tareas: Tareas.mount,
  };

  // módulos de manager
  if (isManager) {
    window.Views.zonas = Zonas.view;
    window.Views.personal = Personal.view;
    window.Views.historial = Historial.view;
    window.Views.reportes = Reportes.view;

    window.ViewMount.zonas = Zonas.mount;
    window.ViewMount.personal = Personal.mount;
    window.ViewMount.historial = Historial.mount;
    window.ViewMount.reportes = Reportes.mount;
  } else {
  
    const r = (location.hash || "").replace("#/", "");
    if (["zonas", "personal", "historial", "reportes"].includes(r)) {
      location.hash = "#/tareas";
    }
  }

  applySessionUI(session, { isManager });
}

function applySessionUI(session, { isManager }) {
  const nameEl = document.querySelector(".userchip__name");
  const roleEl = document.querySelector(".userchip__role");
  const avatarEl = document.querySelector(".userchip__avatar");
  const pill = document.getElementById("pillStatus");

  if (session) {
    if (nameEl) nameEl.textContent = session.nombre;
    if (roleEl) roleEl.textContent = session.rol;
    if (avatarEl) avatarEl.textContent = (session.nombre || "U").slice(0, 1).toUpperCase();
    if (pill) pill.textContent = "Conectado";
  } else {
    if (nameEl) nameEl.textContent = "Invitado";
    if (roleEl) roleEl.textContent = "sin sesión";
    if (avatarEl) avatarEl.textContent = "—";
    if (pill) pill.textContent = "Sin sesión";
  }

  const setNavVisible = (route, visible) => {
    const el = document.querySelector(`.nav__item[data-route="${route}"]`);
    if (el) el.style.display = visible ? "" : "none";
  };

  setNavVisible("zonas", isManager);
  setNavVisible("personal", isManager);
  setNavVisible("historial", isManager);
  setNavVisible("reportes", isManager);

  // Logout
  const footer = document.querySelector(".sidebar__footer");
  if (footer) {
    let btn = document.getElementById("btnLogout");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "btnLogout";
      btn.className = "btn btn--ghost w-full";
      btn.textContent = "Cerrar sesión";
      btn.addEventListener("click", async () => {
        await logout();
        boot(null);
        location.hash = "#/login";
      });
      footer.appendChild(btn);
    }
  }
}
