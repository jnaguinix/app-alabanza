// ==========================================================================
// MÓDULO DE PÁGINA: Historial (Con Edición de Servicio)
// ==========================================================================
import { state } from './main.js';
// CORRECCIÓN DEFINITIVA: Importar searchSongsWithArtist en lugar de searchSongs
import { fetchFullServiceDetails, deleteService, searchSongsWithArtist, searchArtists } from './api.js'; 
import { formatDate, getDayOfWeek, setupAutocomplete, setupFilterToggle, showConfirmModal, showInfoModal, showPage } from './ui.js';

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

async function shareServiceCard(cardElement) {
    let bandToggleBtn = null;
    let bandDetails = null;
    let originalBandState = { expanded: false, text: '' };
    let needsDelay = false; // Variable para controlar si necesitamos un retraso

    try {
        // Expandir la sección de músicos temporalmente si existe y está colapsada
        bandToggleBtn = cardElement.querySelector('.band-toggle-btn');
        bandDetails = cardElement.querySelector('.band-details');

        if (bandToggleBtn && bandDetails && !bandToggleBtn.classList.contains('expanded')) {
            originalBandState.expanded = false;
            originalBandState.text = bandToggleBtn.innerHTML;
            bandToggleBtn.classList.add('expanded');
            bandDetails.classList.add('expanded');
            const bandSize = bandDetails.querySelector('.band-list').children.length;
            bandToggleBtn.innerHTML = `<span class="chevron">▼</span> Ocultar Músicos (${bandSize})`;
            needsDelay = true; // Marcamos que necesitamos un retraso
        } else if (bandToggleBtn && bandDetails && bandToggleBtn.classList.contains('expanded')) {
            originalBandState.expanded = true; // Ya estaba expandido, no necesitamos revertir
        }

        let dataUrl;
        if (needsDelay) {
            // Si expandimos la sección, esperamos un poco para que se renderice
            dataUrl = await new Promise(resolve => {
                setTimeout(async () => {
                    const url = await htmlToImage.toPng(cardElement);
                    resolve(url);
                }, 500); // Pequeño retraso de 500ms
            });
        } else {
            // Si no hubo cambios o ya estaba expandido, capturamos directamente
            dataUrl = await htmlToImage.toPng(cardElement);
        }
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'servicio.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Servicio de Alabanza',
                text: '¡Mira este servicio de alabanza!',
            });
            showInfoModal('¡Compartido!', 'El servicio ha sido compartido con éxito.', 'success');
        } else {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = 'servicio.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showInfoModal('Descarga Exitosa', 'La imagen del servicio ha sido descargada. Puedes compartirla manualmente.', 'info');
        }
    } catch (error) {
        console.error('Error al compartir el servicio:', error);
        showInfoModal('Error', 'No se pudo compartir el servicio. Inténtalo de nuevo.', 'error');
    } finally {
        // Revertir la expansión si se expandió temporalmente
        if (bandToggleBtn && bandDetails && !originalBandState.expanded) {
            bandToggleBtn.classList.remove('expanded');
            bandDetails.classList.remove('expanded');
            bandToggleBtn.innerHTML = originalBandState.text;
        }
    }
}

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
                <div class="service-card-actions">
                    <button class="btn-icon edit-service-btn" data-fecha="${service.fecha}" title="Editar Servicio">✏️</button>
                    <button class="btn-icon share-service-btn" data-service-id="${service.id}" title="Compartir Servicio">📲</button>
                </div>
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
        historialElements.resultsSection.innerHTML = '<div class="no-results">Error al cargar servicios.</div>';
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
        
        const editBtn = e.target.closest('.edit-service-btn');
        if (editBtn) {
            const fechaParaEditar = editBtn.dataset.fecha;
            state.dateToEdit = fechaParaEditar;
            showPage('page-formulario');
            return;
        }

        const shareBtn = e.target.closest('.share-service-btn');
        if (shareBtn) {
            const serviceCard = shareBtn.closest('.service-card');
            if (serviceCard) {
                shareServiceCard(serviceCard);
            }
            return;
        }
    });

    setupAutocomplete(historialElements.filterDirector, async (searchTerm) => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return state.allPeople.map(p => p.nombre_persona).filter(name => name.toLowerCase().includes(lowerCaseSearchTerm));
    });

    // CORRECCIÓN: Actualizar el autocompletado de canciones en historial
    setupAutocomplete(historialElements.filterSong, searchSongsWithArtist, (selectedSong) => {
        historialElements.filterSong.value = selectedSong.song_name;
        historialElements.filterArtist.value = selectedS.artist_name;
    });

    setupAutocomplete(historialElements.filterArtist, searchArtists);
}
