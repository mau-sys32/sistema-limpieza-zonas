// assets/js/ui.js

export const Modal = {
  el: null,
  _bound: false,

  init() {
    this.el = document.getElementById("modal");
    if (!this.el) return;

    // Evita duplicar listeners si init se llama varias veces
    if (this._bound) return;
    this._bound = true;

    // Cerrar por botones con data-close="1" (X, backdrop, footer buttons)
    this.el.addEventListener("click", (e) => {
      const closeBtn = e.target.closest('[data-close="1"]');
      if (closeBtn) this.close();
    });

    //  Cerrar con ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.el.classList.contains("is-open")) {
        this.close();
      }
    });
  },

  open({ title = "Acción", body = "", footer = "" } = {}) {
    if (!this.el) this.init();
    if (!this.el) return;

    const t = document.getElementById("modalTitle");
    const b = document.getElementById("modalBody");
    const f = document.getElementById("modalFoot");

    if (t) t.textContent = title;
    if (b) b.innerHTML = body;
    if (f) f.innerHTML = footer || `<button class="btn" data-close="1">Cerrar</button>`;

    this.el.classList.add("is-open");
    this.el.setAttribute("aria-hidden", "false");

    // Bloquea scroll del fondo mientras el modal está abierto
    document.body.style.overflow = "hidden";
  },

  close() {
    if (!this.el) this.init();
    if (!this.el) return;

    this.el.classList.remove("is-open");
    this.el.setAttribute("aria-hidden", "true");

    //  Restaura scroll
    document.body.style.overflow = "";
  }
};

export const Theme = {
  key: "ag_theme",

  init() {
    const saved = localStorage.getItem(this.key) || "dark";
    document.documentElement.dataset.theme = saved;

    const btn = document.getElementById("btnToggleTheme");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme || "dark";
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(this.key, next);
    });
  }
};

//  Estado UI helper (reutilizable en todas las páginas)
export const StatusUI = {
  normalize(raw) {
    const s = String(raw || "").trim().toLowerCase();

    // soporta variantes
    if (s === "finalizada" || s === "completada" || s === "completa") return "Completada";
    if (s === "en proceso" || s === "proceso" || s === "iniciada") return "En proceso";
    if (s === "pendiente") return "Pendiente";

    // fallback: capitaliza
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Pendiente";
  },

  badge(raw) {
    const s = this.normalize(raw);
    if (s === "Completada") return `<span class="badge badge--good">Completada</span>`;
    if (s === "En proceso") return `<span class="badge badge--warn">En proceso</span>`;
    return `<span class="badge badge--bad">Pendiente</span>`;
  }
};
