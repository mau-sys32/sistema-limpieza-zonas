import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBFaA-lAGX-Lnrzi1TS1xtksSwf3_oLShE",
  authDomain: "systm-limpieza.firebaseapp.com",
  projectId: "systm-limpieza",
  storageBucket: "systm-limpieza.firebasestorage.app",
  messagingSenderId: "143853235640",
  appId: "1:143853235640:web:bbc45899dd16687641334d"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// SOLO DEV
window.__auth = auth;