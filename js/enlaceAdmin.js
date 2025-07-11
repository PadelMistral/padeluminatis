// js/enlaceAdmin.js
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

// Funciones de Firebase
function getCurrentUser() {
    return auth.currentUser;
}

async function getCurrentUserData() {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error("Error al obtener datos del usuario:", error);
        return null;
    }
}

async function initializeFirebaseService() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            resolve(user || null);
        }, reject);
    });
}

function marcarEnlaceActivo() {
    const navLinks = document.querySelectorAll('.app-nav .nav-item');
    const path = window.location.pathname.split('/').pop();
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && path && href.endsWith(path)) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const adminLinks = document.querySelectorAll('.nav-admin');
    const logoutLinks = document.querySelectorAll('.nav-logout');

    try {
        await setPersistence(auth, browserLocalPersistence);
        await initializeFirebaseService();
        const user = getCurrentUser();
        const userData = await getCurrentUserData();

        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        if (!userData || !userData.aprobado) {
            window.location.href = 'index.html';
            return;
        }
        // Mostrar enlace admin solo si es admin
        adminLinks.forEach(link => {
            link.style.display = (userData.rol === "Admin") ? "inline-flex" : "none";
        });
        // Mostrar siempre el de cerrar sesión si está logueado
        logoutLinks.forEach(link => {
            link.style.display = "inline-flex";
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                await signOut(auth);
                window.location.href = 'index.html';
            });
        });
        marcarEnlaceActivo();
    } catch (error) {
        console.error('Error en enlaceAdmin.js:', error);
        window.location.href = 'index.html';
    }
});