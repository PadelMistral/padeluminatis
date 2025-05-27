// js/login.js
import { auth, db } from './firebase-config.js';  // ajusta ruta si es necesario
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const mensaje = document.getElementById('mensaje');
  const boton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    mensaje.style.color = 'black';
    mensaje.textContent = "Iniciando sesión...";
    boton.disabled = true;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const docRef = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.aprobado) {
          mensaje.style.color = 'green';
          mensaje.textContent = "Inicio de sesión exitoso. Redirigiendo...";
          setTimeout(() => {
            window.location.href = "home.html";
          }, 2000);
        } else {
          mensaje.style.color = 'red';
          mensaje.textContent = "Tu cuenta aún no ha sido aprobada.";
          boton.disabled = false;
        }
      } else {
        mensaje.style.color = 'red';
        mensaje.textContent = "Error: No se encontró información del usuario.";
        boton.disabled = false;
      }
    } catch (error) {
      mensaje.style.color = 'red';
      mensaje.textContent = `Error: ${error.message}`;
      boton.disabled = false;
    }
  });
});
