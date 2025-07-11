import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';

let usuarioActual = null;
let timeoutInactividad = null;
const TIEMPO_MAX_INACTIVIDAD = 10 * 60 * 1000; // 10 minutos

function cerrarSesionPorInactividad() {
  signOut(auth).finally(() => {
    window.location.href = 'index.html';
  });
}

function reiniciarTemporizadorInactividad() {
  if (timeoutInactividad) clearTimeout(timeoutInactividad);
  timeoutInactividad = setTimeout(cerrarSesionPorInactividad, TIEMPO_MAX_INACTIVIDAD);
}

function escucharActividadUsuario() {
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evento => {
    window.addEventListener(evento, reiniciarTemporizadorInactividad, { passive: true });
  });
}

async function actualizarDatosUsuario(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'usuarios', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      usuarioActual = {
        uid,
        familyPoints: data.familyPoints || 0,
        nivel: data.nivel || 'Sin nivel',
        puntosRanking: data.puntosRanking || 0,
        ...data
      };
      window.usuarioActual = usuarioActual;
      // Puedes actualizar la UI aquí si lo necesitas
    }
  } catch (error) {
    console.error('Error al actualizar datos del usuario:', error);
  }
}

function protegerPagina() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    await actualizarDatosUsuario(user.uid);
    reiniciarTemporizadorInactividad();
    escucharActividadUsuario();
  });
}

protegerPagina(); 