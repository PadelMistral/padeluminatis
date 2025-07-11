import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { doc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

const registerForm = document.getElementById('registroForm');
const mensaje = document.getElementById('mensaje');

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Función para verificar si el email ya existe
async function checkEmailExists(email) {
  try {
    const q = query(collection(db, "usuarios"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error verificando email:", error);
    return false;
  }
}

// Función para verificar si el nombre de usuario ya existe
async function checkUsernameExists(nombreUsuario) {
  try {
    const q = query(collection(db, "usuarios"), where("nombreUsuario", "==", nombreUsuario));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error verificando nombre de usuario:", error);
    return false;
  }
}

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();
  const nombreUsuario = document.getElementById('nombre').value.trim();

  // Validaciones básicas
  if (!validateEmail(email)) {
    showError("❌ Formato de correo inválido");
    return;
  }

  if (password.length < 6) {
    showError("❌ La contraseña debe tener al menos 6 caracteres");
    return;
  }

  if (password !== confirmPassword) {
    showError("❌ Las contraseñas no coinciden");
    return;
  }

  if (nombreUsuario.length < 3) {
    showError("❌ El nombre debe tener al menos 3 caracteres");
    return;
  }

  // Mostrar mensaje de carga
  showLoading("⏳ Verificando disponibilidad...");

  try {
    // Verificar si el email ya existe
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      showError("❌ Este correo electrónico ya está registrado. Por favor, usa otro correo.");
      return;
    }

    // Verificar si el nombre de usuario ya existe
    const usernameExists = await checkUsernameExists(nombreUsuario);
    if (usernameExists) {
      showError("❌ Este nombre de usuario ya está registrado. Por favor, usa otro nombre.");
      return;
    }

    // Si todo está bien, proceder con el registro
    showLoading("⏳ Creando cuenta...");
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, "usuarios", user.uid), {
      email: user.email,
      nombreUsuario: nombreUsuario,
      aprobado: false,
      rol: "jugador",
      fechaRegistro: new Date(),
      uid: user.uid
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

function showLoading(text) {
  mensaje.textContent = text;
  mensaje.style.color = '#f39c12';
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