import { login, logout, watchAuth, getMyProfile } from "../firebase/auth.js";

export const Login = {
  view() {
    return `
      <div class="card section login-card">
        <div class="login-head">
          <div class="login-logo">AG</div>
          <div>
            <h1 class="login-title">Inicio de sesión</h1>
            <p class="login-sub">Sistema de Gestión y Control de Limpieza por Zonas</p>
          </div>
        </div>

        <div class="login-form">
          <div>
            <label class="login-label" for="lgEmail">Correo</label>
            <input class="input login-input" id="lgEmail" autocomplete="username" placeholder="correo@empresa.com" />
          </div>

          <div>
            <label class="login-label" for="lgPass">Contraseña</label>
            <input class="input login-input" id="lgPass" type="password" autocomplete="current-password" placeholder="••••••••" />
          </div>

          <div class="login-actions">
            <button class="btn btn-quiet" id="lgLogout" type="button">Cerrar sesión</button>
            <button class="btn btn--primary" id="lgLogin" type="button">Entrar</button>
          </div>
        </div>

        <p class="login-msg" id="lgMsg"></p>

        <div class="login-mini">
          <span>© Apodaca Group</span>
          <span>v0.1</span>
        </div>
      </div>
    `;
  },

  mount() {
    const msg = document.getElementById("lgMsg");
    const emailEl = document.getElementById("lgEmail");
    const passEl = document.getElementById("lgPass");

    const doLogin = async () => {
      const email = emailEl?.value?.trim();
      const pass = passEl?.value;

      msg.textContent = "Iniciando sesión…";

      try {
        await login(email, pass);
      } catch (e) {
        msg.textContent = "Error: " + (e?.message || e);
      }
    };

    document.getElementById("lgLogin")?.addEventListener("click", doLogin);

    // ✅ Enter para iniciar sesión
    emailEl?.addEventListener("keydown", (ev) => ev.key === "Enter" && doLogin());
    passEl?.addEventListener("keydown", (ev) => ev.key === "Enter" && doLogin());

    document.getElementById("lgLogout")?.addEventListener("click", async () => {
      msg.textContent = "Cerrando sesión…";
      try {
        await logout();
      } catch (e) {
        msg.textContent = "Error: " + (e?.message || e);
      }
    });

    watchAuth(async (user) => {
      if (!user) {
        msg.textContent = "Sin sesión.";
        return;
      }

      msg.textContent = "Leyendo perfil…";

      try {
        const profile = await getMyProfile(user.uid);

        if (!profile) {
          msg.textContent =
            "Sesión Auth OK, pero falta crear tu perfil en Firestore: users/{UID}. " +
            "Firebase Console → Firestore → users → crea doc con ID=UID y rol=admin.";
          return;
        }

        msg.textContent = `Conectado: ${profile.nombre} · rol: ${profile.rol}`;
        location.hash = "#/dashboard";
        location.reload();
      } catch (e) {
        msg.textContent = `Error: ${e?.code || ""} ${e?.message || e}`;
      }
    });
  }
};