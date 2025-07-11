import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import SistemaPuntuacionAvanzado from './sistema-puntuacion.js';

let players = [];
let partidos = [];
let equipos = {};

// Inicialización de Firebase sin autenticación anónima
async function inicializarFirebase() {
    try {
        console.log('✅ Firebase inicializado sin autenticación anónima');
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
    }
}

async function cargarUsuarios() {
    try {
        const usuariosSnap = await getDocs(collection(db, "usuarios"));
        players = usuariosSnap.docs.map((doc) => {
            const data = doc.data();
            const nivel = parseFloat(data.nivel) || 2.0;
            // Nueva fórmula de puntosRanking inicial
            const puntosRanking = 500 + (nivel * 10 * 2);
            return {
                id: doc.id,
                name: data.nombreUsuario || data.displayName || 'Sin nombre',
                nivel: nivel,
                puntosRanking: puntosRanking,
                puntosNivel: 300,
                progresoNivel: 50,
                matches: 0,
                wins: 0,
                setsWon: 0,
                setsLost: 0,
                history: []
            };
        });
        console.log(`✅ Cargados ${players.length} usuarios`);
    } catch (error) {
        console.error('❌ Error al cargar usuarios:', error);
        if (error.code === 'permission-denied') {
            mostrarErrorAutenticacion();
        }
        // Usar datos de ejemplo si no se pueden cargar
        players = generarDatosEjemplo();
    }
}

async function cargarEquipos() {
    try {
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
        console.log(`✅ Cargados ${Object.keys(equipos).length} equipos`);
    } catch (error) {
        console.error('❌ Error al cargar equipos:', error);
        equipos = {};
    }
}

async function cargarPartidos() {
    try {
        let partidosArr = [];
        // Liga
        const calendarioSnap = await getDocs(collection(db, "calendario"));
        for (const jornadaDoc of calendarioSnap.docs) {
            const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
            for (const partidoDoc of partidosSnap.docs) {
                const partido = partidoDoc.data();
                if (partido.resultado && partido.resultado.set1) {
                    partidosArr.push({
                        ...partido,
                        id: partidoDoc.id,
                        tipo: 'liga',
                        fecha: partido.fecha?.toDate() || new Date(),
                        equipoLocalId: partido.equipoLocal,
                        equipoVisitanteId: partido.equipoVisitante
                    });
                }
            }
        }
        // Amistosos
        const amistososSnap = await getDocs(collection(db, "partidosAmistosos"));
        amistososSnap.docs.forEach(doc => {
            const partido = doc.data();
            if (partido.resultado && partido.resultado.set1) {
                partidosArr.push({
                    ...partido,
                    id: doc.id,
                    tipo: 'amistoso',
                    fecha: partido.fecha?.toDate() || new Date(),
                    jugadores: partido.jugadores || []
                });
            }
        });
        // Retos
        const retosSnap = await getDocs(collection(db, "partidosReto"));
        retosSnap.docs.forEach(doc => {
            const partido = doc.data();
            if (partido.resultado && partido.resultado.set1) {
                partidosArr.push({
                    ...partido,
                    id: doc.id,
                    tipo: 'reto',
                    fecha: partido.fecha?.toDate() || new Date(),
                    jugadores: partido.jugadores || []
                });
            }
        });
        // Ordenar por fecha
        partidos = partidosArr.sort((a, b) => a.fecha - b.fecha);
        console.log(`✅ Cargados ${partidos.length} partidos`);
    } catch (error) {
        console.error('❌ Error al cargar partidos:', error);
        partidos = [];
    }
}

function obtenerJugadoresEquipo(equipoId) {
    const equipo = equipos[equipoId];
    if (!equipo || !equipo.jugadores) return [];
    return equipo.jugadores.map(jugadorId => {
        return players.find(j => j.id === jugadorId) || { id: jugadorId, name: 'Desconocido', nivel: 2.0, puntosRanking: 800, puntosNivel: 300, matches: 0, wins: 0, setsWon: 0, setsLost: 0, history: [] };
    });
}

// Instancia global del sistema de puntuación avanzado
const sistemaPuntuacion = new SistemaPuntuacionAvanzado();

// Variables globales para el modal
let currentPlayer = null;
let currentMatchIndex = 0;

// Mostrar historial de partidos al hacer clic en una fila
function mostrarHistorialJugador(player) {
    currentPlayer = player;
    currentMatchIndex = 0;
    
    // Mostrar el modal existente en el HTML
    const modal = document.getElementById('playerModal');
    modal.style.display = 'block';
    
    // Actualizar información del jugador
    document.getElementById('modalPlayerName').textContent = player.name;
    document.getElementById('modalPlayerLevel').textContent = `Nivel ${player.nivel.toFixed(2)}`;
    document.getElementById('modalPlayerPoints').textContent = `${player.puntosRanking.toFixed(0)} pts`;
    
    // Mostrar primer partido si existe historial
    if (player.history.length > 0) {
        mostrarPartidoDetalle(0);
    } else {
        document.getElementById('matchDetails').innerHTML = '<p style="text-align: center; color: #bdc3c7;">No hay historial de partidos disponible.</p>';
        document.getElementById('matchFactors').innerHTML = '';
        document.getElementById('matchCounter').textContent = 'Sin partidos';
        document.getElementById('prevMatch').disabled = true;
        document.getElementById('nextMatch').disabled = true;
    }
}

