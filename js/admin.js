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
  Timestamp,
  setDoc
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
      const rolActual = usuario.rol || 'Jugador';
      const nivelActual = usuario.nivel || '1.0';
      const familyPoints = usuario.familyPoints || '500';
      const puntosRanking = usuario.puntosRanking || '500';
      
      const userCard = document.createElement("details");
      userCard.className = "user-card";
      userCard.innerHTML = `
        <summary class="user-header">
          <div class="user-avatar">
            <i class="fas fa-user"></i>
          </div>
          <div class="user-info">
            <h3>${usuario.nombreUsuario} <span class="user-level">nivel ${nivelActual}</span></h3>
            <div class="user-email">${usuario.email}</div>
          </div>
        </summary>
        <div class="user-details">
          <div class="user-detail-row">
            <span class="detail-label">Rol actual:</span>
            <span class="detail-value">${rolActual}</span>
            <button class="btn-change" data-id="${docu.id}" data-action="change-role" data-current-role="${rolActual}">
              Cambiar rol
            </button>
          </div>
          <div class="user-detail-row">
            <span class="detail-label">Nivel:</span>
            <input type="text" class="detail-input nivel-input" data-id="${docu.id}" value="${nivelActual}" 
                   placeholder="1.0" pattern="[0-9]+(\.[0-9]+)?" title="Formato: número.número (ej: 1.5)">
            <button class="btn-change" data-id="${docu.id}" data-action="save-level">
              Cambiar
            </button>
          </div>
          <div class="user-detail-row">
            <span class="detail-label">FamilyPoints:</span>
            <input type="number" class="detail-input family-points-input" data-id="${docu.id}" value="${familyPoints}" 
                   placeholder="500" min="0" step="1">
            <button class="btn-change" data-id="${docu.id}" data-action="save-family-points">
              Cambiar
            </button>
          </div>
          <div class="user-detail-row">
            <span class="detail-label">PuntosRanking:</span>
            <input type="number" class="detail-input puntos-ranking-input" data-id="${docu.id}" value="${puntosRanking}" 
                   placeholder="200" min="0" step="1">
            <button class="btn-change" data-id="${docu.id}" data-action="save-ranking-points">
              Cambiar
            </button>
          </div>
          <div class="user-detail-row">
            <span class="detail-label">Estado:</span>
            <span class="detail-value">${usuario.aprobado ? 'Aprobado' : 'Pendiente'}</span>
            <button class="btn-change ${usuario.aprobado ? 'btn-cancel' : ''}" 
                    data-id="${docu.id}" 
                    data-action="${usuario.aprobado ? 'reject' : 'approve'}"
                    data-estado="${usuario.aprobado}">
              ${usuario.aprobado ? 'Rechazar' : 'Aprobar'}
            </button>
          </div>
        </div>
        <div class="user-actions">
          <button class="btn-save" data-id="${docu.id}" data-action="save-all">
            <i class="fas fa-save"></i> Guardar cambios
          </button>
          <button class="btn-cancel" data-id="${docu.id}" data-action="delete">
            <i class="fas fa-trash"></i> Eliminar
          </button>
        </div>
      `;
      listaUsuarios.appendChild(userCard);
    });

    // Event listeners para todos los botones
    document.querySelectorAll('#lista-usuarios button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        const userId = e.target.dataset.id;
        
        if (!action || !userId) return;
        
        switch(action) {
          case 'approve':
          case 'reject':
            const nuevoEstado = e.target.dataset.estado === "true" ? false : true;
            await updateDoc(doc(db, "usuarios", userId), { aprobado: nuevoEstado });
            break;
            
          case 'delete':
            if (confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) {
              await deleteDoc(doc(db, "usuarios", userId));
              alert("Usuario eliminado correctamente");
            }
            break;
            
          case 'change-role':
            const rolActual = e.target.dataset.currentRole;
            const roles = ['Jugador', 'Admin', 'Moderador'];
            const rolIndex = roles.indexOf(rolActual);
            const nuevoRol = roles[(rolIndex + 1) % roles.length];
            
            await updateDoc(doc(db, "usuarios", userId), { rol: nuevoRol });
            alert(`Rol cambiado de ${rolActual} a ${nuevoRol}`);
            break;
            
          case 'save-level':
            const nivelInput = document.querySelector(`.nivel-input[data-id="${userId}"]`);
            const nuevoNivel = nivelInput.value.trim();
            const nivelRegex = /^[0-9]+(\.[0-9]+)?$/;
            if (!nivelRegex.test(nuevoNivel)) {
              alert("Formato de nivel inválido. Use el formato: número.número (ej: 1.5)");
              return;
            }
            await updateDoc(doc(db, "usuarios", userId), { nivel: nuevoNivel });
            e.target.classList.add('success');
            setTimeout(() => e.target.classList.remove('success'), 1200);
            break;
            
          case 'save-family-points':
            const familyInput = document.querySelector(`.family-points-input[data-id="${userId}"]`);
            const nuevosFamilyPoints = familyInput.value.trim();
            if (nuevosFamilyPoints === '' || isNaN(nuevosFamilyPoints)) {
              alert("Por favor, introduce un número válido para Family Points");
              return;
            }
            await updateDoc(doc(db, "usuarios", userId), { familyPoints: nuevosFamilyPoints });
            e.target.classList.add('success');
            setTimeout(() => e.target.classList.remove('success'), 1200);
            break;
            
          case 'save-ranking-points':
            const rankingInput = document.querySelector(`.puntos-ranking-input[data-id="${userId}"]`);
            const nuevosPuntosRanking = rankingInput.value.trim();
            if (nuevosPuntosRanking === '' || isNaN(nuevosPuntosRanking)) {
              alert("Por favor, introduce un número válido para Puntos Ranking");
              return;
            }
            await updateDoc(doc(db, "usuarios", userId), { puntosRanking: nuevosPuntosRanking });
            e.target.classList.add('success');
            setTimeout(() => e.target.classList.remove('success'), 1200);
            break;
            
          case 'save-all':
            // Guardar todos los cambios pendientes
            const nivelInputAll = document.querySelector(`.nivel-input[data-id="${userId}"]`);
            const familyInputAll = document.querySelector(`.family-points-input[data-id="${userId}"]`);
            const rankingInputAll = document.querySelector(`.puntos-ranking-input[data-id="${userId}"]`);
            
            const updates = {};
            
            // Validar y guardar nivel
            if (nivelInputAll.value.trim() !== '') {
              const nivelRegex = /^[0-9]+(\.[0-9]+)?$/;
              if (!nivelRegex.test(nivelInputAll.value.trim())) {
                alert("Formato de nivel inválido. Use el formato: número.número (ej: 1.5)");
                return;
              }
              updates.nivel = nivelInputAll.value.trim();
            }
            
            // Validar y guardar family points
            if (familyInputAll.value.trim() !== '') {
              if (isNaN(familyInputAll.value.trim())) {
                alert("Por favor, introduce un número válido para Family Points");
                return;
              }
              updates.familyPoints = familyInputAll.value.trim();
            }
            
            // Validar y guardar puntos ranking
            if (rankingInputAll.value.trim() !== '') {
              if (isNaN(rankingInputAll.value.trim())) {
                alert("Por favor, introduce un número válido para Puntos Ranking");
                return;
              }
              updates.puntosRanking = rankingInputAll.value.trim();
            }
            
            if (Object.keys(updates).length > 0) {
              await updateDoc(doc(db, "usuarios", userId), updates);
              e.target.classList.add('success');
              setTimeout(() => e.target.classList.remove('success'), 1200);
              alert("Cambios guardados correctamente");
            }
            break;
        }
      });
    });
  });
}

