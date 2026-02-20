import { login, logout, watchAuth, getMyProfile } from "../firebase/auth.js";

export const Login = {
  view() {
    return `
      <div class="card section" style="max-width:720px;">
        <h1 class="h1">Inicio de sesión</h1>
        <p class="sub">Acceso con Firebase Authentication (correo y contraseña).</p>

        <div class="kgrid" style="margin-top:12px;">
          <div class="col-12">
            <div class="field">
              <label class="muted">Correo</label>
              <input class="input" id="lgEmail" placeholder="correo@empresa.com" />
            </div>
          </div>

          <div class="col-12">
            <div class="field">
              <label class="muted">Contraseña</label>
              <input class="input" id="lgPass" type="password" placeholder="••••••••" />
            </div>
          </div>

          <div class="col-12" style="display:flex; gap:10px; justify-content:flex-end; margin-top:10px;">
            <button class="btn" id="lgLogout">Cerrar sesión</button>
            <button class="btn btn--primary" id="lgLogin">Entrar</button>
          </div>
        </div>

        <p class="sub" id="lgMsg" style="margin-top:10px;"></p>
      </div>
    `;
  },

  mount() {
    const msg = document.getElementById("lgMsg");

    document.getElementById("lgLogin")?.addEventListener("click", async () => {
      const email = document.getElementById("lgEmail")?.value?.trim();
      const pass = document.getElementById("lgPass")?.value;

      msg.textContent = "Iniciando sesión…";

      try {
        await login(email, pass);
      } catch (e) {
        msg.textContent = "Error: " + (e?.message || e);
      }
    });

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
        " Sesión Auth OK, pero falta crear tu perfil en Firestore: users/{UID}. " +
        "Ve a Firebase Console → Firestore → users → crea doc con ID=UID y rol=admin.";
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
