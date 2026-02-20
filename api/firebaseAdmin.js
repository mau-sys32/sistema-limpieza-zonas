// api/firebaseAdmin.js
import admin from "firebase-admin";
import fs from "fs";

// Leer service account
const serviceAccount = JSON.parse(
  fs.readFileSync(new URL("./serviceAccountKey.json", import.meta.url))
);

// Inicializar Firebase Admin SOLO una vez
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Exportar Firestore y Auth
export const db = admin.firestore();
export const authAdmin = admin.auth();
export const FieldValue = admin.firestore.FieldValue;
