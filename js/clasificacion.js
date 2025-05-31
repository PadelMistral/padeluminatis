import { db } from './firebase-config.js';
import { 
  collection, doc, getDocs, onSnapshot, 
  writeBatch, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

const tablaClasificacion = document.getElementById("tabla-clasificacion");

// 1. Obtener mapa de equipos con inicialización de campos (añadimos PG y PP)
async function obtenerEquiposMap() {
  const equiposSnap = await getDocs(collection(db, "equipos"));
  const map = {};
  equiposSnap.forEach(docu => {
    map[docu.id] = {
      id: docu.id,
      nombre: docu.data().nombre,
      puntos: 0,
      partidosJugados: 0,
      partidosGanados: 0,  // Nuevo campo
      partidosPerdidos: 0, // Nuevo campo
      setsGanados: 0,
      setsPerdidos: 0,
      juegosGanados: 0,
      juegosPerdidos: 0
    };
  });
  return map;
}

// 2. Calcular clasificación (añadimos conteo de PG y PP)
async function calcularClasificacion(equiposMap) {
  const calendarioSnap = await getDocs(collection(db, "calendario"));
  
  for (const jornadaDoc of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    
    for (const partidoDoc of partidosSnap.docs) {
      const partido = partidoDoc.data();
      if (!partido.resultado) continue;

      const local = equiposMap[partido.equipoLocal];
      const visitante = equiposMap[partido.equipoVisitante];

      if (!local || !visitante) {
        console.warn("Equipo local o visitante no encontrado", partido.equipoLocal, partido.equipoVisitante);
        continue;
      }

      // Incrementar partidos jugados
      local.partidosJugados++;
      visitante.partidosJugados++;

      let setsLocal = 0, setsVisitante = 0;
      let juegosLocal = 0, juegosVisitante = 0;

      Object.values(partido.resultado).forEach(set => {
        if (set.puntos1 > set.puntos2) setsLocal++;
        else if (set.puntos2 > set.puntos1) setsVisitante++;

        juegosLocal += set.puntos1 || 0;
        juegosVisitante += set.puntos2 || 0;
      });

      // Actualizar estadísticas
      local.setsGanados += setsLocal;
      local.setsPerdidos += setsVisitante;
      local.juegosGanados += juegosLocal;
      local.juegosPerdidos += juegosVisitante;

      visitante.setsGanados += setsVisitante;
      visitante.setsPerdidos += setsLocal;
      visitante.juegosGanados += juegosVisitante;
      visitante.juegosPerdidos += juegosLocal;

      // Asignar puntos y contar PG/PP
      if (setsLocal > setsVisitante) {
        local.puntos += 2;
        local.partidosGanados++;  // Local gana
        visitante.puntos += 1;
        visitante.partidosPerdidos++; // Visitante pierde
      } else if (setsVisitante > setsLocal) {
        visitante.puntos += 2;
        visitante.partidosGanados++;  // Visitante gana
        local.puntos += 1;
        local.partidosPerdidos++; // Local pierde
      } else {
        local.puntos += 1;
        visitante.puntos += 1;
        // En empate no se cuenta como ganado ni perdido
      }
    }
  }

  // Ordenar clasificación (mismo criterio)
  return Object.values(equiposMap).sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    const diffSetsA = a.setsGanados - a.setsPerdidos;
    const diffSetsB = b.setsGanados - b.setsPerdidos;
    if (diffSetsB !== diffSetsA) return diffSetsB - diffSetsA;
    const diffJuegosA = a.juegosGanados - a.juegosPerdidos;
    const diffJuegosB = b.juegosGanados - b.juegosPerdidos;
    return diffJuegosB - diffJuegosA;
  });
}

// 3. Guardar clasificación en Firestore (añadimos PG y PP)
async function guardarClasificacion(clasificacion) {
  const batch = writeBatch(db);
  const clasificacionRef = collection(db, "clasificacion");

  // Eliminar anteriores
  const snapshot = await getDocs(clasificacionRef);
  snapshot.forEach(doc => batch.delete(doc.ref));

  // Agregar nueva clasificación
  clasificacion.forEach((equipo, index) => {
    const docRef = doc(clasificacionRef, equipo.id);
    batch.set(docRef, {
      posicion: index + 1,
      nombre: equipo.nombre,
      partidosJugados: equipo.partidosJugados,
      partidosGanados: equipo.partidosGanados,  // Nuevo campo
      partidosPerdidos: equipo.partidosPerdidos, // Nuevo campo
      puntos: equipo.puntos,
      setsGanados: equipo.setsGanados,
      setsPerdidos: equipo.setsPerdidos,
      juegosGanados: equipo.juegosGanados,
      juegosPerdidos: equipo.juegosPerdidos,
      ultimaActualizacion: serverTimestamp()
    });
  });

  await batch.commit();
}

// 4. Mostrar la clasificación en la tabla HTML (versión modificada)
function mostrarClasificacion(clasificacion) {
  tablaClasificacion.innerHTML = `
    <thead>
      <tr>
        <th>Pos</th>
        <th>Equipo</th>
        <th>PJ</th>
        <th>PG / PP</th>
        <th>Dif.</th>
        <th style="text-align: center;">Puntos</th>
      </tr>
    </thead>
    <tbody>
      ${clasificacion.map((eq, index) => `
        <tr class="fila-equipo
          ${index < 3 ? 'top-4' : ''}
          ${index >= clasificacion.length - 2 ? 'descenso' : ''}">
          <td style="text-align: center;">${index + 1}</td>
          <td>${eq.nombre}</td>
          <td style="text-align: center;">${eq.partidosJugados}</td>
          <td style="text-align: center;">
            <span style="color: green; font-weight: bold;">${eq.partidosGanados}</span> / 
            <span style="color: red; font-weight: bold;">${eq.partidosPerdidos}</span>
          </td>
          <td style="${(eq.juegosGanados - eq.juegosPerdidos) >= 0 ? 'color: green;' : 'color: red;'} text-align: center;">
            ${eq.juegosGanados - eq.juegosPerdidos}
          </td>
          <td><span class="col-puntos">${eq.puntos}</span></td>
        </tr>
      `).join('')}
    </tbody>
  `;
}

// 5. Inicializar escuchas y lógica general
async function iniciar() {
  // Escuchar cambios en "calendario"
  onSnapshot(collection(db, "calendario"), async () => {
    const equiposMap = await obtenerEquiposMap();
    const clasificacion = await calcularClasificacion(equiposMap);
    await guardarClasificacion(clasificacion);
  });

  // Escuchar cambios en "clasificacion"
  onSnapshot(collection(db, "clasificacion"), (snapshot) => {
    const clasificacion = [];
    snapshot.forEach(doc => clasificacion.push({ ...doc.data(), id: doc.id }));
    mostrarClasificacion(clasificacion.sort((a, b) => a.posicion - b.posicion));
  });
}

iniciar();
