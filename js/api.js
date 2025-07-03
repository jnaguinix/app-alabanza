// ==========================================================================
// MÓDULO API: api.js
// RESPONSABILIDAD: Centralizar TODA la comunicación con la base de datos de Supabase.
// ==========================================================================

import { supabaseClient } from './main.js';

/**
 * Obtiene los detalles completos de los servicios, con opciones de filtro y paginación.
 * Llama a la función RPC 'get_full_service_details' en la base de datos.
 * @param {object} filters - Objeto con filtros opcionales.
 * @returns {Promise<Array>} Una promesa que resuelve a un array de servicios.
 */
export async function fetchFullServiceDetails(filters = {}) {
    const { data, error } = await supabaseClient.rpc('get_full_service_details', filters);
    if (error) {
        console.error("Error al obtener detalles de servicios:", error);
        throw error;
    }
    return data || [];
}

/**
 * Función específica para los reportes.
 * Llama a la función RPC 'get_report_details' que devuelve los nombres de las canciones limpios.
 * @param {object} filters - Objeto con filtros opcionales.
 * @returns {Promise<Array>} Una promesa que resuelve a un array de servicios para reportes.
 */
export async function fetchReportDetails(filters = {}) {
    const { data, error } = await supabaseClient.rpc('get_report_details', filters);
    if (error) {
        console.error("Error al obtener detalles para reportes:", error);
        throw error;
    }
    return data || [];
}

/**
 * Guarda o actualiza un servicio completo (Upsert).
 * Llama a la función RPC 'upsert_full_service' en la base de datos.
 * @param {object} serviceData - Objeto con los datos del servicio a guardar.
 * @returns {Promise<object>} Una promesa que resuelve con la respuesta de la DB.
 */
export async function saveFullService(serviceData) {
    const { data, error } = await supabaseClient.rpc('upsert_full_service', serviceData);
    if (error) {
        console.error("Error al guardar el servicio:", error);
        throw error;
    }
    return data;
}

/**
 * Elimina un servicio por su ID.
 * Llama a la función RPC 'delete_service'.
 * @param {number} serviceId - El ID del servicio a eliminar.
 * @returns {Promise<void>}
 */
export async function deleteService(serviceId) {
    const { error } = await supabaseClient.rpc('delete_service', { p_service_id: serviceId });
    if (error) {
        console.error("Error al eliminar el servicio:", error);
        throw error;
    }
}


// ========= FUNCIONES DE CATÁLOGOS (LEER) =========
export async function fetchAllPeople() {
    const { data, error } = await supabaseClient.from('personas').select('id, nombre_persona');
    if (error) {
        console.error("Error al cargar personas:", error);
        throw error;
    }
    return data.sort((a, b) => a.nombre_persona.localeCompare(b.nombre_persona));
}

export async function fetchAllInstruments() {
    const { data, error } = await supabaseClient.from('instrumentos').select('id, nombre_instrumento').neq('nombre_instrumento', 'Director');
    if (error) {
        console.error("Error al cargar instrumentos:", error);
        throw error;
    }
    return data.sort((a, b) => a.nombre_instrumento.localeCompare(b.nombre_instrumento));
}

export async function fetchAllArtists() {
    const { data, error } = await supabaseClient.from('artistas').select('id, nombre_artista');
    if (error) {
        console.error("Error al cargar artistas:", error);
        throw error;
    }
    return data.sort((a, b) => a.nombre_artista.localeCompare(b.nombre_artista));
}


// ========= FUNCIONES DE BÚSQUEDA (AUTOCOMPLETADO) =========

// CAMBIO: NUEVA función que llama a la nueva RPC
/**
 * Busca canciones que coincidan con un término de búsqueda, devolviendo también el artista.
 * @param {string} searchTerm - El texto a buscar.
 * @returns {Promise<Array<object>>} Una promesa que resuelve a un array de objetos con {id, display_name, song_name, artist_name}.
 */
export async function searchSongsWithArtist(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return [];
    const { data, error } = await supabaseClient.rpc('search_songs_with_artist', { search_term: searchTerm });
    if (error) {
        console.error("Error buscando canciones con artista:", error);
        return [];
    }
    return data;
}

/**
 * Busca artistas que coincidan con un término de búsqueda para el autocompletado.
 * @param {string} searchTerm - El texto a buscar.
 * @returns {Promise<Array<string>>} Una promesa que resuelve a un array de nombres de artista.
 */
export async function searchArtists(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return [];
    const { data, error } = await supabaseClient
        .from('artistas')
        .select('nombre_artista')
        .ilike('nombre_artista', `%${searchTerm}%`)
        .limit(10);
    if (error) {
        console.error("Error buscando artistas:", error);
        return [];
    }
    return data.map(a => a.nombre_artista);
}