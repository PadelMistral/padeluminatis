import { auth } from './firebase-config.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('recuperarForm');
  const mensaje = document.getElementById('mensajeRecuperar');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('recuperarEmail').value;

    mensaje.style.color = 'black';
    mensaje.textContent = "Enviando correo de recuperación...";

    try {
      await sendPasswordResetEmail(auth, email);
      mensaje.style.color = 'green';
      mensaje.textContent = "Correo de recuperación enviado. Revisa tu bandeja de entrada.";
    } catch (error) {
      mensaje.style.color = 'red';
      if (error.code === 'auth/user-not-found') {
        mensaje.textContent = "No se encontró una cuenta con ese email.";
      } else {
        mensaje.textContent = `Error: ${error.message}`;
      }
    }
  });
});
