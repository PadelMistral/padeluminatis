import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
  const mensajesDiv = document.getElementById("mensajes");
  const formChat = document.getElementById("form-chat");
  const inputMensaje = document.getElementById("mensaje-input");
  const inputArchivo = document.getElementById("input-archivo");

  let usuarioActual = null;
  let nombreUsuarioActual = "Anónimo";

  function escucharMensajes() {
    if (!mensajesDiv) return;
    const mensajesRef = collection(db, "chat_publico");
    const q = query(mensajesRef, orderBy("timestamp", "asc"));

    onSnapshot(q, (querySnapshot) => {
      mensajesDiv.innerHTML = "";
      querySnapshot.forEach(docu => {
        const msg = docu.data();

        const divMensaje = document.createElement("div");
        divMensaje.classList.add("mensaje");

        const esPropio = (msg.from === usuarioActual.uid);
        divMensaje.classList.add(esPropio ? "yo" : "otro");

        const nombreUsuario = esPropio ? "Yo" : (msg.nombreUsuarioFrom || "Anónimo");

        if (msg.tipo === "texto") {
          divMensaje.innerHTML = `<strong>${nombreUsuario}:</strong> ${msg.texto}`;
        } else if (msg.tipo === "imagen") {
          divMensaje.innerHTML = `<strong>${nombreUsuario}:</strong><br/><img src="${msg.urlArchivo}" alt="Imagen enviada" style="max-width:200px; border-radius:8px;" />`;
        } else {
          divMensaje.textContent = "Mensaje con formato no reconocido.";
        }

        mensajesDiv.appendChild(divMensaje);
        mensajesDiv.scrollTop = mensajesDiv.scrollHeight;
      });
    });
  }

  async function enviarMensaje(event) {
    event.preventDefault();

    if (!usuarioActual) {
      alert("No estás autenticado.");
      return;
    }

    const texto = inputMensaje.value.trim();
    const archivo = inputArchivo.files[0];

    if (!texto && !archivo) {
      alert("Escribe un mensaje o adjunta un archivo.");
      return;
    }

    try {
      let mensajeData = {
        from: usuarioActual.uid,
        nombreUsuarioFrom: nombreUsuarioActual,
        timestamp: serverTimestamp(),
      };

      if (archivo) {
        const storageRef = ref(storage, `chat_publico/${usuarioActual.uid}/${Date.now()}_${archivo.name}`);
        await uploadBytes(storageRef, archivo);
        const urlArchivo = await getDownloadURL(storageRef);

        mensajeData.tipo = "imagen";
        mensajeData.urlArchivo = urlArchivo;
      } else {
        mensajeData.tipo = "texto";
        mensajeData.texto = texto;
      }

      await addDoc(collection(db, "chat_publico"), mensajeData);

      inputMensaje.value = "";
      inputArchivo.value = "";

    } catch (error) {
      alert("Error al enviar mensaje: " + error.message);
    }
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    usuarioActual = user;

    try {
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        nombreUsuarioActual = data.nombreUsuario || "Anónimo";
      }
    } catch (error) {
      console.error("Error obteniendo el nombre de usuario:", error);
    }

    escucharMensajes();
  });

  if (formChat) {
    formChat.addEventListener("submit", enviarMensaje);
  }
});
