import { auth, db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

const linkAdmin = document.getElementById("link-admin");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const refUsuario = doc(db, "usuarios", user.uid);
      const docSnap = await getDoc(refUsuario);

      if (!docSnap.exists()) {
        console.warn("No existe el documento del usuario");
        return;
      }

      const datos = docSnap.data();
      console.log("Datos del usuario:", datos);

      if (datos.rol === "Admin") {
        if (linkAdmin) {
          linkAdmin.style.display = "inline";
        } else {
          console.warn("Elemento link-admin no encontrado");
        }
      } else {
        console.warn("El usuario no tiene rol Admin");
      }

    } catch (error) {
      console.error("Error al verificar rol:", error?.message || error);
    }
  } else {
    console.log("No hay usuario autenticado");
  }
});
