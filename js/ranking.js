// ranking.js
import { db, auth } from './firebase-config.js';
import { collection, getDocs, onSnapshot, query, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

let players = [];
let equipos = {};
let partidos = [];
let rankingProcesado = false;

// Niveles y puntos de inicio personalizados
const nivelesIniciales = {
    'Victor A3': 3.62,
    'Asen': 3.62,
    'Mario': 3.58,
    'Manu': 3.54,
    'Vissen': 3.50,
    'Pedro A6': 3.47,
    'Luis levas': 3.44, // actualizado
    'Rafa A6': 3.45,
    'Jaime P': 3.40,
    'Juanaan': 3.28, // actualizado
    'Chingo': 3.30, // actualizado
    'Huerta': 3.30,
    'Javi': 3.29,
    'Sergio MM': 3.25,
    'Andres': 3.38, // actualizado
    'Jorge': 3.18,
    'Néstor': 3.18,
    'Santi': 3.16,
    'Jose Manuel': 3.25, // actualizado
    'Paco': 3.15
};

// Puntos de inicio personalizados
const puntosInicioPersonalizados = {
    'Jose Manuel': 1000,
    'Andres': 1000,
    'Juanaan': 1125
};

// Al cargar usuarios, asigna nivel y puntos de inicio exactos
async function cargarUsuarios() {
    const usuariosSnap = await getDocs(collection(db, "usuarios"));
    players = usuariosSnap.docs.map(doc => {
        const data = doc.data();
        const nombre = data.nombreUsuario || data.displayName || data.nombre || 'Sin nombre';
        const nivel = nivelesIniciales[nombre] || parseFloat(data.nivel) || 3.15;
        // Si tiene puntos de inicio personalizados, usar ese valor, si no, usar fórmula estándar
        const puntos = puntosInicioPersonalizados[nombre] !== undefined ? puntosInicioPersonalizados[nombre] : 1000 + (nivel * 25);
        return {
            id: doc.id,
            name: nombre,
            nivel: nivel,
            progresoNivel: 0, // 0-100%
            puntos: puntos,
            puntosInicio: puntos, // Para referencia de subida/bajada de nivel
            partidos: 0,
            victorias: 0,
            setsWon: 0,
            setsLost: 0,
            dificultad: 0,
            desglose: [],
            historico: [] // [{nivel, puntos, progreso, tras cada partido}]
        };
    });
}

// 2. Cargar equipos
async function cargarEquipos() {
    const equiposSnap = await getDocs(collection(db, "equipos"));
    equipos = {};
    equiposSnap.docs.forEach(doc => {
        const data = doc.data();
        equipos[doc.id] = {
            id: doc.id,
            nombre: data.nombre || `Equipo ${doc.id}`,
            jugadores: data.jugadores || []
        };
    });
}

// 3. Cargar partidos
async function cargarPartidos() {
    let todos = [];
    // Liga (calendario)
    const calendarioSnap = await getDocs(collection(db, "calendario"));
    for (const jornadaDoc of calendarioSnap.docs) {
        const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
        partidosSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.resultado && data.resultado.set1) {
                todos.push({
                    ...data,
                    id: doc.id,
                    tipo: 'liga',
                    fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(),
                    equipoLocalId: data.equipoLocal,
                    equipoVisitanteId: data.equipoVisitante
                });
            }
        });
    }
    // Amistosos
    const amistososSnap = await getDocs(collection(db, "partidosAmistosos"));
    amistososSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.resultado && data.resultado.set1) {
            todos.push({
                ...data,
                id: doc.id,
                tipo: 'amistoso',
                fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(),
                jugadores: data.jugadores || []
            });
        }
    });
    // Retos
    const retosSnap = await getDocs(collection(db, "partidosReto"));
    retosSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.resultado && data.resultado.set1) {
            todos.push({
                ...data,
                id: doc.id,
                tipo: 'reto',
                fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(),
                jugadores: data.jugadores || []
            });
        }
    });
    // Ordenar por fecha
    partidos = todos.sort((a, b) => a.fecha - b.fecha);
}

// Utilidades para raquetas y colores
function getRaquetaClass(nivel, idx) {
    if (nivel >= 4.0) return 'raqueta-oro';
    if (nivel >= 3.5) return 'raqueta-plata';
    if (nivel >= 3.0) return 'raqueta-bronce';
    if (nivel >= 2.5) return 'raqueta-azul';
    if (idx === 0) return 'raqueta-oro';
    if (idx === 1) return 'raqueta-plata';
    if (idx === 2) return 'raqueta-bronce';
    return 'raqueta-gris';
}