// Función para mostrar detalles de un partido específico
function mostrarPartidoDetalle(index) {
    if (!currentPlayer || !currentPlayer.history || currentPlayer.history.length === 0) return;
    
    const partido = currentPlayer.history[index];
    currentMatchIndex = index;
    
    // Actualizar contador
    document.getElementById('matchCounter').textContent = `Partido ${index + 1} de ${currentPlayer.history.length}`;
    
    // Habilitar/deshabilitar botones de navegación
    document.getElementById('prevMatch').disabled = index === 0;
    document.getElementById('nextMatch').disabled = index === currentPlayer.history.length - 1;
    
    // Calcular cambios
    const cambioRanking = partido.puntosRankingDespues - partido.puntosRankingAntes;
    const cambioNivel = partido.puntosNivelDespues - partido.puntosNivelAntes;
    const cambioNivelAbsoluto = Math.abs(cambioNivel);
    
    // Determinar si subió o bajó de nivel
    let nivelChange = '';
    if (partido.puntosNivelDespues >= 350) {
        nivelChange = '🔼 Subió de nivel';
    } else if (partido.puntosNivelDespues < 250) {
        nivelChange = '🔽 Bajó de nivel';
    } else {
        nivelChange = '➡️ Sin cambio de nivel';
    }
    
    // Mostrar detalles del partido
    document.getElementById('matchDetails').innerHTML = `
        <div class="match-info">
            <div class="match-stat">
                <span class="stat-label">Fecha</span>
                <span class="stat-value">${partido.fecha ? new Date(partido.fecha).toLocaleDateString('es-ES') : 'Sin fecha'}</span>
            </div>
            <div class="match-stat">
                <span class="stat-label">Resultado</span>
                <span class="stat-value ${partido.resultado === 'victoria' ? 'positive' : 'negative'}">
                    ${partido.resultado === 'victoria' ? '🏆 Victoria' : '❌ Derrota'}
                </span>
            </div>
            <div class="match-stat">
                <span class="stat-label">Compañero</span>
                <span class="stat-value">${partido.companero}</span>
            </div>
            <div class="match-stat">
                <span class="stat-label">Rivales</span>
                <span class="stat-value">${partido.rival.join(' & ')}</span>
            </div>
            <div class="match-stat">
                <span class="stat-label">Cambio Ranking</span>
                <span class="stat-value ${cambioRanking >= 0 ? 'positive' : 'negative'}">
                    ${cambioRanking >= 0 ? '+' : ''}${cambioRanking.toFixed(2)}
                </span>
            </div>
            <div class="match-stat">
                <span class="stat-label">Cambio Nivel</span>
                <span class="stat-value ${cambioNivel >= 0 ? 'positive' : 'negative'}">
                    ${cambioNivel >= 0 ? '+' : ''}${cambioNivel.toFixed(2)}
                </span>
            </div>
            <div class="match-stat">
                <span class="stat-label">Estado Nivel</span>
                <span class="stat-value">${nivelChange}</span>
            </div>
        </div>
    `;
    
    // Mostrar desglose detallado de puntos
    mostrarDesglosePuntos(partido);
}

// Función para mostrar el desglose detallado de puntos
function mostrarDesglosePuntos(partido) {
    const cambioRanking = partido.puntosRankingDespues - partido.puntosRankingAntes;
    const cambioNivel = partido.puntosNivelDespues - partido.puntosNivelAntes;
    const desglose = partido.desglose || [];
    // Buscar el total real del desglose
    const totalRanking = desglose.find(f => f.nombre === 'Total ΔpuntosRanking')?.valor ?? cambioRanking;
    const totalNivel = desglose.find(f => f.nombre === 'Total ΔpuntosNivel')?.valor ?? cambioNivel;
    const nivelAntes = desglose.find(f => f.nombre === 'Nivel antes')?.valor ?? (currentPlayer.nivel - cambioNivel);
    const nivelDespues = desglose.find(f => f.nombre === 'Nivel después')?.valor ?? currentPlayer.nivel;
    const rangoNivel = desglose.find(f => f.nombre === 'Rango nivel')?.valor ?? `${currentPlayer.puntosNivel.toFixed(2)} / 100`;
    document.getElementById('matchFactors').innerHTML = `
        <h4 style="color: #f1c40f; margin-bottom: 15px;">📊 Desglose de Factores de Puntuación</h4>
        <div class="jugador-desglose">
            <div class="jugador-nombre">${currentPlayer.name}</div>
            <div class="factor-item"><span class="factor-nombre">Nivel antes</span><span class="factor-valor">${nivelAntes}</span></div>
            <div class="factor-item"><span class="factor-nombre">Nivel después</span><span class="factor-valor">${nivelDespues}</span></div>
            <div class="factor-item"><span class="factor-nombre">Rango puntosNivel</span><span class="factor-valor">${rangoNivel}</span></div>
            <div class="factor-item"><span class="factor-nombre">Δ puntosRanking</span><span class="factor-valor">${totalRanking}</span></div>
            <div class="factor-item"><span class="factor-nombre">Δ puntosNivel</span><span class="factor-valor">${totalNivel}</span></div>
            ${desglose.map(factor => {
                if ([
                    'Tipo de partido','Importancia','Nivel antes','Nivel después','Rango nivel','Total ΔpuntosRanking','Total ΔpuntosNivel'
                ].includes(factor.nombre)) return '';
                return `<div class="factor-item"><span class="factor-nombre">${factor.nombre}</span><span class="factor-valor">${factor.valor}</span></div>`;
            }).join('')}
                </div>
        <div style="margin-top:10px; color:#bdc3c7; font-size:0.95em; background:rgba(0,0,0,0.15); padding:8px 12px; border-radius:6px;">
            <b>¿Cómo se calcula?</b><br>
            El sistema tiene en cuenta el tipo de partido, rivales, compañero, margen, racha, experiencia, presión, consistencia, inactividad, rivalidad y localía.<br>
            El nivel puede subir o bajar varios escalones si la diferencia es muy grande.<br>
            El desglose muestra todos los factores y el impacto individual de cada rival.
        </div>
    `;
}

