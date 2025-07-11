import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const loadingContainer = document.getElementById('loading-container');
    const loginContainer = document.querySelector('.contenedor-login');
    const mensaje = document.getElementById('mensaje');
    if (loadingContainer) loadingContainer.style.display = 'none';
    if (loginContainer) loginContainer.style.display = 'flex';

    // Precargar sonidos
    const loginSound = new Audio('./sounds/login.mp3');
    const successSound = new Audio('./sounds/success.mp3');
    const errorSound = new Audio('./sounds/error.mp3');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (mensaje) mensaje.textContent = '';
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Validación básica antes de intentar login
        if (!email || !password) {
            showError('Por favor, introduce tu correo y contraseña.');
            return;
        }
        if (!validateEmail(email)) {
            showError('El formato del correo no es válido.');
            return;
        }

        // Oculta el formulario y muestra el loading solo si login es correcto
        try {
            await setPersistence(auth, browserSessionPersistence);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (userData.aprobado) {
                    const userName = userData.nombreUsuario || userData.nombre || user.email || "Jugador";
                    if (loginContainer) loginContainer.style.display = 'none';
                    if (loadingContainer) {
                        loadingContainer.style.display = 'flex';
                        loadingContainer.style.zIndex = '9999';
                        loadingContainer.style.opacity = '1';
                    }
                    startSpectacularLoading(userName);
                } else {
                    showError("Cuenta no aprobada. Espera la validación del administrador.");
                }
            } else {
                showError("El usuario no existe en la base de datos.");
            }
        } catch (error) {
            // Mensaje común para errores de autenticación típicos
            let msg = 'Error desconocido.';
            if (
                error.code === 'auth/user-not-found' ||
                error.code === 'auth/wrong-password' ||
                error.code === 'auth/invalid-email'
            ) {
                msg = 'Correo o contraseña incorrectos.';
            } else if (error.code === 'auth/too-many-requests') {
                msg = 'Demasiados intentos fallidos. Intenta más tarde.';
            } else if (error.message) {
                msg = error.message;
            }
            showError(msg);
        }
    });

    function showError(message) {
        if (loadingContainer) loadingContainer.style.display = 'none';
        if (loginContainer) loginContainer.style.display = 'flex';
        if (mensaje) {
            mensaje.textContent = message;
            mensaje.style.display = 'block';
            mensaje.style.color = '#bfa13a';
            mensaje.style.background = 'rgba(30,32,38,0.85)';
            mensaje.style.padding = '0.7em 1.5em';
            mensaje.style.borderRadius = '12px';
            mensaje.style.marginTop = '1.2em';
            mensaje.style.fontWeight = '700';
            mensaje.style.fontSize = '1.1rem';
            mensaje.style.boxShadow = '0 4px 18px rgba(127,166,199,0.13), 0 0 0 2px #bfa13a44';
            mensaje.style.textAlign = 'center';
            mensaje.style.letterSpacing = '1px';
            mensaje.style.transition = 'all 0.4s cubic-bezier(.4,0,.2,1)';
            mensaje.style.opacity = '0';
            setTimeout(() => { mensaje.style.opacity = '1'; }, 30);
        }
    }

    function validateEmail(email) {
        // Validación básica de email
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Animación loading espectacular mejorada
    function startSpectacularLoading(userName) {
        const progressFill = document.querySelector('.progress-fill');
        const progressPercentage = document.querySelector('.progress-percentage');
        const loadingSubtitle = document.querySelector('.loading-subtitle');
        const loadingText = document.querySelector('.loading-text');
        let progress = 0;
        const duration = 8000; // 8 segundos
        const startTime = performance.now();
        if (progressFill) {
            progressFill.style.width = '0%';
            progressFill.style.background = 'linear-gradient(90deg, #bfa13a 0%, #7fa6c7 100%)';
            progressFill.style.boxShadow = '0 0 16px #bfa13a55, 0 0 8px #7fa6c755';
        }
        if (progressPercentage) progressPercentage.textContent = '0%';
        if (loadingSubtitle) loadingSubtitle.textContent = 'Iniciando sesión...';

        // Eliminar mensaje de bienvenida anterior si existe
        let welcomeMsg = document.querySelector('.loading-welcome');
        if (welcomeMsg) welcomeMsg.remove();

        function animate() {
            const now = performance.now();
            const elapsed = now - startTime;
            progress = Math.min((elapsed / duration) * 100, 100);
            if (progressFill) progressFill.style.width = progress + '%';
            if (progressPercentage) progressPercentage.textContent = Math.round(progress) + '%';
            if (loadingSubtitle) {
                if (progress < 25) loadingSubtitle.textContent = 'Inicializando sistema...';
                else if (progress < 50) loadingSubtitle.textContent = 'Cargando datos...';
                else if (progress < 75) loadingSubtitle.textContent = 'Conectando servidores...';
                else if (progress < 100) loadingSubtitle.textContent = 'Finalizando...';
                else loadingSubtitle.textContent = '¡Listo!';
            }
            if (progress < 100) {
                requestAnimationFrame(animate);
            } else {
                setTimeout(() => {
                    if (loadingText) {
                        const msg = document.createElement('div');
                        msg.className = 'loading-welcome';
                        msg.innerHTML = `¡Bienvenido, <b>${userName}</b>!`;
                        msg.style.position = 'fixed';
                        msg.style.left = '50%';
                        msg.style.top = '50%';
                        msg.style.transform = 'translate(-50%, 40%) scale(0.7)';
                        msg.style.background = 'rgba(30,32,38,0.72)';
                        msg.style.backdropFilter = 'blur(6px)';
                        msg.style.padding = '1.5em 3em';
                        msg.style.borderRadius = '22px';
                        msg.style.boxShadow = '0 12px 40px rgba(127,166,199,0.18), 0 0 32px #bfa13a44, 0 0 0 4px #7fa6c755';
                        msg.style.fontSize = '2.3rem';
                        msg.style.color = '#bfa13a';
                        msg.style.textShadow = '0 0 16px #7fa6c7, 0 0 32px #bfa13a';
                        msg.style.opacity = '0';
                        msg.style.fontWeight = 'bold';
                        msg.style.letterSpacing = '2px';
                        msg.style.zIndex = '99999';
                        msg.style.transition = 'all 1.2s cubic-bezier(.4,0,.2,1)';
                        msg.style.border = '2.5px solid #bfa13a';
                        document.body.appendChild(msg);
                        void msg.offsetWidth;
                        setTimeout(() => {
                            msg.style.opacity = '1';
                            msg.style.transform = 'translate(-50%, -50%) scale(1.13)';
                        }, 80);
                        setTimeout(() => {
                            msg.style.transform = 'translate(-50%, -60%) scale(1)';
                        }, 1300);
                        setTimeout(() => {
                            msg.style.opacity = '0';
                        }, 2400);
                        setTimeout(() => {
                            msg.remove();
                            window.location.href = 'home.html';
                        }, 2900);
                    } else {
                        window.location.href = 'home.html';
                    }
                }, 500);
            }
        }
        requestAnimationFrame(animate);
    }
});