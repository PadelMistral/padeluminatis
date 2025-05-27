import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

const registerForm = document.getElementById('registerForm');
const mensaje = document.getElementById('mensaje');

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const nombreUsuario = document.getElementById('nombreUsuario').value.trim();

  // Validaciones
  if (!validateEmail(email)) {
    showError("❌ Formato de correo inválido");
    return;
  }

  if (password.length < 6) {
    showError("❌ La contraseña debe tener al menos 6 caracteres");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "usuarios", user.uid), {
      email: user.email,
      nombreUsuario: nombreUsuario,
      aprobado: false,
      rol: "jugador",
      fechaRegistro: new Date(),
      uid: user.uid // Campo crucial para las reglas
    });

    showSuccess("✅ Registro exitoso. Redirigiendo...");
    registerForm.reset();

    setTimeout(() => window.location.href = "index.html", 3000);

  } catch (error) {
    handleAuthError(error);
  }
});

// Helpers de mensajes
function showError(text) {
  mensaje.textContent = text;
  mensaje.style.color = '#e74c3c';
}

function showSuccess(text) {
  mensaje.textContent = text;
  mensaje.style.color = '#2ecc71';
}

// Manejador de errores
function handleAuthError(error) {
  const errorMap = {
    'auth/email-already-in-use': 'El correo ya está registrado',
    'auth/invalid-email': 'Correo electrónico inválido',
    'auth/weak-password': 'Contraseña demasiado débil',
    'permission-denied': 'Error de permisos: Contacta al administrador',
    'missing-permissions': 'No tienes permisos para esta acción'
  };

  showError(errorMap[error.code] || `Error desconocido: ${error.message}`);
  console.error("Error detallado:", error);
}