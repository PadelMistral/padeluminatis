import { db } from './firebase-config.js';
import { 
    collection, doc, getDocs, onSnapshot, 
    addDoc, updateDoc, query, where, orderBy,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

// Función para crear una nueva notificación
export async function crearNotificacion(tipo, mensaje, usuarioId, datosAdicionales = {}) {
    try {
        const notificacion = {
            tipo,
            mensaje,
            usuarioId,
            leida: false,
            fecha: serverTimestamp(),
            ...datosAdicionales
        };
        
        await addDoc(collection(db, "notificaciones"), notificacion);
    } catch (error) {
        console.error("Error al crear notificación:", error);
    }
}

// Función para marcar una notificación como leída
export async function marcarNotificacionLeida(notificacionId) {
    try {
        await updateDoc(doc(db, "notificaciones", notificacionId), {
            leida: true
        });
    } catch (error) {
        console.error("Error al marcar notificación como leída:", error);
    }
}

// Función para obtener las notificaciones de un usuario
export function suscribirNotificaciones(usuarioId, callback) {
    const q = query(
        collection(db, "notificaciones"),
        where("usuarioId", "==", usuarioId),
        orderBy("fecha", "desc")
    );

    return onSnapshot(q, (snapshot) => {
        const notificaciones = [];
        snapshot.forEach((doc) => {
            notificaciones.push({
                id: doc.id,
                ...doc.data()
            });
        });
        callback(notificaciones);
    });
}

// Función para crear notificación de nuevo partido
export async function notificarNuevoPartido(partido, creadorId) {
    const mensaje = `Se ha creado un nuevo partido ${partido.tipo === 'liga' ? 'de liga' : 'amistoso'}`;
    await crearNotificacion('nuevo_partido', mensaje, creadorId, {
        partidoId: partido.id,
        tipoPartido: partido.tipo
    });
}

// Función para notificar partido guardado
export async function notificarPartidoGuardado(partido, usuarioId) {
    const mensaje = `Has sido añadido a un partido ${partido.tipo === 'liga' ? 'de liga' : 'amistoso'}`;
    await crearNotificacion('partido_guardado', mensaje, usuarioId, {
        partidoId: partido.id,
        tipoPartido: partido.tipo
    });
}

// Función para notificar partido del día
export async function notificarPartidoHoy(partido, usuarioId) {
    const mensaje = `Tienes un partido ${partido.tipo === 'liga' ? 'de liga' : 'amistoso'} hoy`;
    await crearNotificacion('partido_hoy', mensaje, usuarioId, {
        partidoId: partido.id,
        tipoPartido: partido.tipo
    });
}

// Función para notificar nuevo mensaje
export async function notificarNuevoMensaje(remitenteId, destinatarioId, mensaje) {
    await crearNotificacion('nuevo_mensaje', `Nuevo mensaje de ${remitenteId}`, destinatarioId, {
        remitenteId,
        mensaje
    });
} 