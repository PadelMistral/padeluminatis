// ./js/calendario.js
import { auth, db } from './firebase-config.js';
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  getDocs,
  Timestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

const listaJornadas = document.getElementById("lista-jornadas");
let usuarioActual = null;

function cargarCalendario() {
  onSnapshot(collection(db, "calendario"), async (snapshot) => {
    listaJornadas.innerHTML = "";

    const jugados = [];
    const pendientes = [];

for (const jornadaDoc of snapshot.docs) {
  const jornadaData = jornadaDoc.data();
  const partidosRef = collection(db, `calendario/${jornadaDoc.id}/partidos`);
  const partidosSnap = await getDocs(partidosRef);

  if (partidosSnap.empty) {
    await deleteDoc(doc(db, "calendario", jornadaDoc.id));
    continue;
  }

  for (const partidoDoc of partidosSnap.docs) {
    const partido = partidoDoc.data();
    const fecha = partido.fecha?.toDate?.();

    const [equipoLocalSnap, equipoVisitanteSnap] = await Promise.all([
      getDoc(doc(db, "equipos", partido.equipoLocal)),
      getDoc(doc(db, "equipos", partido.equipoVisitante))
    ]);

    const partidoData = {
      id: partidoDoc.id,
      jornadaId: jornadaDoc.id,
      ...partido,
      fecha,
      equipoLocal: { ...equipoLocalSnap.data(), id: equipoLocalSnap.id },
      equipoVisitante: { ...equipoVisitanteSnap.data(), id: equipoVisitanteSnap.id }
    };

    if (partido.resultado) {
      jugados.push(partidoData);
    } else {
      pendientes.push(partidoData);
    }
  }
}


    pendientes.sort((a, b) => a.fecha - b.fecha);
    jugados.sort((a, b) => b.fecha - a.fecha);

    renderPartidos("Próximos Partidos", pendientes, false);
    if (jugados.length > 0) renderPartidos("Partidos Jugados", jugados, true);
  });
}

function renderPartidos(titulo, lista, esJugado) {
  const contenedor = document.createElement(esJugado ? "details" : "div");
  contenedor.className = "jornada-card";
  if (esJugado) contenedor.innerHTML = `<summary>${titulo}</summary>`;
  else contenedor.innerHTML = `<h2 class="jornada-titulo">${titulo}</h2>`;

  const grid = document.createElement("div");
  grid.className = "partidos-container";

  lista.forEach(async partido => {
    const card = await crearElementoPartido(partido, partido.jornadaId);
    grid.appendChild(card);
  });

  contenedor.appendChild(grid);
  listaJornadas.appendChild(contenedor);
}

async function crearElementoPartido(partido, jornadaId) {
  const divPartido = document.createElement("div");
  divPartido.className = "partido-card";

  try {
    const puedeEditar = usuarioActual && (
      usuarioActual.rol === "Admin" ||
      partido.equipoLocal.jugadores.includes(usuarioActual.uid) ||
      partido.equipoVisitante.jugadores.includes(usuarioActual.uid)
    );
    const tieneResultado = !!partido.resultado;

    const fechaStr = partido.fecha?.toLocaleString("es-ES", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    }) || "Sin fecha";

    const resultadoHTML = tieneResultado ? `
      <div class="resultado-final">
        ${formatearResultado(partido.resultado)}
      </div>` : "";

    const botonEditarHTML = !tieneResultado && puedeEditar ? `
      <button class="btn-mostrar-editor">Registrar Resultado</button>` : "";

    divPartido.innerHTML = `
      <div class="encabezado-partido">
        <h3>${partido.equipoLocal.nombre} <span class="vs">VS</span> ${partido.equipoVisitante.nombre}</h3>
        <span class="fecha-partido">${fechaStr}</span>
        ${botonEditarHTML}
      </div>

      <div class="editor-partido" style="display: none;">
        <div class="fecha-container">
          <label>Fecha:
            <input type="date" class="input-fecha"
              value="${partido.fecha?.toISOString().split('T')[0] || ''}">
          </label>
        </div>
        ${generarSetsHTML(partido, puedeEditar)}
        <button class="btn-guardar"
                data-jornada="${jornadaId}"
                data-partido="${partido.id}">
          Guardar Cambios
        </button>
      </div>

      ${resultadoHTML}
    `;

    if (!tieneResultado && puedeEditar) {
      divPartido.querySelector(".btn-mostrar-editor").addEventListener("click", (e) => {
        e.target.style.display = "none";
        divPartido.querySelector(".editor-partido").style.display = "block";
      });
    }

    if (puedeEditar && !tieneResultado) {
      divPartido.querySelector(".btn-guardar").addEventListener("click", async () => {
        const datos = obtenerDatosFormulario(divPartido);
        await guardarCambios(jornadaId, partido.id, datos);
      });
    }

  } catch (err) {
    console.error("Error mostrando partido:", err);
    divPartido.innerHTML = `<p>Error al cargar el partido</p>`;
  }

  return divPartido;
}

