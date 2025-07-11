// js/chat.js
import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
  const mensajesDiv = document.getElementById("mensajes");
  const formChat = document.getElementById("form-chat");
  const inputMensaje = document.getElementById("mensaje-input");
  const inputArchivo = document.getElementById("input-archivo");

  let usuarioActual = null;
  let nombreUsuarioActual = "Anónimo";

  // Función para verificar si hay mensajes en la colección
  async function verificarMensajes() {
    try {
      const mensajesRef = collection(db, "chat_publico");
      const querySnapshot = await getDocs(mensajesRef);
      console.log("Número de mensajes encontrados:", querySnapshot.size);
      querySnapshot.forEach(doc => {
        console.log("Mensaje:", doc.data());
      });
    } catch (error) {
      console.error("Error al verificar mensajes:", error);
    }
  }

  function escucharMensajes() {
    if (!mensajesDiv) {
      console.error("No se encontró el elemento mensajesDiv");
      return;
    }

    console.log("Iniciando escucha de mensajes...");
    const mensajesRef = collection(db, "chat_publico");
    const q = query(mensajesRef, orderBy("timestamp", "asc"));

    onSnapshot(q, (querySnapshot) => {
      console.log("Nuevos mensajes recibidos:", querySnapshot.size);
      mensajesDiv.innerHTML = "";
      
      querySnapshot.forEach(docu => {
        const msg = docu.data();
        console.log("Procesando mensaje:", msg);

        const divMensaje = document.createElement("div");
        divMensaje.classList.add("mensaje");

        const esPropio = usuarioActual && (msg.from === usuarioActual.uid);
        divMensaje.classList.add(esPropio ? "yo" : "otro");

        const nombreUsuario = esPropio ? "Yo" : (msg.nombreUsuarioFrom || "Anónimo");
        let hora = '';
        
        if (msg.timestamp) {
          try {
            const fecha = msg.timestamp.toDate();
            hora = fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (error) {
            console.error("Error al procesar timestamp:", error);
            hora = 'Hora no disponible';
          }
        }

        if (msg.tipo === "texto") {
          divMensaje.innerHTML = `
            <div class="mensaje-contenido">
              <strong>${nombreUsuario}</strong>
              <div class="mensaje-texto">${msg.texto}</div>
              <span class="mensaje-hora">${hora}</span>
            </div>`;
        } else if (msg.tipo === "imagen") {
          divMensaje.innerHTML = `
            <div class="mensaje-contenido">
              <strong>${nombreUsuario}</strong>
              <div class="mensaje-imagen">
                <img src="${msg.urlArchivo}" alt="Imagen enviada" loading="lazy" />
              </div>
              <span class="mensaje-hora">${hora}</span>
            </div>`;
        } else {
          divMensaje.textContent = "Mensaje con formato no reconocido.";
        }

        mensajesDiv.appendChild(divMensaje);
      });

      // Scroll al final después de cargar todos los mensajes
      mensajesDiv.scrollTop = mensajesDiv.scrollHeight;
    }, (error) => {
      console.error("Error en la escucha de mensajes:", error);
    });
  }

  async function enviarMensaje(event) {
    event.preventDefault();

    if (!usuarioActual) {
      console.error("Usuario no autenticado");
      alert("No estás autenticado.");
      return;
    }

    const texto = inputMensaje.value.trim();
    const archivo = inputArchivo.files[0];

    if (!texto && !archivo) {
      console.log("No hay contenido para enviar");
      return;
    }

    try {
      console.log("Enviando mensaje...");
      let mensajeData = {
        from: usuarioActual.uid,
        nombreUsuarioFrom: nombreUsuarioActual,
        timestamp: serverTimestamp(),
      };

      if (archivo) {
        console.log("Procesando archivo...");
        const storageRef = ref(storage, `chat_publico/${usuarioActual.uid}/${Date.now()}_${archivo.name}`);
        await uploadBytes(storageRef, archivo);
        const urlArchivo = await getDownloadURL(storageRef);

        mensajeData.tipo = "imagen";
        mensajeData.urlArchivo = urlArchivo;
      } else {
        mensajeData.tipo = "texto";
        mensajeData.texto = texto;
      }

      const docRef = await addDoc(collection(db, "chat_publico"), mensajeData);
      console.log("Mensaje enviado con ID:", docRef.id);

      inputMensaje.value = "";
      inputArchivo.value = "";

    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      alert("Error al enviar mensaje. Por favor, intenta de nuevo.");
    }
  }

  onAuthStateChanged(auth, async (user) => {
    console.log("Estado de autenticación cambiado:", user ? "Usuario autenticado" : "No hay usuario");
    
    if (!user) {
      console.log("No hay usuario autenticado");
      return;
    }

    usuarioActual = user;
    console.log("Usuario actual:", user.uid);

    try {
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        nombreUsuarioActual = data.nombreUsuario || "Anónimo";
        console.log("Nombre de usuario obtenido:", nombreUsuarioActual);
      }
    } catch (error) {
      console.error("Error obteniendo el nombre de usuario:", error);
    }

    // Verificar mensajes existentes
    await verificarMensajes();
    
    // Iniciar escucha de mensajes
    escucharMensajes();
  });

  if (formChat) {
    formChat.addEventListener("submit", enviarMensaje);
  }

  // Inicializar funcionalidades
  initializeEmojiPicker();
  initializeFileUpload();

  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error al establecer persistencia de sesión:', error);
  });
});