// Función para calcular factores del partido (simulación mejorada)
function calcularFactoresPartido(partido) {
    const cambioRanking = partido.puntosRankingDespues - partido.puntosRankingAntes;
    const base = partido.resultado === 'victoria' ? 10 : -10;
    const diferencia = cambioRanking - base;
    
    // Simular los factores que se calcularon
    const factores = [
        {
            nombre: 'Base por resultado',
            valor: base,
            tipo: partido.resultado === 'victoria' ? 'factor-positivo' : 'factor-negativo'
        },
        {
            nombre: 'Dificultad de rivales',
            valor: diferencia * 0.30,
            tipo: diferencia >= 0 ? 'factor-positivo' : 'factor-negativo'
        },
        {
            nombre: 'Factor compañero',
            valor: diferencia * 0.15,
            tipo: diferencia >= 0 ? 'factor-positivo' : 'factor-negativo'
        },
        {
            nombre: 'Diferencia en marcador',
            valor: diferencia * 0.10,
            tipo: diferencia >= 0 ? 'factor-positivo' : 'factor-negativo'
        },
        {
            nombre: 'Factor experiencia',
            valor: diferencia * 0.10,
            tipo: diferencia >= 0 ? 'factor-positivo' : 'factor-negativo'
        },
        {
            nombre: 'Racha de victorias/derrotas',
            valor: diferencia * 0.15,
            tipo: diferencia >= 0 ? 'factor-positivo' : 'factor-negativo'
        },
        {
            nombre: 'Diferencia de marcador específica',
            valor: diferencia * 0.05,
            tipo: diferencia >= 0 ? 'factor-positivo' : 'factor-negativo'
        }
    ];
    
    return factores;
}

