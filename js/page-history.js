// ==========================================================================
// MÓDULO DE PÁGINA: Historial (Con Filtro de Artista)
// ==========================================================================
import { state } from './main.js';
import { fetchFullServiceDetails, searchSongs, searchArtists, deleteService } from './api.js';
import { normalizeString, formatDate, getDayOfWeek, setupAutocomplete, setupFilterToggle, showConfirmModal, showInfoModal, showPage } from './ui.js';

const historialElements = {
    pageElement: document.getElementById('page-historial'),
    toggleFiltersBtn: document.getElementById('toggle-historial-filters-btn'),
    filtersSection: document.getElementById('historial-filters-section'),
    filterDateStart: document.getElementById('filter-date-start-historial'),
    filterDateEnd: document.getElementById('filter-date-end-historial'),
    filterSong: document.getElementById('filter-song'),
    filterArtist: document.getElementById('filter-artist-historial'),
    filterDirector: document.getElementById('filter-director'),
    applyBtn: document.getElementById('apply-filters-btn-historial'),
    clearBtn: document.getElementById('clear-filters-btn-historial'),
    resultsSection: document.getElementById('results-section-historial'),
};
const scrollTrigger = document.getElementById('historial-scroll-trigger');
const instrumentIconMap = { 'default': '🎶', 'Director': '🎤', 'Bateria': '🥁', 'Bajo': '🎸', 'Piano': '🎹', 'Guitarra Acustica': '🎸', 'Guitarra Electrica': '🎸', 'Corista': '🗣️' };

function renderServicesHistorial(servicesToDisplay, append = false) {
    const resultsSection = historialElements.resultsSection;
    if (!append) resultsSection.innerHTML = '';

    if (servicesToDisplay.length === 0 && !append) {
        resultsSection.innerHTML = '<div class="no-results">No se encontraron servicios.</div>';
        return;
    }

    servicesToDisplay.forEach(service => {
        const card = document.createElement('div');
        card.className = 'service-card';
        const songsHTML = (service.canciones || []).map(song => `<li>🎵 ${song}</li>`).join('');
        let bandHTML = '';
        if (service.banda && service.banda.length > 0) {
            const bandListHTML = service.banda.map(musico => `<li>${instrumentIconMap[musico.instrumento_nombre] || instrumentIconMap.default} ${musico.persona_nombre} (${musico.instrumento_nombre})</li>`).join('');
            bandHTML = `<button class="band-toggle-btn" type="button"><span class="chevron">▶</span> Ver Músicos (${service.banda.length})</button><div class="band-details"><ul class="band-list">${bandListHTML}</ul></div>`;
        }

        card.innerHTML = `
            <div class="service-card-header">
                <h3>📅 ${formatDate(service.fecha)} (${getDayOfWeek(service.fecha)})</h3>
                <button class="btn btn-danger delete-service-btn" data-service-id="${service.id}" title="Eliminar Servicio">🗑️</button>
            </div>
            <div class="service-details"><p><strong>🎤 Director:</strong> ${service.director || 'N/A'}</p></div>
            <ul class="songs-list">${songsHTML}</ul>
            ${bandHTML}
        `;

        resultsSection.appendChild(card);
    });
}

async function fetchHistorialServices(isNewFilter = false) {
    if (state.isLoadingHistorial || (!state.hasMoreHistorial && !isNewFilter)) return;
    
    state.isLoadingHistorial = true;
    if (isNewFilter) {
        state.historialPage = 0;
        state.hasMoreHistorial = true;
        historialElements.resultsSection.innerHTML = '<div class="no-results">Cargando...</div>';
    }

    const filters = {
        _start_date: historialElements.filterDateStart.value || null,
        _end_date: historialElements.filterDateEnd.value || null,
        _song_name: historialElements.filterSong.value || null,
        _artist_name: historialElements.filterArtist.value || null,
        _director_name: historialElements.filterDirector.value || null,
        _limit: state.historialResultsPerPage,
        _offset: state.historialPage * state.historialResultsPerPage
    };

    try {
        const data = await fetchFullServiceDetails(filters);
        if (isNewFilter) historialElements.resultsSection.innerHTML = '';
        
        if (data.length > 0) {
            renderServicesHistorial(data, true);
            state.historialPage++;
        }
        if (data.length < state.historialResultsPerPage) {
            state.hasMoreHistorial = false;
            const endMessage = document.createElement('div');
            endMessage.className = 'no-results end-of-results';
            endMessage.textContent = 'Fin de los resultados';
            if (!historialElements.resultsSection.querySelector('.end-of-results')) {
                historialElements.resultsSection.appendChild(endMessage);
            }
        }
    } catch (error) {
        console.error("Error al cargar historial:", error);
        alert("No se pudieron cargar los servicios del historial.");
    } finally {
        state.isLoadingHistorial = false;
    }
}

export function initializePage() {
    if (!state.user) {
        showPage('login-page');
        return;
    }
    fetchHistorialServices(true);
}

export function initializePageListeners() {
    // **CORRECCIÓN:** Se elimina la guarda if(!state.user) para que los listeners SIEMPRE se asignen.
    historialElements.applyBtn.addEventListener('click', () => fetchHistorialServices(true));
    historialElements.clearBtn.addEventListener('click', () => {
        historialElements.filterDateStart.value = '';
        historialElements.filterDateEnd.value = '';
        historialElements.filterSong.value = '';
        historialElements.filterArtist.value = '';
        historialElements.filterDirector.value = '';
        fetchHistorialServices(true);
    });

    setupFilterToggle(historialElements.toggleFiltersBtn, historialElements.filtersSection);

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !state.isLoadingHistorial && state.hasMoreHistorial) {
            fetchHistorialServices();
        }
    }, { root: null, threshold: 0.1 });

    if (scrollTrigger) {
        observer.observe(scrollTrigger);
    }

    historialElements.resultsSection.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('.band-toggle-btn');
        if (toggleBtn) {
            const detailsSection = toggleBtn.nextElementSibling;
            toggleBtn.classList.toggle('expanded');
            detailsSection.classList.toggle('expanded');
            const isExpanded = toggleBtn.classList.contains('expanded');
            const bandSize = detailsSection.querySelector('.band-list').children.length;
            toggleBtn.innerHTML = `<span class="chevron">${isExpanded ? '▼' : '▶'}</span> ${isExpanded ? 'Ocultar Músicos' : `Ver Músicos (${bandSize})`}`;
            return;
        }

        const deleteBtn = e.target.closest('.delete-service-btn');
        if (deleteBtn) {
            const serviceId = deleteBtn.dataset.serviceId;
            showConfirmModal('¿Eliminar Servicio?', '¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer.',
                async () => {
                    try {
                        await deleteService(serviceId);
                        deleteBtn.closest('.service-card').remove();
                        showInfoModal('¡Éxito!', 'Servicio eliminado correctamente.', 'success');
                    } catch (error) {
                        showInfoModal('Error', 'Error al eliminar el servicio. Por favor, intenta de nuevo.', 'error');
                        console.error("Error al eliminar servicio:", error);
                    }
                }
            );
        }
    });

    setupAutocomplete(historialElements.filterDirector, async (searchTerm) => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return state.allPeople.map(p => p.nombre_persona).filter(name => name.toLowerCase().includes(lowerCaseSearchTerm));
    });

    setupAutocomplete(historialElements.filterSong, searchSongs);
    setupAutocomplete(historialElements.filterArtist, searchArtists);
}