// assets/js/router.js
export function initRouter() {
  // evita doble init
  if (window.__router_inited__) return;
  window.__router_inited__ = true;

  const view = document.getElementById("view");
  if (!view) {
    console.error("No existe #view");
    return;
  }

  function getRoute() {
    const hash = window.location.hash || "";
    if (!hash || hash === "#" || hash === "#/") return "dashboard";
    return hash.replace("#/", "").trim();
  }

  function setActive(route) {
    document.querySelectorAll(".nav__item").forEach(a => {
      a.classList.toggle("is-active", a.dataset.route === route);
    });
  }

  async function render() {
    const route = getRoute();

    // ✅ Modo Login: centra y oculta sidebar/topbar/footer
    document.body.classList.toggle("is-login", route === "login");

    const Views = window.Views || {};
    const Mounts = window.ViewMount || {};

    const page = Views[route];

    // si no existe la ruta, fallback
    if (typeof page !== "function") {
      setActive("");
      view.innerHTML = `
        <section class="card section">
          <h2>Vista no encontrada</h2>
          <p class="muted">Ruta: ${route}</p>
          <div style="margin-top:12px;">
            <button class="btn btn--primary" id="goDash">Ir a Dashboard</button>
          </div>
        </section>
      `;
      const btn = document.getElementById("goDash");
      if (btn) btn.addEventListener("click", () => (location.hash = "#/dashboard"));
      return;
    }

    setActive(route);
    view.innerHTML = page();

    // monta si existe
    const mount = Mounts[route];
    if (typeof mount === "function") {
      try {
        await mount();
      } catch (e) {
        console.error(`Error mount(${route})`, e);
      }
    }
  }

  window.addEventListener("hashchange", render);
  render();
}