// Configurar eventos del modal
function configurarEventosModal() {
    // Cerrar modal con X
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = function() {
            document.getElementById('playerModal').style.display = 'none';
        }
    }
    
    // Cerrar modal haciendo clic fuera
    window.onclick = function(event) {
        const modal = document.getElementById('playerModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
    
    // Navegación entre partidos
    const prevBtn = document.getElementById('prevMatch');
    const nextBtn = document.getElementById('nextMatch');
    
    if (prevBtn) {
        prevBtn.onclick = function() {
            if (currentMatchIndex > 0) {
                mostrarPartidoDetalle(currentMatchIndex - 1);
            }
        }
    }
    
    if (nextBtn) {
        nextBtn.onclick = function() {
            if (currentPlayer && currentPlayer.history && currentMatchIndex < currentPlayer.history.length - 1) {
                mostrarPartidoDetalle(currentMatchIndex + 1);
            }
        }
    }
}

// Crear modal HTML si no existe
function ensureModal() {
    if (document.getElementById('playerModal')) return;
    const modal = document.createElement('div');
    modal.id = 'playerModal';
    modal.style.cssText = `
        display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.7); align-items: center; justify-content: center;`;
    modal.innerHTML = `
        <div id="modalContent" style="background: #222; color: #fff; border-radius: 14px; max-width: 600px; width: 95vw; max-height: 90vh; overflow-y: auto; margin: 40px auto; padding: 32px 24px 24px 24px; position: relative; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
            <button id="closeModalBtn" style="position: absolute; top: 12px; right: 18px; background: #e74c3c; color: #fff; border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 1.2rem; cursor: pointer;">&times;</button>
            <h2 id="modalPlayerName" style="margin-top:0; margin-bottom: 10px;"></h2>
            <div id="modalPlayerLevel" style="font-size:1.1rem; margin-bottom: 10px;"></div>
            <div id="modalPlayerPoints" style="font-size:1.1rem; margin-bottom: 18px;"></div>
            <div style="margin-bottom: 18px; color: #ffcc00; font-size: 1rem;">Este desglose muestra cómo se calculan los puntos y el nivel tras cada partido, teniendo en cuenta rival, compañero, marcador, tipo de partido y más. Ganar a rivales superiores da más puntos, perder contra inferiores penaliza más, y el margen de victoria/derrota también influye. El sistema es justo y meritocrático.</div>
            <div id="modalHistory" style="max-height: 60vh; overflow-y: auto;"></div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeModalBtn').onclick = () => { modal.style.display = 'none'; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

function mostrarModalJugador(player) {
    ensureModal();
    const modal = document.getElementById('playerModal');
    document.getElementById('modalPlayerName').textContent = player.name;
    document.getElementById('modalPlayerLevel').textContent = `Nivel actual: ${player.nivel.toFixed(2)}`;
    document.getElementById('modalPlayerPoints').textContent = `Puntos Ranking: ${player.puntosRanking.toFixed(2)}`;
    // Historial de partidos
    let html = '';
    if (player.history && player.history.length > 0) {
        player.history.slice().reverse().forEach((partido, idx) => {
            html += `<div style="margin-bottom:18px; border-bottom:1px solid #444; padding-bottom:10px;">
                <div style="font-weight:bold; color:#ffcc00;">Partido ${player.history.length - idx} (${new Date(partido.fecha).toLocaleDateString('es-ES')})</div>
                <div><b>Rivales:</b> ${Array.isArray(partido.rival) ? partido.rival.join(' & ') : partido.rival}</div>
                <div><b>Compañero:</b> ${partido.companero}</div>
                <div><b>Resultado:</b> <span style="color:${partido.resultado==='victoria'?'#2ecc71':'#e74c3c'}; font-weight:bold;">${partido.resultado}</span></div>
                <div><b>Nivel antes:</b> ${partido.nivelAntes !== undefined ? partido.nivelAntes : (partido.nivel - (partido.puntosNivelDespues - partido.puntosNivelAntes)/100).toFixed(2)}</div>
                <div><b>Nivel después:</b> ${partido.nivel !== undefined ? partido.nivel.toFixed(2) : ''}</div>
                <div><b>Rango puntosNivel:</b> ${partido.puntosNivelDespues.toFixed(2)} / 100</div>
                <div><b>Puntos Ranking antes:</b> ${partido.puntosRankingAntes.toFixed(2)}</div>
                <div><b>Puntos Ranking después:</b> ${partido.puntosRankingDespues.toFixed(2)}</div>
                <div><b>Δ Puntos Ranking:</b> <span style="color:${(partido.puntosRankingDespues-partido.puntosRankingAntes)>=0?'#2ecc71':'#e74c3c'}; font-weight:bold;">${(partido.puntosRankingDespues-partido.puntosRankingAntes).toFixed(2)}</span></div>
                <div><b>Δ Puntos Nivel:</b> <span style="color:${(partido.puntosNivelDespues-partido.puntosNivelAntes)>=0?'#2ecc71':'#e74c3c'}; font-weight:bold;">${(partido.puntosNivelDespues-partido.puntosNivelAntes).toFixed(2)}</span></div>
                <div style="margin-top:8px;">
                    <b>Factores:</b>
                    <ul style="margin:0; padding-left:18px;">
                        ${(partido.desglose||[]).map(f=>`<li>${f.nombre}: <span style='color:#ffcc00;'>${f.valor}</span></li>`).join('')}
                    </ul>
                </div>
            </div>`;
        });
    } else {
        html = '<div style="color:#bdc3c7;">No hay historial de partidos disponible.</div>';
    }
    document.getElementById('modalHistory').innerHTML = html;
    modal.style.display = 'flex';
}

// Añadir evento a las filas de la tabla para mostrar el modal
function addRowClickEvents() {
    const tbody = document.getElementById('rankingBody');
    if (!tbody) return;
    Array.from(tbody.children).forEach((tr, idx) => {
        tr.onclick = () => {
            const sortedPlayers = [...players].map(corregirDatosJugador).sort((a, b) => b.puntosRanking - a.puntosRanking);
            mostrarModalJugador(sortedPlayers[idx]);
        };
    });
}

function corregirDatosJugador(player) {
    // Corrige nivel
    player.nivel = (player.nivel !== undefined && player.nivel !== null && !isNaN(player.nivel)) ? parseFloat(player.nivel) : 2.0;
    // Si tiene campo 'elo' antiguo, lo transformo a puntosRanking solo si es válido
    if (player.elo !== undefined && player.elo !== null && !isNaN(player.elo)) {
        player.puntosRanking = parseFloat(player.elo);
    }
    // Si puntosRanking es nulo, undefined, NaN o N/A, lo recalculo según la nueva fórmula
    if (player.puntosRanking === undefined || player.puntosRanking === null || isNaN(player.puntosRanking)) {
        player.puntosRanking = 500 + (player.nivel * 10 * 2);
    }
    // Si tras el procesamiento sigue siendo NaN, lo fuerzo a 0
    if (isNaN(player.puntosRanking)) player.puntosRanking = 0;
    player.puntosNivel = (player.puntosNivel !== undefined && player.puntosNivel !== null && !isNaN(player.puntosNivel)) ? parseFloat(player.puntosNivel) : 0;
    player.progresoNivel = (player.progresoNivel !== undefined && player.progresoNivel !== null && !isNaN(player.progresoNivel)) ? parseFloat(player.progresoNivel) : 0;
    player.matches = (player.matches !== undefined && player.matches !== null && !isNaN(player.matches)) ? parseInt(player.matches) : 0;
    player.wins = (player.wins !== undefined && player.wins !== null && !isNaN(player.wins)) ? parseInt(player.wins) : 0;
    player.setsWon = (player.setsWon !== undefined && player.setsWon !== null && !isNaN(player.setsWon)) ? parseInt(player.setsWon) : 0;
    player.setsLost = (player.setsLost !== undefined && player.setsLost !== null && !isNaN(player.setsLost)) ? parseInt(player.setsLost) : 0;
    return player;
}

// Guardar ranking anterior antes de procesar partidos
let rankingAnterior = [];
let posicionesAnteriores = {};

// Modificar updateRankingTable para añadir los eventos
function updateRankingTable() {
    const tbody = document.getElementById('rankingBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    // Calcular ranking actual y anterior
    const sortedPlayers = [...players].map(corregirDatosJugador).sort((a, b) => b.puntosRanking - a.puntosRanking);
    const rankingActual = sortedPlayers.map(p => p.id);
    // Identificar los usuarios del último partido jugado
    let idsUltimoPartido = [];
    if (partidos && partidos.length > 0) {
        const ultimo = partidos[partidos.length - 1];
        if (ultimo.tipo === 'liga') {
            idsUltimoPartido = [
                ...(ultimo.equipoLocalId ? obtenerJugadoresEquipo(ultimo.equipoLocalId).map(j => j.id) : []),
                ...(ultimo.equipoVisitanteId ? obtenerJugadoresEquipo(ultimo.equipoVisitanteId).map(j => j.id) : [])
            ];
        } else if (ultimo.jugadores && ultimo.jugadores.length >= 4) {
            idsUltimoPartido = ultimo.jugadores;
        }
    }
    sortedPlayers.forEach((player, index) => {
        // Solo mostrar flechas y delta si jugó el último partido
        let deltaPuntos = 0;
        let deltaHtml = '';
        let cambioPos = '';
        if (idsUltimoPartido.includes(player.id)) {
            const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
            if (lastMatch) {
                deltaPuntos = lastMatch.puntosRankingDespues - lastMatch.puntosRankingAntes;
                if (deltaPuntos > 0) deltaHtml = `<span style='color:#2ecc71;font-weight:bold;'>&uarr; +${deltaPuntos.toFixed(2)}</span>`;
                else if (deltaPuntos < 0) deltaHtml = `<span style='color:#e74c3c;font-weight:bold;'>&darr; ${deltaPuntos.toFixed(2)}</span>`;
            }
            // Comparar posición anterior y nueva
            if (posicionesAnteriores[player.id] !== undefined) {
                const diff = posicionesAnteriores[player.id] - index;
                if (diff > 0) cambioPos = `<span style='color:#2ecc71;font-weight:bold;'>&uarr;${diff}</span>`;
                else if (diff < 0) cambioPos = `<span style='color:#e74c3c;font-weight:bold;'>&darr;${Math.abs(diff)}</span>`;
                else cambioPos = `<span style='color:#bdc3c7;font-weight:bold;'>&rarr;0</span>`;
            }
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold; color: #f1c40f;">${index + 1} ${cambioPos}</td>
            <td><div style="font-weight: 600;">${player.name} ${deltaHtml}</div></td>
            <td style="color: #fff; font-weight: bold;">${parseFloat(player.nivel).toFixed(2)}</td>
            <td style="text-align: center;"><div style="font-weight: bold;">${player.matches}</div></td>
            <td style="text-align: center;"><div style="font-weight: bold; color: #2ecc71;">${player.wins}</div></td>
            <td style="text-align: center;"><div style="font-weight: bold;">${player.setsWon}-${player.setsLost}</div></td>
            <td class="puntos-elo" style="color: #f1c40f; font-weight: bold;">${player.puntosRanking.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
    addRowClickEvents();
}

// Función de diagnóstico para revisar problemas con jugadores
function diagnosticarJugadores() {
    console.log('🔍 DIAGNÓSTICO DE JUGADORES MEJORADO:');
    console.log('=====================================');
    
    // Buscar jugadores con problemas
    const jugadoresProblema = players.filter(p => 
        p.name.toLowerCase().includes('paco') || 
        p.name.toLowerCase().includes('néstor') || 
        p.name.toLowerCase().includes('nestor') ||
        p.progresoNivel >= 100 ||
        p.nivel > 5.0
    );
    
    if (jugadoresProblema.length > 0) {
        console.log('⚠️ JUGADORES CON POSIBLES PROBLEMAS:');
        jugadoresProblema.forEach(p => {
            console.log(`📊 ${p.name}:`);
            console.log(`   - Nivel: ${p.nivel}`);
            console.log(`   - PuntosNivel: ${p.puntosNivel}`);
            console.log(`   - Progreso: ${p.progresoNivel}%`);
            console.log(`   - Partidos: ${p.matches}`);
            console.log(`   - Victorias: ${p.wins}`);
            console.log(`   - Win Rate: ${p.matches > 0 ? ((p.wins / p.matches) * 100).toFixed(1) : 0}%`);
            console.log(`   - Racha actual: ${p.racha || 0}`);
            console.log(`   - Historial: ${p.history.length} partidos`);
            console.log('   ---');
        });
    } else {
        console.log('✅ No se encontraron jugadores con problemas evidentes');
    }
    
    // Estadísticas generales
    console.log('📈 ESTADÍSTICAS GENERALES:');
    console.log(`   - Total jugadores: ${players.length}`);
    console.log(`   - Promedio nivel: ${(players.reduce((sum, p) => sum + p.nivel, 0) / players.length).toFixed(2)}`);
    console.log(`   - Promedio puntosNivel: ${(players.reduce((sum, p) => sum + p.puntosNivel, 0) / players.length).toFixed(2)}`);
    console.log(`   - Jugadores con progreso 100%: ${players.filter(p => p.progresoNivel >= 100).length}`);
    console.log(`   - Jugadores sin partidos: ${players.filter(p => p.matches === 0).length}`);
    
    // Estadísticas de rachas
    const rachasPositivas = players.filter(p => (p.racha || 0) > 0);
    const rachasNegativas = players.filter(p => (p.racha || 0) < 0);
    const sinRacha = players.filter(p => !p.racha || p.racha === 0);
    
    console.log('🔥 ESTADÍSTICAS DE RACHAS:');
    console.log(`   - Jugadores con racha positiva: ${rachasPositivas.length}`);
    console.log(`   - Jugadores con racha negativa: ${rachasNegativas.length}`);
    console.log(`   - Jugadores sin racha: ${sinRacha.length}`);
    
    if (rachasPositivas.length > 0) {
        const maxRachaPos = Math.max(...rachasPositivas.map(p => p.racha || 0));
        const jugadorMaxRacha = rachasPositivas.find(p => p.racha === maxRachaPos);
        console.log(`   - Mayor racha positiva: ${maxRachaPos} (${jugadorMaxRacha?.name})`);
    }
    
    if (rachasNegativas.length > 0) {
        const maxRachaNeg = Math.min(...rachasNegativas.map(p => p.racha || 0));
        const jugadorMaxRachaNeg = rachasNegativas.find(p => p.racha === maxRachaNeg);
        console.log(`   - Mayor racha negativa: ${maxRachaNeg} (${jugadorMaxRachaNeg?.name})`);
    }
    
    // Top 5 jugadores por nivel
    const topNivel = [...players].sort((a, b) => b.nivel - a.nivel).slice(0, 5);
    console.log('🏆 TOP 5 POR NIVEL:');
    topNivel.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name}: ${p.nivel} (${p.puntosNivel} pts, ${p.progresoNivel}%, racha: ${p.racha || 0})`);
    });
    
    // Top 5 jugadores por puntosRanking
    const topRanking = [...players].sort((a, b) => b.puntosRanking - a.puntosRanking).slice(0, 5);
    console.log('🏆 TOP 5 POR PUNTOS RANKING:');
    topRanking.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name}: ${p.puntosRanking.toFixed(0)} pts (nivel ${p.nivel}, racha: ${p.racha || 0})`);
    });
    
    // Top 5 por racha
    const topRacha = [...players].sort((a, b) => (b.racha || 0) - (a.racha || 0)).slice(0, 5);
    console.log('🔥 TOP 5 POR RACHA:');
    topRacha.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name}: racha ${p.racha || 0} (${p.wins}/${p.matches} victorias)`);
    });
}