// Inicializar el selector de emoticonos
function inicializarEmojiPicker() {
    const emojiButton = document.querySelector('.emoji-button');
    const messageInput = document.querySelector('.message-input');
    
    // Crear el contenedor del emoji picker si no existe
    let emojiPicker = document.querySelector('.emoji-picker');
    if (!emojiPicker) {
        emojiPicker = document.createElement('div');
    emojiPicker.className = 'emoji-picker';
        document.querySelector('.message-input-container').appendChild(emojiPicker);
    }
    
    // Categorías de emoticonos
    const emojis = {
        'recent': ['😀', '😂', '❤️', '👍', '🎉'],
        'smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕'],
        'people': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸'],
        'animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'],
        'food': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍷', '🥂', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂'],
        'activities': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '⛸️', '🎣', '🤿', '🎽', '🛹', '🛷', '⛷️', '🏂', '🏋️‍♀️', '🏋️', '🤼‍♀️', '🤼', '🤸‍♀️', '🤸', '⛹️‍♀️', '⛹️', '🤺', '🤾‍♀️', '🤾', '🏌️‍♀️', '🏌️', '🏄‍♀️', '🏄', '🏊‍♀️', '🏊', '🤽‍♀️', '🤽', '🚣‍♀️', '🚣', '🏇', '🧘‍♀️', '🧘', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹‍♀️', '🤹', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩', '🎨', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🪝', '🧲', '🔫', '💣', '🪃', '🏹', '🪄', '🛡️', '🪞', '🔍', '🔎', '🕳️', '🪟', '🛏️', '🪑', '🚪', '🪞', '🛋️', '🪣', '🚰', '🚿', '🛁', '🪠', '🧻', '🪢', '🧸', '🪆', '🧷', '🪡', '🧹', '🪠', '🧺', '🧻', '🪣', '🧼', '🫧', '🪥', '🧽', '🪦', '🪧', '🪨', '🪩', '🪪', '🪫', '🪬', '🪮', '🪯', '🪰', '🪱', '🪲', '🪳', '🪴', '🪵', '🪶', '🪷', '🪸', '🪹', '🪺', '🫀', '🫁', '🫂', '🫃', '🫄', '🫅', '🫖', '🫗', '🫘', '🫙', '🫠', '🫡', '🫢', '🫣', '🫤', '🫥', '🫦', '🫧', '🫰', '🫱', '🫲', '🫳', '🫴', '🫵', '🫶', '🫷', '🫸', '🫹', '🫺', '🫻', '🫼', '🫽', '🫾', '🫿'],
        'travel': ['✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉'],
        'objects': ['⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🪝', '🧲', '🔫', '💣', '🪃', '🏹', '🪄', '🛡️', '🪞', '🔍', '🔎', '🕳️', '🪟', '🛏️', '🪑', '🚪', '🪞', '🛋️', '🪣', '🚰', '🚿', '🛁', '🪠', '🧻', '🪢', '🧸', '🪆', '🧷', '🪡', '🧹', '🪠', '🧺', '🧻', '🪣', '🧼', '🫧', '🪥', '🧽', '🪦', '🪧', '🪨', '🪩', '🪪', '🪫', '🪬', '🪮', '🪯', '🪰', '🪱', '🪲', '🪳', '🪴', '🪵', '🪶', '🪷', '🪸', '🪹', '🪺', '🫀', '🫁', '🫂', '🫃', '🫄', '🫅', '🫖', '🫗', '🫘', '🫙', '🫠', '🫡', '🫢', '🫣', '🫤', '🫥', '🫦', '🫧', '🫰', '🫱', '🫲', '🫳', '🫴', '🫵', '🫶', '🫷', '🫸', '🫹', '🫺', '🫻', '🫼', '🫽', '🫾', '🫿'],
        'symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💝', '💘', '💌', '💋', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸']
    };

    // Crear el contenido del selector de emoticonos
    function crearEmojiPicker() {
        // Limpiar el contenido existente
        emojiPicker.innerHTML = '';

        // Crear barra de búsqueda
        const search = document.createElement('input');
        search.type = 'text';
        search.className = 'emoji-search';
        search.placeholder = 'Buscar emoji...';
        emojiPicker.appendChild(search);

    // Crear categorías
        const categories = document.createElement('div');
        categories.className = 'emoji-categories';
    
        // Añadir botones de categoría
        Object.keys(emojis).forEach(category => {
        const button = document.createElement('button');
        button.className = 'emoji-category';
            button.textContent = emojis[category][0];
            button.dataset.category = category;
            categories.appendChild(button);
        });
        emojiPicker.appendChild(categories);

        // Crear grid de emoticonos
        const grid = document.createElement('div');
        grid.className = 'emoji-grid';
        emojiPicker.appendChild(grid);

        // Mostrar la categoría por defecto
        mostrarCategoria('recent');
    }

    // Mostrar emoticonos de una categoría
    function mostrarCategoria(category) {
        const grid = emojiPicker.querySelector('.emoji-grid');
        grid.innerHTML = '';
        
        emojis[category].forEach(emoji => {
            const span = document.createElement('span');
            span.className = 'emoji-item';
            span.textContent = emoji;
            span.onclick = () => {
                messageInput.value += emoji;
                messageInput.focus();
            };
            grid.appendChild(span);
        });

        // Actualizar categoría activa
        emojiPicker.querySelectorAll('.emoji-category').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
    }

    // Búsqueda de emoticonos
    function buscarEmojis(query) {
        const grid = emojiPicker.querySelector('.emoji-grid');
        grid.innerHTML = '';
        
        const resultados = [];
        Object.values(emojis).forEach(category => {
            category.forEach(emoji => {
                if (emoji.includes(query)) {
                    resultados.push(emoji);
                }
            });
        });

        resultados.forEach(emoji => {
            const span = document.createElement('span');
            span.className = 'emoji-item';
            span.textContent = emoji;
            span.onclick = () => {
                messageInput.value += emoji;
                messageInput.focus();
            };
            grid.appendChild(span);
        });
    }

    // Event Listeners
    if (emojiButton) {
        emojiButton.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPicker.classList.toggle('active');
            if (emojiPicker.classList.contains('active')) {
                mostrarCategoria('recent');
            }
        });
    }

    const searchInput = emojiPicker.querySelector('.emoji-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (e.target.value) {
                buscarEmojis(e.target.value);
            } else {
                mostrarCategoria('recent');
            }
        });
    }

    emojiPicker.querySelectorAll('.emoji-category').forEach(btn => {
        btn.addEventListener('click', () => {
            mostrarCategoria(btn.dataset.category);
        });
    });

    // Cerrar el picker al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && !emojiButton.contains(e.target)) {
            emojiPicker.classList.remove('active');
        }
    });

    // Inicializar el picker
    crearEmojiPicker();
}

// Llamar a la función cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    inicializarEmojiPicker();
});