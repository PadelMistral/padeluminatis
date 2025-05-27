// admin.js (completo y actualizado con "Volver", edición y eliminación de partidos pendientes)
import { auth, db } from './firebase-config.js';
import {
  collection,
  collectionGroup,
  getDocs,
  addDoc,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

const selectJugador1 = document.getElementById("select-jugador1");
const selectJugador2 = document.getElementById("select-jugador2");
const btnCrearEquipo = document.getElementById("btn-crear-equipo");
const listaEquipos = document.getElementById("lista-equipos-admin");
const listaUsuarios = document.getElementById("lista-usuarios");
const btnCrearJornada = document.getElementById("btn-crear-jornada");
const btnAnadirPartido = document.getElementById("btn-anadir-partido");
const btnVolver = document.getElementById("btn-volver") || (() => {
  const btn = document.createElement("button");
  btn.id = "btn-volver";
  btn.textContent = "Volver";
  document.body.insertBefore(btn, document.body.firstChild);
  return btn;
})();
const partidosJornada = document.getElementById("partidos-jornada");
const nombreJornada = document.getElementById("nombre-jornada");
const partidosJugadosDiv = document.getElementById("partidos-jugados");
const partidosPendientesDiv = document.getElementById("partidos-pendientes") || (() => {
  const div = document.createElement("div");
  div.id = "partidos-pendientes";
  div.className = "lista-partidos-pendientes";
  partidosJugadosDiv.parentElement.appendChild(div);
  return div;
})();

let usuariosMap = {};
let equiposMap = {};
let partidosPorJornada = [];

async function cargarUsuarios() {
  const q = query(collection(db, "usuarios"), where("aprobado", "==", true));
  const usuariosSnap = await getDocs(q);

  usuariosMap = {};
  selectJugador1.innerHTML = '';
  selectJugador2.innerHTML = '';

  usuariosSnap.forEach(docu => {
    const data = docu.data();
    usuariosMap[docu.id] = data.nombreUsuario;

    const option = document.createElement("option");
    option.value = docu.id;
    option.textContent = data.nombreUsuario;

    selectJugador1.appendChild(option.cloneNode(true));
    selectJugador2.appendChild(option.cloneNode(true));
  });
}

function escucharUsuarios() {
  onSnapshot(collection(db, "usuarios"), (snapshot) => {
    listaUsuarios.innerHTML = "";

    snapshot.forEach(docu => {
      const usuario = docu.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <span>${usuario.nombreUsuario} (${usuario.email})</span>
          <button class="${usuario.aprobado ? 'rechazar' : 'aprobar'}" 
                  data-id="${docu.id}" 
                  data-estado="${usuario.aprobado}">
            ${usuario.aprobado ? 'Rechazar' : 'Aprobar'}
          </button>
          <button class="eliminar-usuario" data-id="${docu.id}">Eliminar</button>
        </div>
      `;
      listaUsuarios.appendChild(li);
    });

    // Botones aprobar/rechazar
    document.querySelectorAll('#lista-usuarios button.aprobar, #lista-usuarios button.rechazar').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.target.dataset.id;
        const nuevoEstado = e.target.dataset.estado === "true" ? false : true;
        await updateDoc(doc(db, "usuarios", userId), { aprobado: nuevoEstado });
      });
    });

    // Botones eliminar
    document.querySelectorAll('#lista-usuarios button.eliminar-usuario').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.target.dataset.id;
        if (confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) {
          await deleteDoc(doc(db, "usuarios", userId));
          alert("Usuario eliminado correctamente");
        }
      });
    });
  });
}

function escucharEquipos() {
  onSnapshot(collection(db, "equipos"), (snapshot) => {
    listaEquipos.innerHTML = "";
    equiposMap = {};

    snapshot.forEach(docu => {
      const eq = docu.data();
      equiposMap[docu.id] = eq.nombre;

      const li = document.createElement("li");
      li.innerHTML = `
        <span>${eq.nombre}</span>
        <button class="eliminar-equipo" data-id="${docu.id}">Eliminar</button>
      `;
      listaEquipos.appendChild(li);
    });

    document.querySelectorAll('.eliminar-equipo').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const equipoId = e.target.dataset.id;
        if (confirm("¿Eliminar este equipo?")) {
          await deleteDoc(doc(db, "equipos", equipoId));
        }
      });
    });
  });
}

btnCrearEquipo.addEventListener("click", async () => {
  const jugador1Id = selectJugador1.value;
  const jugador2Id = selectJugador2.value;

  if (!jugador1Id || !jugador2Id) {
    alert("Selecciona ambos jugadores.");
    return;
  }

  if (jugador1Id === jugador2Id) {
    alert("Selecciona jugadores distintos.");
    return;
  }

  // Consultar todos los equipos
  const equiposSnap = await getDocs(collection(db, "equipos"));

  // Verificar si alguno de los jugadores ya pertenece a un equipo
  let jugador1EnEquipo = false;
  let jugador2EnEquipo = false;

  equiposSnap.forEach(doc => {
    const jugadores = doc.data().jugadores || [];
    if (jugadores.includes(jugador1Id)) jugador1EnEquipo = true;
    if (jugadores.includes(jugador2Id)) jugador2EnEquipo = true;
  });

  if (jugador1EnEquipo || jugador2EnEquipo) {
    alert("Uno o ambos jugadores ya pertenecen a un equipo y no pueden estar en otro.");
    return;
  }

  // Crear el equipo si pasa las validaciones
  const nombreEquipo = `${usuariosMap[jugador1Id]} y ${usuariosMap[jugador2Id]}`;

  await addDoc(collection(db, "equipos"), {
    nombre: nombreEquipo,
    jugadores: [jugador1Id, jugador2Id],
    timestamp: serverTimestamp()
  });

  alert("Equipo creado correctamente");
  selectJugador1.value = "";
  selectJugador2.value = "";
});


btnAnadirPartido.addEventListener("click", () => {
  const contenedorPartido = document.createElement("div");
  contenedorPartido.className = "partido";

  const select1 = document.createElement("select");
  const select2 = document.createElement("select");
  const inputFecha = document.createElement("input");
  inputFecha.type = "datetime-local";
  inputFecha.className = "fecha-partido";

  Object.entries(equiposMap).forEach(([id, nombre]) => {
    [select1, select2].forEach(select => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = nombre;
      select.appendChild(option.cloneNode(true));
    });
  });

  contenedorPartido.appendChild(select1);
  contenedorPartido.appendChild(document.createTextNode(" vs "));
  contenedorPartido.appendChild(select2);
  contenedorPartido.appendChild(document.createTextNode(" - Fecha y hora: "));
  contenedorPartido.appendChild(inputFecha);

  partidosJornada.appendChild(contenedorPartido);
  partidosPorJornada.push(contenedorPartido);
});

btnVolver.addEventListener("click", () => {
  window.location.href = "index.html";
});

btnCrearJornada.addEventListener("click", async () => {
  if (partidosPorJornada.length === 0) {
    alert("¡Añade al menos un partido!");
    return;
  }

  const jornadaRef = await addDoc(collection(db, "calendario"), {
    nombre: nombreJornada.value,
    fecha: serverTimestamp(),
    estado: "pendiente"
  });

  const partidosJugadosSnap = await getDocs(collectionGroup(db, "partidos"));
  const partidosExistentes = new Set();

  partidosJugadosSnap.forEach(doc => {
    const data = doc.data();
    const clave = [data.equipoLocal, data.equipoVisitante].sort().join("-");
    partidosExistentes.add(clave);
  });

  for (const partido of partidosPorJornada) {
    const selects = partido.querySelectorAll("select");
    const equipo1 = selects[0]?.value;
    const equipo2 = selects[1]?.value;
    const fechaInput = partido.querySelector("input[type='datetime-local']").value;

    if (!equipo1 || !equipo2) continue;
    if (equipo1 === equipo2) continue;

    const clave = [equipo1, equipo2].sort().join("-");
    if (partidosExistentes.has(clave)) {
      alert("Uno de los partidos ya fue jugado anteriormente");
      continue;
    }

    await addDoc(collection(db, `calendario/${jornadaRef.id}/partidos`), {
      equipoLocal: equipo1,
      equipoVisitante: equipo2,
      resultado: null,
      fecha: Timestamp.fromDate(new Date(fechaInput)),
      estado: "pendiente"
    });
  }

  alert("Jornada creada con éxito");
  partidosPorJornada = [];
  partidosJornada.innerHTML = "";
  nombreJornada.value = "";
});

function cargarPartidosJugados() {
  onSnapshot(collection(db, "calendario"), async (snapshot) => {
    const jugados = [];
    const pendientes = [];

    for (const jornadaDoc of snapshot.docs) {
      const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
      for (const partidoDoc of partidosSnap.docs) {
        const data = partidoDoc.data();
        const entry = { id: partidoDoc.id, jornadaId: jornadaDoc.id, ...data };
        if (data.resultado) jugados.push(entry);
        else pendientes.push(entry);
      }
    }

    mostrarPartidosJugados(jugados);
    mostrarPartidosPendientes(pendientes);
  });
}

async function mostrarPartidosJugados(partidos) {
  partidosJugadosDiv.innerHTML = "";
  const lista = document.createElement("div");
  lista.className = "admin-partidos-lista";

  const partidosCards = await Promise.all(partidos.map(async partido => {
    const [localSnap, visitanteSnap] = await Promise.all([
      getDoc(doc(db, "equipos", partido.equipoLocal)),
      getDoc(doc(db, "equipos", partido.equipoVisitante))
    ]);

    const local = localSnap.data();
    const visitante = visitanteSnap.data();

    const div = document.createElement("div");
    div.className = "admin-partido-card";
    div.dataset.partidoId = partido.id;
    div.dataset.jornadaId = partido.jornadaId;

    div.innerHTML = `
      <h3>${local.nombre} vs ${visitante.nombre}</h3>
      <div class="resultado-display">${formatearResultado(partido.resultado)}</div>
      <button class="editar-resultado">Editar Resultado</button>
      <button class="borrar-partido" style="margin-left:10px; color:red;">Borrar Partido</button>
      <form class="form-editar-resultado" style="display:none; margin-top:10px;">
        <label>Set 1: <input type="number" name="set1p1" min="0" max="99" value="${partido.resultado.set1?.puntos1 ?? 0}"> -
                <input type="number" name="set1p2" min="0" max="99" value="${partido.resultado.set1?.puntos2 ?? 0}"></label><br>
        <label>Set 2: <input type="number" name="set2p1" min="0" max="99" value="${partido.resultado.set2?.puntos1 ?? 0}"> -
                <input type="number" name="set2p2" min="0" max="99" value="${partido.resultado.set2?.puntos2 ?? 0}"></label><br>
        <label>Set 3: <input type="number" name="set3p1" min="0" max="99" value="${partido.resultado.set3?.puntos1 ?? 0}"> -
                <input type="number" name="set3p2" min="0" max="99" value="${partido.resultado.set3?.puntos2 ?? 0}"></label><br>
        <button type="submit">Guardar</button>
        <button type="button" class="cancelar-edicion">Cancelar</button>
      </form>
    `;
    return div;
  }));

  partidosCards.forEach(div => lista.appendChild(div));
  partidosJugadosDiv.appendChild(lista);

  // Delegación de eventos
  lista.addEventListener("click", async (e) => {
    const partidoDiv = e.target.closest(".admin-partido-card");
    if (!partidoDiv) return;

    const partidoId = partidoDiv.dataset.partidoId;
    const jornadaId = partidoDiv.dataset.jornadaId;

    if (e.target.classList.contains("editar-resultado")) {
      partidoDiv.querySelector(".resultado-display").style.display = "none";
      partidoDiv.querySelector(".editar-resultado").style.display = "none";
      partidoDiv.querySelector(".form-editar-resultado").style.display = "block";
    }

    if (e.target.classList.contains("cancelar-edicion")) {
      partidoDiv.querySelector(".form-editar-resultado").style.display = "none";
      partidoDiv.querySelector(".resultado-display").style.display = "block";
      partidoDiv.querySelector(".editar-resultado").style.display = "inline-block";
    }

    if (e.target.classList.contains("borrar-partido")) {
      const confirmar = confirm("¿Estás seguro de que quieres borrar este partido?");
      if (!confirmar) return;

      try {
        await deleteDoc(doc(db, `calendario/${jornadaId}/partidos/${partidoId}`));
        alert("Partido borrado correctamente.");
        partidoDiv.remove();
      } catch (error) {
        alert("Error al borrar el partido: " + error.message);
      }
    }
  });

  // Guardar resultados
  lista.addEventListener("submit", async (ev) => {
    if (!ev.target.classList.contains("form-editar-resultado")) return;

    ev.preventDefault();

    const partidoDiv = ev.target.closest(".admin-partido-card");
    const partidoId = partidoDiv.dataset.partidoId;
    const jornadaId = partidoDiv.dataset.jornadaId;

    const formData = new FormData(ev.target);

    const nuevoResultado = {
      set1: {
        puntos1: Number(formData.get("set1p1")),
        puntos2: Number(formData.get("set1p2")),
      },
      set2: {
        puntos1: Number(formData.get("set2p1")),
        puntos2: Number(formData.get("set2p2")),
      },
      set3: {
        puntos1: Number(formData.get("set3p1")),
        puntos2: Number(formData.get("set3p2")),
      }
    };

    try {
      await updateDoc(doc(db, `calendario/${jornadaId}/partidos/${partidoId}`), {
        resultado: nuevoResultado
      });

      alert("Resultado actualizado");

      partidoDiv.querySelector(".resultado-display").textContent = formatearResultado(nuevoResultado);
      partidoDiv.querySelector(".resultado-display").style.display = "block";
      ev.target.style.display = "none";
      partidoDiv.querySelector(".editar-resultado").style.display = "inline-block";

    } catch (error) {
      alert("Error al guardar el resultado: " + error.message);
    }
  });
}



function mostrarPartidosPendientes(partidos) {
  partidosPendientesDiv.innerHTML = "<h3>Partidos Pendientes</h3>";
  const lista = document.createElement("ul");

  partidos.forEach(async partido => {
    const [localSnap, visitanteSnap] = await Promise.all([
      getDoc(doc(db, "equipos", partido.equipoLocal)),
      getDoc(doc(db, "equipos", partido.equipoVisitante))
    ]);
    const local = localSnap.data();
    const visitante = visitanteSnap.data();
    const li = document.createElement("li");
    const fecha = partido.fecha?.toDate?.().toLocaleString("es-ES") || "Sin fecha";

    li.innerHTML = `
      ${local.nombre} vs ${visitante.nombre} → ${fecha}
      <button class="editar-fecha" data-id="${partido.id}" data-jornada="${partido.jornadaId}">Editar</button>
      <button class="borrar-partido" data-id="${partido.id}" data-jornada="${partido.jornadaId}">Borrar</button>
    `;
    lista.appendChild(li);
  });

  partidosPendientesDiv.appendChild(lista);

  lista.addEventListener("click", async (e) => {
    const partidoId = e.target.dataset.id;
    const jornadaId = e.target.dataset.jornada;

    if (e.target.classList.contains("borrar-partido")) {
      if (confirm("¿Eliminar este partido pendiente?")) {
        await deleteDoc(doc(db, `calendario/${jornadaId}/partidos/${partidoId}`));
      }
    }

    if (e.target.classList.contains("editar-fecha")) {
      const nuevaFechaStr = prompt("Introduce nueva fecha y hora (YYYY-MM-DDTHH:mm)");
      if (!nuevaFechaStr) return;
      const nuevaFecha = new Date(nuevaFechaStr);
      if (isNaN(nuevaFecha)) return alert("Fecha inválida");
      await updateDoc(doc(db, `calendario/${jornadaId}/partidos/${partidoId}`), {
        fecha: Timestamp.fromDate(nuevaFecha)
      });
      alert("Fecha actualizada");
    }
  });
}

function formatearResultado(resultado) {
  return [1, 2, 3].map(set => `Set ${set}: ${resultado[`set${set}`]?.puntos1}-${resultado[`set${set}`]?.puntos2}`).join(" | ");
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    const userData = userDoc.exists() ? userDoc.data() : null;

    if (userData?.rol === "Admin") {
      cargarUsuarios();
      escucharEquipos();
      escucharUsuarios();
      cargarPartidosJugados();
    } else {
      alert("Acceso restringido. No eres administrador.");
      window.location.href = "index.html";
    }
  } else {
    window.location.href = "index.html";
  }
});