function escucharEquipos() {
  onSnapshot(collection(db, "equipos"), (snapshot) => {
    listaEquipos.innerHTML = "";

    snapshot.forEach(docu => {
      const equipo = docu.data();
      const li = document.createElement("li");
      
      li.innerHTML = `
        <div class="equipo-header">
          <div class="equipo-nombre">${equipo.nombre}</div>
          <div class="equipo-acciones">
            <button class="boton-accion" onclick="eliminarEquipo('${docu.id}')">
              <i class="fas fa-trash"></i> Eliminar
            </button>
          </div>
        </div>
        <div class="equipo-jugadores">
          <div class="jugador-badge">${usuariosMap[equipo.jugador1] || 'Jugador 1'}</div>
          <div class="jugador-badge">${usuariosMap[equipo.jugador2] || 'Jugador 2'}</div>
        </div>
      `;
      
      listaEquipos.appendChild(li);
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
  // Agrupar partidos por equipo local
  const equiposMap = {};
  for (const partido of partidos) {
    // Obtener nombre del equipo local
    let equipoLocalNombre = "";
    try {
      const localSnap = await getDoc(doc(db, "equipos", partido.equipoLocal));
      equipoLocalNombre = localSnap.exists() ? localSnap.data().nombre : "Equipo desconocido";
    } catch {
      equipoLocalNombre = "Equipo desconocido";
    }
    if (!equiposMap[equipoLocalNombre]) equiposMap[equipoLocalNombre] = [];
    equiposMap[equipoLocalNombre].push(partido);
  }
  // Ordenar los equipos alfabéticamente
  const equiposOrdenados = Object.keys(equiposMap).sort();
  equiposOrdenados.forEach(async nombreEquipo => {
    const details = document.createElement("details");
    details.className = "equipo-details";
    // Por defecto cerrados, puedes poner details.open = true para abrir todos
    const summary = document.createElement("summary");
    summary.className = "equipo-summary";
    summary.textContent = nombreEquipo;
    details.appendChild(summary);
    // Lista de partidos de este equipo
  const lista = document.createElement("div");
    lista.className = "equipo-partidos-lista";
    // Ordenar partidos por fecha descendente (opcional)
    const partidosEquipo = equiposMap[nombreEquipo];
    partidosEquipo.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
    for (const partido of partidosEquipo) {
      // Obtener nombres de local y visitante
    const [localSnap, visitanteSnap] = await Promise.all([
      getDoc(doc(db, "equipos", partido.equipoLocal)),
      getDoc(doc(db, "equipos", partido.equipoVisitante))
    ]);
      const local = localSnap.data() || { nombre: "Equipo local" };
      const visitante = visitanteSnap.data() || { nombre: "Equipo visitante" };
    const div = document.createElement("div");
    div.className = "admin-partido-card";
    div.dataset.partidoId = partido.id;
    div.dataset.jornadaId = partido.jornadaId;
    div.innerHTML = `
      <h3>${local.nombre} vs ${visitante.nombre}</h3>
      <div class="resultado-display">${formatearResultado(partido.resultado)}</div>
      <button class="editar-resultado">Editar Resultado</button>
        <button class="borrar-partido" style="margin-left:10px; color:#00C3FF;">Borrar Partido</button>
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
      lista.appendChild(div);
    }
    details.appendChild(lista);
    partidosJugadosDiv.appendChild(details);
  });
  // Delegación de eventos y edición igual que antes
  partidosJugadosDiv.addEventListener("click", async (e) => {
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
  partidosJugadosDiv.addEventListener("submit", async (ev) => {
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
      const partidoRef = doc(db, `calendario/${jornadaId}/partidos/${partidoId}`);
      const partidoSnap = await getDoc(partidoRef);
      if (!partidoSnap.exists()) {
        alert("Error: No se encontró el partido");
        return;
      }
      const partidoData = partidoSnap.data();
      const datosActualizados = {
        ...partidoData,
        resultado: nuevoResultado,
        fechaResultado: serverTimestamp()
      };
      await setDoc(partidoRef, datosActualizados, { merge: true });
      alert("Resultado actualizado correctamente");
      partidoDiv.querySelector(".resultado-display").textContent = formatearResultado(nuevoResultado);
      partidoDiv.querySelector(".resultado-display").style.display = "block";
      ev.target.style.display = "none";
      partidoDiv.querySelector(".editar-resultado").style.display = "inline-block";
    } catch (error) {
      console.error("Error al guardar el resultado:", error);
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
  if (!resultado) return '';
  const set1 = resultado.set1 || { puntos1: 0, puntos2: 0 };
  const set2 = resultado.set2 || { puntos1: 0, puntos2: 0 };
  const set3 = resultado.set3 || { puntos1: 0, puntos2: 0 };
  let sets = [
    `Set 1: ${set1.puntos1}-${set1.puntos2}`,
    `Set 2: ${set2.puntos1}-${set2.puntos2}`
  ];
  // Determinar si hay ganador tras dos sets
  let ganador2sets = false;
  if ((set1.puntos1 > set1.puntos2 && set2.puntos1 > set2.puntos2) ||
      (set1.puntos2 > set1.puntos1 && set2.puntos2 > set2.puntos1)) {
    ganador2sets = true;
  }
  // Solo mostrar el tercer set si no hay ganador tras dos sets y no es 0-0
  if (!ganador2sets && !(set3.puntos1 === 0 && set3.puntos2 === 0)) {
    sets.push(`Set 3: ${set3.puntos1}-${set3.puntos2}`);
  }
  return sets.join(' | ');
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