function generarSetsHTML(partido, editable) {
  const resultado = partido.resultado || {};
  return Array.from({ length: 3 }, (_, i) => {
    const setNum = i + 1;
    const set = resultado[`set${setNum}`] || { puntos1: "", puntos2: "" };
    return `
      <div class="set">
        <span class="set-numero">Set ${setNum}</span>
        <input type="number" class="input-set" ${!editable ? 'disabled' : ''}
               value="${set.puntos1}" min="0" placeholder="0">
        <span class="separador">-</span>
        <input type="number" class="input-set" ${!editable ? 'disabled' : ''}
               value="${set.puntos2}" min="0" placeholder="0">
      </div>`;
  }).join("");
}

function formatearResultado(resultado) {
  const sets = Object.values(resultado || {});
  const marcador = sets.reduce((acc, set) => {
    acc.local += set.puntos1;
    acc.visitante += set.puntos2;
    return acc;
  }, { local: 0, visitante: 0 });

  return `
    <div class="marcador-final">${marcador.local} - ${marcador.visitante}</div>
    <div class="sets-detalle">
      ${sets.map((s, i) => `Set ${i + 1}: ${s.puntos1}-${s.puntos2}`).join(" | ")}
    </div>`;
}

function obtenerDatosFormulario(divPartido) {
  const inputs = divPartido.querySelectorAll("input");
  return {
    fecha: Timestamp.fromDate(new Date(inputs[0].value)),
    resultado: {
      set1: { puntos1: Number(inputs[1].value), puntos2: Number(inputs[2].value) },
      set2: { puntos1: Number(inputs[3].value), puntos2: Number(inputs[4].value) },
      set3: { puntos1: Number(inputs[5].value), puntos2: Number(inputs[6].value) }
    }
  };
}

async function guardarCambios(jornadaId, partidoId, datos) {
  try {
    await updateDoc(doc(db, `calendario/${jornadaId}/partidos/${partidoId}`), datos);

    const partidoSnap = await getDoc(doc(db, `calendario/${jornadaId}/partidos/${partidoId}`));
    const partido = partidoSnap.data();

    const sets = Object.values(partido.resultado);
    let setsGanadosLocal = 0, setsGanadosVisitante = 0;
    let puntosLocal = 0, puntosVisitante = 0;

    sets.forEach(set => {
      if (set.puntos1 > set.puntos2) setsGanadosLocal++;
      else if (set.puntos2 > set.puntos1) setsGanadosVisitante++;
      puntosLocal += set.puntos1;
      puntosVisitante += set.puntos2;
    });

    const partidosGanadosLocal = setsGanadosLocal > setsGanadosVisitante ? 1 : 0;
    const partidosGanadosVisitante = setsGanadosVisitante > setsGanadosLocal ? 1 : 0;

    const clasificacionLocalRef = doc(db, "clasificacion", partido.equipoLocal);
    const clasificacionVisitanteRef = doc(db, "clasificacion", partido.equipoVisitante);

    const [localSnap, visitanteSnap] = await Promise.all([
      getDoc(clasificacionLocalRef),
      getDoc(clasificacionVisitanteRef)
    ]);

    const localData = localSnap.exists() ? localSnap.data() : {};
    const visitanteData = visitanteSnap.exists() ? visitanteSnap.data() : {};

    const sumar = (a, b) => (a || 0) + b;

    await updateDoc(clasificacionLocalRef, {
      setsGanados: sumar(localData.setsGanados, setsGanadosLocal),
      setsPerdidos: sumar(localData.setsPerdidos, setsGanadosVisitante),
      partidosGanados: sumar(localData.partidosGanados, partidosGanadosLocal),
      partidosPerdidos: sumar(localData.partidosPerdidos, partidosGanadosVisitante),
      puntosFavor: sumar(localData.puntosFavor, puntosLocal),
      puntosContra: sumar(localData.puntosContra, puntosVisitante),
      diferenciaPuntos: sumar(localData.diferenciaPuntos, puntosLocal - puntosVisitante)
    });

    await updateDoc(clasificacionVisitanteRef, {
      setsGanados: sumar(visitanteData.setsGanados, setsGanadosVisitante),
      setsPerdidos: sumar(visitanteData.setsPerdidos, setsGanadosLocal),
      partidosGanados: sumar(visitanteData.partidosGanados, partidosGanadosVisitante),
      partidosPerdidos: sumar(visitanteData.partidosPerdidos, partidosGanadosLocal),
      puntosFavor: sumar(visitanteData.puntosFavor, puntosVisitante),
      puntosContra: sumar(visitanteData.puntosContra, puntosLocal),
      diferenciaPuntos: sumar(visitanteData.diferenciaPuntos, puntosVisitante - puntosLocal)
    });

    alert("✅ Resultados y clasificación actualizados");
  } catch (err) {
    console.error("❌ Error guardando cambios:", err);
    alert("Error al guardar: " + err.message);
  }
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (user) {
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (!userDoc.exists()) throw new Error("Usuario no registrado");

      usuarioActual = {
        ...user,
        rol: userDoc.data().rol || 'usuario'
      };

      cargarCalendario();
    } else {
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error("Error de autenticación:", error);
    auth.signOut();
    window.location.href = "index.html";
  }
});
