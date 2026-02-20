// assets/js/firebase/auth.js
import { auth, db } from "./config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

/**
 * Registro demo: crea auth + crea users/{uid} con rol empleado
 * (admin/supervisor se asignan SOLO desde consola o con admin ya logueado)
 */
export async function registerEmpleado({ nombre, correo, password }) {
  const cred = await createUserWithEmailAndPassword(auth, correo, password);

  await setDoc(doc(db, "users", cred.user.uid), {
    nombre: (nombre || "").trim(),
    correo: (correo || "").trim().toLowerCase(),
    rol: "empleado",
    activo: true,
    createdAt: serverTimestamp()
  });

  return cred.user;
}

export async function getMyProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