// Función de diagnóstico específica para sets
function diagnosticarSets() {
    console.log('🎾 DIAGNÓSTICO DE SETS:');
    console.log('=======================');
    
    // Buscar jugadores con sets sospechosos
    const jugadoresSetsSospechosos = players.filter(p => 
        p.setsWon > 20 || p.setsLost > 20 || 
        (p.setsWon + p.setsLost) > p.matches * 3
    );
    
    if (jugadoresSetsSospechosos.length > 0) {
        console.log('⚠️ JUGADORES CON SETS SOSPECHOSOS:');
        jugadoresSetsSospechosos.forEach(p => {
            console.log(`📊 ${p.name}:`);
            console.log(`   - Partidos: ${p.matches}`);
            console.log(`   - Sets ganados: ${p.setsWon}`);
            console.log(`   - Sets perdidos: ${p.setsLost}`);
            console.log(`   - Total sets: ${p.setsWon + p.setsLost}`);
            console.log(`   - Promedio sets por partido: ${((p.setsWon + p.setsLost) / p.matches).toFixed(2)}`);
            console.log('   ---');
        });
    } else {
        console.log('✅ No se encontraron problemas evidentes con los sets');
    }
    
    // Estadísticas generales de sets
    console.log('📈 ESTADÍSTICAS DE SETS:');
    const totalSets = players.reduce((sum, p) => sum + p.setsWon + p.setsLost, 0);
    const totalPartidos = players.reduce((sum, p) => sum + p.matches, 0);
    console.log(`   - Total sets jugados: ${totalSets}`);
    console.log(`   - Total partidos: ${totalPartidos}`);
    console.log(`   - Promedio sets por partido: ${totalPartidos > 0 ? (totalSets / totalPartidos).toFixed(2) : 0}`);
    
    // Top 5 por sets ganados
    const topSetsGanados = [...players].sort((a, b) => b.setsWon - a.setsWon).slice(0, 5);
    console.log('🏆 TOP 5 POR SETS GANADOS:');
    topSetsGanados.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name}: ${p.setsWon} sets ganados (${p.matches} partidos)`);
    });
    
    // Top 5 por sets perdidos
    const topSetsPerdidos = [...players].sort((a, b) => b.setsLost - a.setsLost).slice(0, 5);
    console.log('❌ TOP 5 POR SETS PERDIDOS:');
    topSetsPerdidos.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name}: ${p.setsLost} sets perdidos (${p.matches} partidos)`);
    });
}

