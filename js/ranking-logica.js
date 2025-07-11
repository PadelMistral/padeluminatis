// ranking-logica.js
import { db } from '../firebase-config.js';
import {
  collection, getDocs, updateDoc, doc
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';

async function calcularPuntos({ setsGanados, setsPerdidos }, puntosEquipo, puntosRival, tipo) {
  const base = 30;
  const diferencia = puntosRival - puntosEquipo;
  const factorDificultad = diferencia > 0 ? 1 + (diferencia / 1000) : 1 - (Math.abs(diferencia) / 1500);
  const margen = Math.abs(setsGanados - setsPerdidos);
  const factorMargen = margen >= 2 ? 1.2 : margen === 1 ? 1.0 : 0.8;
  const factorTipo = tipo === 'amistoso' ? 0.8 : tipo === 'reto' ? 1.2 : tipo === 'evento' ? 1.5 : 1;
  return Math.round(base * factorDificultad * factorMargen * factorTipo);
}

async function actualizarRanking() {
  const usuariosSnap = await getDocs(collection(db, 'usuarios'));
  const usuarios = {};
  usuariosSnap.forEach(doc => {
    usuarios[doc.id] = {
      id: doc.id,
      nombre: doc.data().nombreUsuario || doc.data().email,
      puntos: 500,
      victorias: 0,
      partidos: 0
    };
  });

  const equiposSnap = await getDocs(collection(db, 'equipos'));
  const equipos = {};
  equiposSnap.forEach(doc => {
    equipos[doc.id] = doc.data().jugadores;
  });

  const calendarioSnap = await getDocs(collection(db, 'calendario'));
  for (const jornadaDoc of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    for (const partidoDoc of partidosSnap.docs) {
      const partido = partidoDoc.data();
      if (!partido.resultado) continue;

      const equipo1 = partido.equipoLocal;
      const equipo2 = partido.equipoVisitante;
      const jugadores1 = equipos[equipo1] || [];
      const jugadores2 = equipos[equipo2] || [];

      let sets1 = 0, sets2 = 0;
      Object.values(partido.resultado).forEach(set => {
        if ((set.puntos1 || 0) > (set.puntos2 || 0)) sets1++;
        else if ((set.puntos2 || 0) > (set.puntos1 || 0)) sets2++;
      });

      const ganadores = sets1 > sets2 ? jugadores1 : jugadores2;
      const perdedores = sets1 > sets2 ? jugadores2 : jugadores1;
      const tipo = partido.tipo || 'liga';

      for (const jugador of [...ganadores, ...perdedores]) {
        usuarios[jugador].partidos++;
      }
      for (const jugador of ganadores) usuarios[jugador].victorias++;

      for (const jugador of ganadores) {
        const puntosRival = perdedores.map(j => usuarios[j].puntos).reduce((a,b)=>a+b,0)/perdedores.length;
        const puntosGanador = usuarios[jugador].puntos;
        const puntosSumar = await calcularPuntos({ setsGanados: Math.max(sets1, sets2), setsPerdidos: Math.min(sets1, sets2) }, puntosGanador, puntosRival, tipo);
        usuarios[jugador].puntos += puntosSumar;
      }

      for (const jugador of perdedores) {
        const puntosRival = ganadores.map(j => usuarios[j].puntos).reduce((a,b)=>a+b,0)/ganadores.length;
        const puntosPerdedor = usuarios[jugador].puntos;
        const puntosRestar = await calcularPuntos({ setsGanados: Math.min(sets1, sets2), setsPerdidos: Math.max(sets1, sets2) }, puntosPerdedor, puntosRival, tipo);
        usuarios[jugador].puntos -= Math.round(puntosRestar * 0.5);
      }
    }
  }

  for (const id in usuarios) {
    await updateDoc(doc(db, 'usuarios', id), {
      puntosRanking: Math.max(0, Math.round(usuarios[id].puntos)),
      partidosJugados: usuarios[id].partidos,
      victorias: usuarios[id].victorias
    });
  }
}

actualizarRanking();