function colorVictorias(p, pct) {
    if (pct >= 70) return 'color:#2ecc71;font-weight:bold;';
    if (pct >= 50) return 'color:#f1c40f;font-weight:bold;';
    return 'color:#e74c3c;font-weight:bold;';
}

// --- MODAL SIMPLE Y VISUAL ---
// Progreso de nivel por partido (más fácil al inicio, más difícil después)
function calcularProgresoNivel(player, cambioElo, rivalNivel, resultado) {
    // Base: más fácil al inicio
    let base = player.partidos < 10 ? 14 : player.partidos < 30 ? 9 : player.partidos < 60 ? 6 : 3;
    // Factor dificultad: ganar a iguales/superiores suma más
    let factor = 1;
    if (resultado === 1 && player.nivel < rivalNivel) factor = 1.5;
    if (resultado === 1 && player.nivel > rivalNivel) factor = 0.7;
    if (resultado === 0 && player.nivel > rivalNivel) factor = 1.3;
    if (resultado === 0 && player.nivel < rivalNivel) factor = 0.5;
    // El cambio de puntos también influye
    let extra = Math.abs(cambioElo) > 15 ? 1.2 : 1;
    let progreso = base * factor * extra;
    // Limitar
    progreso = Math.max(2, Math.min(22, progreso));
    return progreso;
}

