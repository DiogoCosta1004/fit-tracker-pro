// Importações via CDN para uso direto no navegador
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Suas credenciais do FitTracker Pro
const firebaseConfig = {
    apiKey: "AIzaSyC2aSE7iFsV_2Im64cV9UK6NmcakhjAY0I",
    authDomain: "fit-tracker-pro-21b5e.firebaseapp.com",
    projectId: "fit-tracker-pro-21b5e",
    storageBucket: "fit-tracker-pro-21b5e.firebasestorage.app",
    messagingSenderId: "746120075051",
    appId: "1:746120075051:web:b0736dfb5072fc9e73176e",
    measurementId: "G-6QHBFZMH00"
};

// Inicialização dos serviços do Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exportando os serviços para serem usados nos outros arquivos JS
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);