async function procesarPartidos() {
    // Guardar ranking anterior y posiciones
    rankingAnterior = players.map(p => ({ id: p.id, puntosRanking: p.puntosRanking }));
    const sortedPrev = [...players].map(corregirDatosJugador).sort((a, b) => b.puntosRanking - a.puntosRanking);
    sortedPrev.forEach((p, idx) => { posicionesAnteriores[p.id] = idx; });
    for (const partido of partidos) {
        let jugadoresLocal = [];
        let jugadoresVisitante = [];
        if (partido.tipo === 'liga') {
            jugadoresLocal = obtenerJugadoresEquipo(partido.equipoLocalId);
            jugadoresVisitante = obtenerJugadoresEquipo(partido.equipoVisitanteId);
        } else {
            if (partido.jugadores && partido.jugadores.length >= 4) {
                jugadoresLocal = partido.jugadores.slice(0, 2).map(jid => players.find(j => j.id === jid) || { id: jid, name: 'Desconocido', nivel: 2.0, puntosRanking: 800, puntosNivel: 300, matches: 0, wins: 0, setsWon: 0, setsLost: 0, history: [] });
                jugadoresVisitante = partido.jugadores.slice(2, 4).map(jid => players.find(j => j.id === jid) || { id: jid, name: 'Desconocido', nivel: 2.0, puntosRanking: 800, puntosNivel: 300, matches: 0, wins: 0, setsWon: 0, setsLost: 0, history: [] });
            } else {
                jugadoresLocal = players.slice(0, 2);
                jugadoresVisitante = players.slice(2, 4);
            }
        }
        if (jugadoresLocal.length < 2 || jugadoresVisitante.length < 2) continue;
        // Procesar resultado
        const resultado = partido.resultado;
        if (!resultado || !resultado.set1) continue;
        
        // Calcular sets ganados por cada equipo
        const setsLocal = [resultado.set1.puntos1, resultado.set2?.puntos1 || 0, resultado.set3?.puntos1 || 0];
        const setsVisitante = [resultado.set1.puntos2, resultado.set2?.puntos2 || 0, resultado.set3?.puntos2 || 0];
        
        // Contar sets ganados por cada equipo
        let setsGanadosLocal = 0;
        let setsGanadosVisitante = 0;
        for (let i = 0; i < 3; i++) {
            if (setsLocal[i] > setsVisitante[i]) {
                setsGanadosLocal++;
            } else if (setsVisitante[i] > setsLocal[i]) {
                setsGanadosVisitante++;
            }
        }
        const team1Wins = setsGanadosLocal > setsGanadosVisitante;
        const diferenciaMarcador = Math.abs(setsGanadosLocal - setsGanadosVisitante);
        const setsJugados = (resultado.set1 ? 1 : 0) + (resultado.set2 ? 1 : 0) + (resultado.set3 ? 1 : 0);
        // Aplicar sistema de puntuación avanzado a cada jugador
        [...jugadoresLocal, ...jugadoresVisitante].forEach((player, idx) => {
            const win = (idx < 2 && team1Wins) || (idx >= 2 && !team1Wins);
            const companero = idx % 2 === 0 ? (idx < 2 ? jugadoresLocal[1] : jugadoresVisitante[1]) : (idx < 2 ? jugadoresLocal[0] : jugadoresVisitante[0]);
            const rivales = idx < 2 ? jugadoresVisitante : jugadoresLocal;
            const experiencia = player.matches;
            // Calcular racha actual
            let racha = player.racha || 0;
            if (win) {
                racha = racha >= 0 ? racha + 1 : 1;
            } else {
                racha = racha <= 0 ? racha - 1 : -1;
            }
            player.racha = racha;
            const puntosAntes = player.puntosRanking;
            const puntosNivelAntes = player.puntosNivel;
            // Usar el nuevo sistema de puntuación
            const resultadoPuntuacion = sistemaPuntuacion.calcularCambio({
                jugador: player,
                rivales: rivales,
                resultado: win ? 1 : 0,
                tipoPartido: partido.tipo || 'liga',
                margenSets: diferenciaMarcador,
                experiencia: experiencia,
                racha: racha,
                setsJugados: setsJugados,
                companero: companero,
                formaRivales: rivales.reduce((a, r) => a + (r.racha || 0), 0),
                esPartidoDecisivo: false, // Puedes ajustar según reglas
                diasSinJugar: 0 // Puedes calcularlo si tienes la info
            });
            // Protección contra NaN
            player.puntosRanking = (!isNaN(resultadoPuntuacion.nuevoPuntos) && resultadoPuntuacion.nuevoPuntos !== undefined && resultadoPuntuacion.nuevoPuntos !== null) ? resultadoPuntuacion.nuevoPuntos : puntosAntes;
            player.puntosNivel = (!isNaN(resultadoPuntuacion.puntosNivel) && resultadoPuntuacion.puntosNivel !== undefined && resultadoPuntuacion.puntosNivel !== null) ? resultadoPuntuacion.puntosNivel : puntosNivelAntes;
            player.nivel = (!isNaN(resultadoPuntuacion.nivel) && resultadoPuntuacion.nivel !== undefined && resultadoPuntuacion.nivel !== null) ? resultadoPuntuacion.nivel : player.nivel;
            player.progresoNivel = (!isNaN(resultadoPuntuacion.progreso) && resultadoPuntuacion.progreso !== undefined && resultadoPuntuacion.progreso !== null) ? resultadoPuntuacion.progreso : 0;
            player.matches++;
            if (win) player.wins++;
            // Asignar sets correctamente según el equipo del jugador
            if (idx < 2) {
                player.setsWon += setsGanadosLocal;
                player.setsLost += setsGanadosVisitante;
            } else {
                player.setsWon += setsGanadosVisitante;
                player.setsLost += setsGanadosLocal;
            }
            player.history.push({
                partidoId: partido.id,
                fecha: partido.fecha,
                rival: rivales.map(r => r.name),
                companero: companero.name,
                resultado: win ? 'victoria' : 'derrota',
                puntosRankingAntes: puntosAntes,
                puntosRankingDespues: player.puntosRanking,
                puntosNivelAntes: puntosNivelAntes,
                puntosNivelDespues: player.puntosNivel,
                nivel: player.nivel,
                progreso: player.progresoNivel,
                desglose: resultadoPuntuacion.desglose,
                racha: racha,
                diferenciaMarcador: diferenciaMarcador,
                setsGanados: idx < 2 ? setsGanadosLocal : setsGanadosVisitante,
                setsPerdidos: idx < 2 ? setsGanadosVisitante : setsGanadosLocal
            });
        });
    }
    updateRankingTable();
}

