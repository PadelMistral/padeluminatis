// perfil.js (corregido)
import { auth, db } from './firebase-config.js';
import {
  collection, getDocs, getDoc, doc, query, where, addDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

const estadisticasDiv = document.getElementById("estadisticas");
const listaPartidos = document.getElementById("lista-partidos");
const formCrearPartido = document.getElementById("crear-partido");
const selectRival = document.getElementById("select-rival");
const fechaInput = document.getElementById("fecha-partido");
const horaInput = document.getElementById("hora-partido");
const proximosPartidos = document.getElementById("proximos-partidos");

let equipoUsuario = null;
let usuarioId = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    usuarioId = user.uid;
    await obtenerEquipoUsuario();
    if (equipoUsuario) {
      await cargarEstadisticas();
      await cargarRivalesNoEnfrentados();
      escucharProximosPartidos();
    } else {
      estadisticasDiv.innerHTML = `<p>No formas parte de ningún equipo aún.</p>`;
    }
  } else {
    window.location.href = "index.html";
  }
});

async function obtenerEquipoUsuario() {
  const equiposSnap = await getDocs(collection(db, "equipos"));
  for (const docu of equiposSnap.docs) {
    const data = docu.data();
    if (data.jugadores.includes(usuarioId)) {
      equipoUsuario = { id: docu.id, nombre: data.nombre };
      break;
    }
  }
}

async function cargarEstadisticas() {
  let ganados = 0, perdidos = 0, jugados = 0;
  const detalles = [];

  const calendarioSnap = await getDocs(collection(db, "calendario"));
  for (const jornadaDoc of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    for (const partidoDoc of partidosSnap.docs) {
      const partido = partidoDoc.data();
      if (!partido.resultado) continue;

      const esLocal = partido.equipoLocal === equipoUsuario.id;
      const esVisitante = partido.equipoVisitante === equipoUsuario.id;
      if (!esLocal && !esVisitante) continue;

      jugados++;
      let setsMiEquipo = 0;
      let setsRival = 0;

      Object.values(partido.resultado).forEach(set => {
        const puntos1 = set.puntos1 || 0;
        const puntos2 = set.puntos2 || 0;
        if (esLocal) {
          if (puntos1 > puntos2) setsMiEquipo++; else if (puntos2 > puntos1) setsRival++;
        } else {
          if (puntos2 > puntos1) setsMiEquipo++; else if (puntos1 > puntos2) setsRival++;
        }
      });

      if (setsMiEquipo > setsRival) ganados++; else perdidos++;

      const rivalId = esLocal ? partido.equipoVisitante : partido.equipoLocal;
      const rivalData = await getDoc(doc(db, "equipos", rivalId));
      detalles.push(`vs ${rivalData.data().nombre} → ${setsMiEquipo}-${setsRival}`);
    }
  }

  estadisticasDiv.innerHTML = `
    <p><strong>Equipo:</strong> ${equipoUsuario.nombre}</p>
    <p>Partidos jugados: ${jugados}</p>
    <p>Ganados: ${ganados}</p>
    <p>Perdidos: ${perdidos}</p>
  `;

  listaPartidos.innerHTML = detalles.length
    ? detalles.map(p => `<li>${p}</li>`).join("")
    : "<li>No hay partidos registrados</li>";
}

async function cargarRivalesNoEnfrentados() {
  const equiposSnap = await getDocs(collection(db, "equipos"));
  const equiposMap = {};
  equiposSnap.forEach(doc => equiposMap[doc.id] = doc.data().nombre);

  const yaJugados = new Set();

  const calendarioSnap = await getDocs(collection(db, "calendario"));
  for (const jornada of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornada.id}/partidos`));
    for (const partidoDoc of partidosSnap.docs) {
      const p = partidoDoc.data();
      const local = p.equipoLocal;
      const visitante = p.equipoVisitante;
      if (local === equipoUsuario.id || visitante === equipoUsuario.id) {
        const rival = local === equipoUsuario.id ? visitante : local;
        yaJugados.add(rival);
      }
    }
  }

  selectRival.innerHTML = "";

  for (const [id, nombre] of Object.entries(equiposMap)) {
    if (id !== equipoUsuario.id && !yaJugados.has(id)) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = nombre;
      selectRival.appendChild(opt);
    }
  }

  if (selectRival.options.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Ya te has enfrentado a todos los equipos";
    selectRival.appendChild(opt);
    selectRival.disabled = true;
  }
}

formCrearPartido.addEventListener("submit", async (e) => {
  e.preventDefault();
  const rivalId = selectRival.value;
  const fecha = fechaInput.value;
  const hora = horaInput.value;

  if (!rivalId || !fecha || !hora) {
    alert("Completa todos los campos");
    return;
  }

  const fechaHora = new Date(`${fecha}T${hora}`);
  const jornadaRef = await addDoc(collection(db, "calendario"), {
    nombre: `Partido creado por ${equipoUsuario.nombre}`,
    fecha: new Date(),
    estado: "pendiente"
  });

  await addDoc(collection(db, `calendario/${jornadaRef.id}/partidos`), {
    equipoLocal: equipoUsuario.id,
    equipoVisitante: rivalId,
    resultado: null,
    fecha: fechaHora,
    estado: "pendiente"
  });

  alert("✅ Partido creado");
  formCrearPartido.reset();
  await cargarRivalesNoEnfrentados();
});

function escucharProximosPartidos() {
  onSnapshot(collection(db, "calendario"), async (snap) => {
    let html = "";

    for (const jornada of snap.docs) {
      const partidosSnap = await getDocs(collection(db, `calendario/${jornada.id}/partidos`));
      for (const partidoDoc of partidosSnap.docs) {
        const partido = partidoDoc.data();
        if (!partido.fecha || partido.resultado) continue;

        const idLocal = partido.equipoLocal;
        const idVisitante = partido.equipoVisitante;
        const esMiEquipo = [idLocal, idVisitante].includes(equipoUsuario.id);
        if (!esMiEquipo) continue;

        const rivalId = idLocal === equipoUsuario.id ? idVisitante : idLocal;

        try {
          const rivalDoc = await getDoc(doc(db, "equipos", rivalId));
          const rivalNombre = rivalDoc.exists() ? rivalDoc.data().nombre : "Equipo desconocido";
          const fecha = partido.fecha.toDate
            ? new Date(partido.fecha.toDate()).toLocaleString("es-ES")
            : new Date(partido.fecha).toLocaleString("es-ES");

          html += `<li>vs ${rivalNombre} → ${fecha}</li>`;
        } catch (error) {
          console.error("Error al obtener datos del rival:", error);
        }
      }
    }

    proximosPartidos.innerHTML = html || "<li>No hay partidos próximos</li>";
  });
}


window.addEventListener('DOMContentLoaded', () => {
  // Lista de selectores a animar en orden
  const elementosAAnimar = [
    document.getElementById('estadisticas'),
    document.getElementById('lista-partidos'),
    document.getElementById('crear-partido'),
    document.getElementById('proximos-partidos')
  ];

  elementosAAnimar.forEach((el, i) => {
    if (el) {
      el.classList.add('animate-fadeSlideUp', `animate-delay-${i + 1}`);
    }
  });
});
