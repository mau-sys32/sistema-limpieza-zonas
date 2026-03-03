// assets/js/firebase/reports.db.js
import { db, storage } from "./config.js";
import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

export async function reportCreate({ session, task, zone, descripcion, file }) {
  if (!session?.uid) throw new Error("No hay sesión");

  const ts = Date.now();
  const safeName = (file?.name || "foto").replaceAll(" ", "_");
  const path = `reports/${session.uid}/${ts}_${safeName}`;

  // 1) subir foto a Storage
  const storageRef = ref(storage, path);
  const bytes = await file.arrayBuffer();
  await uploadBytes(storageRef, new Uint8Array(bytes), { contentType: file.type || "image/jpeg" });

  const photoURL = await getDownloadURL(storageRef);

  // 2) guardar doc en Firestore
  const payload = {
    employeeId: session.uid,
    employeeNombre: session.nombre || "Empleado",
    zoneId: zone?.id || null,
    zoneNombre: zone?.nombre || zone || "—",
    taskId: task?.id || null,
    taskFecha: task?.fecha || null,
    descripcion: String(descripcion || "").trim(),
    photoURL,
    photoPath: path,
    status: "pendiente",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "reports"), payload);
  return { id: docRef.id, ...payload };
}