export async function iniciarSimuladorElo() {
    await inicializarFirebase();
    await cargarUsuarios();
    await cargarEquipos();
    await cargarPartidos();
    await procesarPartidos();
    // Configurar eventos del modal
    configurarEventosModal();
    // Ejecutar diagnósticos
    diagnosticarJugadores();
    diagnosticarSets();
}

// Al cargar la página, procesar todos los partidos reales en orden cronológico
window.onload = async function() {
    await inicializarFirebase();
    await cargarUsuarios();
    await cargarEquipos();
    await cargarPartidos();
    // Ordenar partidos por fecha ascendente
    partidos = partidos.sort((a, b) => a.fecha - b.fecha);
    await procesarPartidos();
    document.getElementById('historyList') && (document.getElementById('historyList').innerHTML = '<div class="history-item">Procesamiento completo. Consulta la clasificación y desglose.</div>');
};

// Función para mostrar error de autenticación
function mostrarErrorAutenticacion() {
    const container = document.querySelector('.container');
    if (container) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            background: rgba(231, 76, 60, 0.2);
            border: 1px solid #e74c3c;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
            color: #fff;
        `;
        errorDiv.innerHTML = `
            <h3 style="color: #e74c3c; margin-bottom: 10px;">⚠️ Error de Acceso</h3>
            <p>No se puede acceder a los datos de Firebase. Esto puede deberse a:</p>
            <ul style="text-align: left; max-width: 500px; margin: 10px auto;">
                <li>Reglas de seguridad que requieren autenticación</li>
                <li>Problemas de conectividad</li>
                <li>Configuración de Firebase</li>
            </ul>
            <p style="margin-top: 15px; font-size: 0.9rem; opacity: 0.8;">
                Se mostrarán datos de ejemplo para demostrar la funcionalidad.
            </p>
        `;
        container.insertBefore(errorDiv, container.firstChild);
    }
}

// Función para generar datos de ejemplo
function generarDatosEjemplo() {
    const nombresEjemplo = [
        'Carlos García', 'María López', 'Juan Pérez', 'Ana Martínez', 'Luis Rodríguez',
        'Carmen Sánchez', 'Pedro Fernández', 'Isabel Torres', 'Miguel Ruiz', 'Elena Jiménez',
        'Francisco Morales', 'Rosa Vega', 'Antonio Castro', 'Lucía Moreno', 'Diego Herrera',
        'Sofía Romero', 'Javier Díaz', 'Paula Alonso', 'Roberto Gutiérrez', 'Natalia Navarro'
    ];
    
    return nombresEjemplo.map((nombre, index) => {
        const nivel = 2.0 + (Math.random() * 1.5);
        const matches = Math.floor(Math.random() * 50) + 5;
        const wins = Math.floor(Math.random() * matches);
        const setsWon = Math.floor(Math.random() * (matches * 3));
        const setsLost = Math.floor(Math.random() * (matches * 3));
        
        return {
            id: `ejemplo_${index}`,
            name: nombre,
            nivel: Math.round(nivel * 100) / 100,
            puntosRanking: 600 + (nivel * 100) + (Math.random() * 200),
            puntosNivel: Math.floor(Math.random() * 100),
            progresoNivel: Math.floor(Math.random() * 100),
            matches: matches,
            wins: wins,
            setsWon: setsWon,
            setsLost: setsLost,
            racha: Math.floor(Math.random() * 10) - 5,
            history: []
        };
    });
}