// Modal con barra de progreso, histórico y botón + para desglose
function mostrarModalDesglose(player) {
    const modal = document.getElementById('playerModal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="background:linear-gradient(135deg,#232526,#414345);border-radius:18px;max-width:480px;width:95vw;box-shadow:0 8px 32px #000a;position:relative;display:flex;flex-direction:column;align-items:center;">
            <span class="close" id="closeModalBtn" style="cursor:pointer;font-size:2.2rem;line-height:1;position:absolute;right:18px;top:12px;z-index:10;">&times;</span>
            <div style="margin-top:28px;margin-bottom:10px;text-align:center;">
                <div style="font-size:1.25rem;font-weight:bold;color:#f1c40f;">${player.name}</div>
                <div style="font-size:1.05rem;color:#3498db;font-weight:bold;">Nivel ${player.nivel.toFixed(2)}</div>
                <div style="font-size:1.1rem;color:#2ecc71;font-weight:bold;">${player.puntos.toFixed(2)} pts</div>
                ${renderBarraProgreso(player)}
            </div>
            <div style="width:100%;max-height:60vh;overflow-y:auto;padding:0 10px 18px 10px;">
                ${player.historico.map((h,i)=>{
                    const puntos = parseFloat(h.cambio);
                    const color = puntos > 0 ? '#2ecc71' : '#e74c3c';
                    const icono = puntos > 0 ? '⬆️' : '⬇️';
                    return `<div style="background:rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px #0002;">
                        <div style="display:flex;flex-direction:column;gap:2px;">
                            <span style="font-size:1.05em;color:#f1c40f;font-weight:bold;">${h.fecha}</span>
                            <span style="font-size:0.98em;color:#fff;">Nivel: <b>${h.nivel.toFixed(2)}</b> | Pts: <b>${h.puntos.toFixed(2)}</b></span>
                        </div>
                        <div style="display:flex;flex-direction:column;align-items:end;">
                            <span style="font-size:1.2em;font-weight:bold;color:${color};">${icono} ${h.cambio}</span>
                            <button class='btn-desglose' data-idx='${i}' style='background:none;border:none;color:#3498db;font-size:1.1em;cursor:pointer;'>+</button>
                        </div>
                        <div class='desglose-factores' id='desglose-factores-${i}' style='display:none;margin-top:8px;background:rgba(52,152,219,0.07);padding:8px 12px;border-radius:8px;'>
                            ${h.desgloseHtml}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;
    setTimeout(()=>{
        Array.from(document.getElementsByClassName('btn-desglose')).forEach(btn => {
            btn.onclick = function() {
                const idx = this.getAttribute('data-idx');
                const desglose = document.getElementById('desglose-factores-' + idx);
                desglose.style.display = desglose.style.display === 'none' ? 'block' : 'none';
            };
        });
        document.getElementById('closeModalBtn').onclick = cerrarModal;
    },100);
}
window.addEventListener('click', function(event) {
    const modal = document.getElementById('playerModal');
    if (modal && event.target === modal) cerrarModal();
});
function cerrarModal() {
    const modal = document.getElementById('playerModal');
    if (modal) modal.style.display = 'none';
}

// 6. Inicialización y listeners
async function initRanking() {
    await cargarUsuarios();
    await cargarEquipos();
    await cargarPartidos();
    restaurarNivelesIniciales(); // Restaurar niveles antes de procesar el histórico
    await procesarPartidosHistorico();
    // Listener para nuevos partidos (en tiempo real)
    onSnapshot(collection(db, "partidosAmistosos"), () => recargarRanking());
    onSnapshot(collection(db, "partidosReto"), () => recargarRanking());
    onSnapshot(collection(db, "calendario"), () => recargarRanking());
}

async function recargarRanking() {
    await cargarUsuarios();
    await cargarEquipos();
    await cargarPartidos();
    await procesarPartidosHistorico();
}

// --- NUEVA FÓRMULA ELO PURA Y SIMPLE ---
function calcularCambioElo(player, team, rivalTeam, resultado, gano) {
    // Elo puro: cada usuario recibe un cambio diferente según su nivel y el de los rivales
    const avgEloPropio = (team[0].puntos + team[1].puntos) / 2;
    const avgEloRival = (rivalTeam[0].puntos + rivalTeam[1].puntos) / 2;
    const resultadoNum = gano ? 1 : 0;
    const expected = 1 / (1 + Math.pow(10, (avgEloRival - player.puntos) / 400));
    const K = 24; // Fijo para todos
    // Margen de sets y juegos
    const margenSets = Math.abs(resultado.setsLocal - resultado.setsVisitante);
    const margenJuegos = Math.abs(resultado.juegosLocal - resultado.juegosVisitante);
    // Ajuste por margen (pequeño)
    const ajusteMargen = (margenSets * 2) + (margenJuegos * 0.3);
    // Suma total
    let cambio = K * (resultadoNum - expected);
    cambio += gano ? ajusteMargen : -ajusteMargen;
    // Variabilidad decimal mínima para evitar empates exactos
    cambio += (Math.random() - 0.5) * 0.07;
    // Limitar
    cambio = Math.max(-40, Math.min(40, cambio));
    return {
        total: cambio,
        factores: {
            base: K * (resultadoNum - expected),
            margen: ajusteMargen
        }
    };
}

// Calcular sets ganados/perdidos por usuario en cada partido
function calcularSetsPorJugador(playerId, team, rivalTeam, resultado, esLocal) {
    // team: array de jugadores del equipo del jugador
    // rivalTeam: array de jugadores del equipo rival
    // resultado: {setsLocal, setsVisitante, juegosLocal, juegosVisitante}
    // esLocal: bool
    if (!resultado) return { setsGanados: 0, setsPerdidos: 0 };
    return {
        setsGanados: esLocal ? resultado.setsLocal : resultado.setsVisitante,
        setsPerdidos: esLocal ? resultado.setsVisitante : resultado.setsLocal
    };
}

// Procesar partidos y actualizar nivel/progreso
async function procesarPartidosHistorico() {
    players.forEach(p => {
        p.puntos = 1000 + (p.nivel * 25);
        p.partidos = 0;
        p.victorias = 0;
        p.setsWon = 0;
        p.setsLost = 0;
        p.dificultad = 0;
        p.desglose = [];
        p.historico = []; // Limpiar historico al inicio de cada partida
    });
    for (const partido of partidos) {
        let team1 = [], team2 = [];
        if (partido.tipo === 'liga') {
            const eq1 = equipos[partido.equipoLocalId];
            const eq2 = equipos[partido.equipoVisitanteId];
            if (!eq1 || !eq2) continue;
            team1 = eq1.jugadores.map(jid => players.find(p => p.id === jid)).filter(Boolean);
            team2 = eq2.jugadores.map(jid => players.find(p => p.id === jid)).filter(Boolean);
        } else {
            if (!partido.jugadores || partido.jugadores.length < 4) continue;
            team1 = partido.jugadores.slice(0,2).map(jid => players.find(p => p.id === jid)).filter(Boolean);
            team2 = partido.jugadores.slice(2,4).map(jid => players.find(p => p.id === jid)).filter(Boolean);
        }
        if (team1.length < 2 || team2.length < 2) continue;
        // Sets y juegos
        const r = partido.resultado;
        const setsLocal = (r.set1.puntos1 > r.set1.puntos2 ? 1 : 0) + (r.set2 && r.set2.puntos1 > r.set2.puntos2 ? 1 : 0) + (r.set3 && r.set3.puntos1 > r.set3.puntos2 ? 1 : 0);
        const setsVisitante = (r.set1.puntos2 > r.set1.puntos1 ? 1 : 0) + (r.set2 && r.set2.puntos2 > r.set2.puntos1 ? 1 : 0) + (r.set3 && r.set3.puntos2 > r.set3.puntos1 ? 1 : 0);
        const juegosLocal = (r.set1.puntos1 + (r.set2?.puntos1||0) + (r.set3?.puntos1||0));
        const juegosVisitante = (r.set1.puntos2 + (r.set2?.puntos2||0) + (r.set3?.puntos2||0));
        const ganador = setsLocal > setsVisitante ? 'local' : 'visitante';
        // Dificultad media
        const avgNivelRival = (team2[0].nivel + team2[1].nivel) / 2;
        const avgNivelComp = (team1[0].nivel + team1[1].nivel) / 2;
        const dificultad = Math.round((avgNivelRival + avgNivelComp) / 2 * 100);
        // Aplicar puntos y sets a cada jugador
        // --- DESGLOSE ROBUSTO Y COMPLETO ---
        team1.forEach(p => {
            p.partidos++;
            if (ganador === 'local') p.victorias++;
            const sets = calcularSetsPorJugador(p.id, team1, team2, {setsLocal, setsVisitante, juegosLocal, juegosVisitante}, true);
            p.setsWon += sets.setsGanados;
            p.setsLost += sets.setsPerdidos;
            p.dificultad += dificultad;
            // Calcular desglose completo
            const res = calcularCambioElo(p, team1, team2, {setsLocal, setsVisitante, juegosLocal, juegosVisitante}, ganador === 'local');
            p.puntos += res.total;
            ajustarNivelPorPuntos(p);
            const progreso = calcularProgresoNivel(p, res.total, avgNivelRival, ganador === 'local' ? 1 : 0);
            p.progresoNivel = progreso;
            p.historico.push({
                fecha: partido.fecha.toLocaleDateString(),
                nivel: p.nivel,
                puntos: p.puntos,
                progreso: p.progresoNivel,
                cambio: (res.total>0?'+':'')+res.total.toFixed(1),
                motivo: ganador === 'local' ? 'Victoria' : 'Derrota',
                factores: res.factores,
                esLocal: true,
                team: team1,
                rivalTeam: team2,
                equipoRival: partido.tipo==='liga'?equipos[partido.equipoVisitanteId]?.nombre:'',
                equipoPropio: partido.tipo==='liga'?equipos[partido.equipoLocalId]?.nombre:'',
                jugadoresRival: team2.map(j=>j.name),
                jugadoresPropio: team1.map(j=>j.name),
                resultado: {setsLocal, setsVisitante, juegosLocal, juegosVisitante},
                desgloseHtml: `
                    <div style="font-size:0.98em;color:#fff;">Nivel antes del partido: <b>${(p.nivel ?? '-').toFixed(2)}</b></div>
                    <div style="font-size:0.98em;color:#3498db;">${p.name}</div>
                    <div style="font-size:0.98em;color:#aaa;">vs <b>${team2.map(j=>j.name).join(' & ')}</b></div>
                    <div style="font-size:0.98em;color:#aaa;">Compañero: <b>${team1.map(j=>j.name).join(' & ')}</b></div>
                    <div style="font-size:0.98em;color:#f1c40f;">${ganador === 'local' ? 'Victoria' : 'Derrota'}</div>
                    <div style="font-size:0.98em;color:#2ecc71;">${(res.total>0?'+':'')+res.total.toFixed(1)} pts</div>
                    <div style="font-size:0.98em;color:#aaa;">${res.factores.base.toFixed(1)} (base) + ${res.factores.margen.toFixed(1)} (margen)</div>
                `
            });
        });
        // --- Repetir para team2 ---
        team2.forEach(p => {
            p.partidos++;
            if (ganador === 'visitante') p.victorias++;
            const sets = calcularSetsPorJugador(p.id, team2, team1, {setsLocal, setsVisitante, juegosLocal, juegosVisitante}, false);
            p.setsWon += sets.setsGanados;
            p.setsLost += sets.setsPerdidos;
            p.dificultad += dificultad;
            const res = calcularCambioElo(p, team2, team1, {setsLocal, setsVisitante, juegosLocal, juegosVisitante}, ganador === 'visitante');
            p.puntos += res.total;
            ajustarNivelPorPuntos(p);
            const progreso = calcularProgresoNivel(p, res.total, avgNivelRival, ganador === 'visitante' ? 1 : 0);
            p.progresoNivel = progreso;
            p.historico.push({
                fecha: partido.fecha.toLocaleDateString(),
                nivel: p.nivel,
                puntos: p.puntos,
                progreso: p.progresoNivel,
                cambio: (res.total>0?'+':'')+res.total.toFixed(1),
                motivo: ganador === 'visitante' ? 'Victoria' : 'Derrota',
                factores: res.factores,
                esLocal: false,
                team: team2,
                rivalTeam: team1,
                equipoRival: partido.tipo==='liga'?equipos[partido.equipoLocalId]?.nombre:'',
                equipoPropio: partido.tipo==='liga'?equipos[partido.equipoVisitanteId]?.nombre:'',
                jugadoresRival: team1.map(j=>j.name),
                jugadoresPropio: team2.map(j=>j.name),
                resultado: {setsLocal, setsVisitante, juegosLocal, juegosVisitante},
                desgloseHtml: `
                    <div style="font-size:0.98em;color:#fff;">Nivel antes del partido: <b>${(p.nivel ?? '-').toFixed(2)}</b></div>
                    <div style="font-size:0.98em;color:#3498db;">${p.name}</div>
                    <div style="font-size:0.98em;color:#aaa;">vs <b>${team1.map(j=>j.name).join(' & ')}</b></div>
                    <div style="font-size:0.98em;color:#aaa;">Compañero: <b>${team2.map(j=>j.name).join(' & ')}</b></div>
                    <div style="font-size:0.98em;color:#f1c40f;">${ganador === 'visitante' ? 'Victoria' : 'Derrota'}</div>
                    <div style="font-size:0.98em;color:#2ecc71;">${(res.total>0?'+':'')+res.total.toFixed(1)} pts</div>
                    <div style="font-size:0.98em;color:#aaa;">${res.factores.base.toFixed(1)} (base) + ${res.factores.margen.toFixed(1)} (margen)</div>
                `
            });
        });
    }
    guardarProgresoUsuariosSession();
    rankingProcesado = true;
    renderRanking();
}

// Renderizar ranking visual (estilo compacto y atractivo)
function renderRanking() {
    const tbody = document.getElementById('rankingBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const ordenados = [...players].sort((a,b) => b.puntos - a.puntos);
    ordenados.forEach((p, idx) => {
        const winPct = p.partidos > 0 ? Math.round((p.victorias/p.partidos)*100) : 0;
        const avgSets = p.partidos > 0 ? `${p.setsWon}-${p.setsLost}` : '-';
        const avgDificultad = p.partidos > 0 ? Math.round(p.dificultad/p.partidos) : '-';
        const raquetaClass = getRaquetaClass(p.nivel, idx);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold; color: #f1c40f;">${idx+1}</td>
            <td><span class="raqueta-indicator ${raquetaClass}">🎾</span> <span style='font-weight:600;'>${p.name}</span></td>
            <td>${p.nivel}</td>
            <td style="text-align:center;">${p.partidos}</td>
            <td style="text-align:center;${colorVictorias(p,winPct)}">${p.victorias} <span style='font-size:0.8em;opacity:0.7;'>(${winPct}%)</span></td>
            <td style="text-align:center;">${avgSets}</td>
            <td style="text-align:center;">${avgDificultad}</td>
            <td class="puntos-elo" style="color: #f1c40f; font-weight: bold;">${p.puntos.toFixed(1)}</td>
        `;
        tr.onclick = () => mostrarModalDesglose(p);
        tbody.appendChild(tr);
    });
}

// Barra de progreso visual en el modal
function renderBarraProgreso(player) {
    let color = '#aaa';
    if (player.progresoNivel > 80) color = '#2ecc71';
    else if (player.progresoNivel < 20) color = '#e74c3c';
    return `<div style='width:100%;background:#222;border-radius:8px;height:18px;margin:8px 0;overflow:hidden;'><div style='width:${player.progresoNivel}%;background:${color};height:100%;transition:width 0.5s;'></div></div><div style='text-align:center;font-size:0.98em;color:${color};font-weight:bold;'>${player.progresoNivel.toFixed(1)}%</div>`;
}

// --- NIVELES PROPUESTOS SEGÚN CLASIFICACIÓN OBJETIVO ---
const nivelesPropuestos = {
    'Victor A3': 3.75,
    'Mario': 3.72,
    'Assen': 3.69,
    'Pedro A6': 3.66,
    'Rafa A6': 3.63,
    'Manu': 3.60,
    'Jaime P': 3.57,
    'Vissen': 3.54,
    'Luis levas': 3.51,
    'Chingo': 3.48,
    'Huerta': 3.45,
    'Javi': 3.42,
    'Juanaan': 3.39,
    'Sergio': 3.36,
    'Andres': 3.33,
    'Jorge': 3.30,
    'Néstor': 3.27,
    'Jose Manuel': 3.24,
    'Sani': 3.21,
    'Paco': 3.18
};

// --- ACTUALIZAR NIVELES EN FIREBASE ---
async function actualizarNivelesUsuarios() {
    for (const player of players) {
        const nivelNuevo = nivelesPropuestos[player.name] || player.nivel;
        if (nivelNuevo !== player.nivel) {
            try {
                const userRef = doc(db, "usuarios", player.id);
                await updateDoc(userRef, { nivel: nivelNuevo });
                player.nivel = nivelNuevo;
                console.log(`Nivel actualizado para ${player.name}: ${nivelNuevo}`);
            } catch (e) {
                console.error(`Error actualizando nivel de ${player.name}:`, e);
            }
        }
    }
}
// Llama a esta función una vez tras cargar usuarios para ajustar los niveles
// await actualizarNivelesUsuarios();

// --- AJUSTE AUTOMÁTICO DE NIVEL CADA X PUNTOS ---
const DIF_PUNTOS_NIVEL = 60; // Subida/bajada cada 60 puntosRanking
function ajustarNivelPorPuntos(player) {
    // Comprobar diferencia respecto a puntos de inicio
    const diff = player.puntos - player.puntosInicio;
    if (diff >= DIF_PUNTOS_NIVEL) {
        player.nivel = +(player.nivel + 0.01).toFixed(2);
        player.puntosInicio = player.puntos; // Reiniciar referencia
    } else if (diff <= -DIF_PUNTOS_NIVEL) {
        player.nivel = +(player.nivel - 0.01).toFixed(2);
        player.puntosInicio = player.puntos; // Reiniciar referencia
    }
}
// Llama a ajustarNivelPorPuntos(player) tras cada partido

// --- FACTORES EXTRA EN EL DESGLOSE DE PUNTOS ---
function calcularDesglosePuntos({player, rival1, rival2, companero, margenSets, dificultad, puntosRival1, puntosRival2, nivelRival1, nivelRival2, nivelCompanero, bonusRacha}) {
    // Ejemplo de desglose variado
    const factores = {
        base: calcularEloBase(player.puntos, (puntosRival1 + puntosRival2) / 2),
        margen: margenSets * 2, // 2 puntos por set de diferencia
        dificultad: dificultad, // %
        puntosRival1: (puntosRival1 - player.puntos) * 0.05, // 5% de la diferencia
        puntosRival2: (puntosRival2 - player.puntos) * 0.05,
        nivelRival1: (nivelRival1 - player.nivel) * 2, // 2 puntos por cada 0.1 de diferencia
        nivelRival2: (nivelRival2 - player.nivel) * 2,
        nivelCompanero: (nivelCompanero - player.nivel) * 1.5,
        bonusRacha: bonusRacha || 0
    };
    // Suma total
    const total = Object.values(factores).reduce((a, b) => a + b, 0);
    return { factores, total };
}

window.addEventListener('DOMContentLoaded', initRanking); 

// Guardar progreso y puntos en usuario-session.js
function guardarProgresoUsuariosSession() {
    if (typeof window !== 'undefined') {
        window._usuariosProgreso = players.map(p => ({
            id: p.id,
            name: p.name,
            nivel: p.nivel,
            progresoNivel: p.progresoNivel,
            puntos: p.puntos,
            historico: p.historico
        }));
    }
} 

// Función para restaurar los niveles iniciales a todos los usuarios antes de procesar el histórico
function restaurarNivelesIniciales() {
    players.forEach(p => {
        const nivelOriginal = nivelesIniciales[p.name];
        if (nivelOriginal) {
            p.nivel = nivelOriginal;
        }
    });
} 