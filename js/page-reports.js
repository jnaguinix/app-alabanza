// ==========================================================================
// MÓDULO DE PÁGINA: Reportes
// RESPONSABILIDAD: Lógica de la página de Reportes, incluyendo filtros,
// gráficos y visualización de detalles.
// ==========================================================================
import { state } from './main.js'; 
// CAMBIO: Reemplazar searchSongs con searchSongsWithArtist
import { fetchReportDetails, searchSongsWithArtist, searchArtists } from './api.js'; 
import { normalizeString, formatDate, getDayOfWeek, renderChart, setupAutocomplete, setupFilterToggle, showPage } from './ui.js'; 

const reporteElements = {
    pageElement: document.getElementById('page-reporte'),
    toggleFiltersBtn: document.getElementById('toggle-filters-btn'),
    filtersSection: document.getElementById('reporte-filters-section'),
    filterDateStart: document.getElementById('filter-date-start'),
    filterDateEnd: document.getElementById('filter-date-end'),
    filterDirector: document.getElementById('filter-director-reporte'),
    filterSong: document.getElementById('filter-song-reporte'),
    filterArtist: document.getElementById('filter-artist-reporte'),
    applyBtn: document.getElementById('apply-filters-btn-reporte'),
    clearBtn: document.getElementById('clear-filters-btn-reporte'),
    statCard1Value: document.getElementById('stat-card-1-value'),
    statCard1Label: document.getElementById('stat-card-1-label'),
    statCard2Value: document.getElementById('stat-card-2-value'),
    statCard2Label: document.getElementById('stat-card-2-label'),
    songsChartCanvas: document.getElementById('songsChart'),
    directorsChartCanvas: document.getElementById('directorsChart'),
    songDetailsSection: document.getElementById('song-details-section'),
    songDetailsTitle: document.getElementById('song-details-title'),
    songDetailsList: document.getElementById('song-details-list'),
    loadMoreSongDetailsBtn: document.getElementById('load-more-song-details-btn'),
    directorDetailsSection: document.getElementById('director-details-section'),
    directorDetailsTitle: document.getElementById('director-details-title'),
    directorDetailsList: document.getElementById('director-details-list'),
    loadMoreDirectorDetailsBtn: document.getElementById('load-more-director-details-btn'),
};

const directorColorsMap = {
    'Pastor Carlos': '#2C3E50', 'Hermana Ana': '#3498DB', 'Laura Torres': '#F39C12', 'Javier Castillo': '#2ECC71',
    'Sofía Vargas': '#E74C3C', 'Hermano Pedro': '#9B59B6', 'Kathe': '#1ABC9C', 'Hanny': '#D35400', 'Luis': '#2980B9',
    'Miguel': '#C0392B', 'Manuel': '#34495E', 'Jhonny': '#8E44AD', 'Kathe-Camilo': '#5D7B9F', 'Alejo': '#F1C40F', 'default': '#7F8C8D'
};

let songsChartInstance, directorsChartInstance;
let currentSongDetailsPage = 0, currentDirectorDetailsPage = 0;
const detailsPerPage = 6;
let currentFilteredSongDetails = [], currentFilteredDirectorSongs = [];

async function fetchAndRenderReports() {
    const filters = {
        _start_date: reporteElements.filterDateStart.value || null,
        _end_date: reporteElements.filterDateEnd.value || null,
        _director_name: reporteElements.filterDirector.value || null,
        _song_name: reporteElements.filterSong.value || null,
        _artist_name: reporteElements.filterArtist.value || null
    };
    try {
        const filteredServices = await fetchReportDetails(filters);
        renderChartsAndStats(filteredServices);
    } catch (error) {
        console.error("Error al obtener detalles para reportes:", error); 
        alert("No se pudieron cargar los datos para los reportes.");
    }
}

function renderChartsAndStats(services) {
    clearDetailsReporte();
    const songFilter = normalizeString(reporteElements.filterSong.value), directorFilter = normalizeString(reporteElements.filterDirector.value);
    
    if (songFilter) {
        reporteElements.statCard1Label.textContent = "Veces Interpretada";
        reporteElements.statCard1Value.textContent = services.length;
        if (services.length > 0) {
            const directorCountsForSong = services.reduce((acc, s) => { if (s.director) acc[s.director] = (acc[s.director] || 0) + 1; return acc; }, {});
            const mainDirector = Object.entries(directorCountsForSong).sort((a, b) => b[1] - a[1])[0];
            if (mainDirector) { reporteElements.statCard2Label.textContent = `Por ${mainDirector[0]} (Principal)`; reporteElements.statCard2Value.textContent = mainDirector[1]; } 
            else { reporteElements.statCard2Label.textContent = "Director Principal"; reporteElements.statCard2Value.textContent = '0'; }
        } else { reporteElements.statCard2Label.textContent = "Director Principal"; reporteElements.statCard2Value.textContent = '0'; }
    } else {
        reporteElements.statCard1Label.textContent = "Servicios Filtrados";
        reporteElements.statCard1Value.textContent = services.length;
        reporteElements.statCard2Label.textContent = "Canciones Únicas";
        reporteElements.statCard2Value.textContent = new Set(services.flatMap(s => s.canciones)).size;
    }
    
    let topSongs;
    if (songFilter) { topSongs = [[reporteElements.filterSong.value.trim(), services.length]]; } 
    else { 
        const songCounts = services.flatMap(s => s.canciones).reduce((acc, song) => { acc[song] = (acc[song] || 0) + 1; return acc; }, {}); 
        topSongs = Object.entries(songCounts).sort((a, b) => b[1] - a[1]).slice(0, 5); 
    }
    
    const directorCounts = services.reduce((acc, s) => { if (s.director) acc[s.director] = (acc[s.director] || 0) + 1; return acc; }, {});
    const topDirectors = Object.entries(directorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const primaryColorFromCss = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
    const directorColors = topDirectors.map(d => directorColorsMap[d[0]] || directorColorsMap['default']);
    
    const songClickHandler = createChartClickHandler(reporteElements.filterSong, reporteElements.filterDirector);
    const directorClickHandler = createChartClickHandler(reporteElements.filterDirector, reporteElements.filterSong);

    songsChartInstance = renderChart(songsChartInstance, reporteElements.songsChartCanvas, { type: 'bar', data: { labels: topSongs.map(s => s[0]), datasets: [{ label: 'Veces Cantada', data: topSongs.map(s => s[1]), backgroundColor: primaryColorFromCss, borderRadius: 4 }] }, options: { onClick: songClickHandler, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { minRotation: 45, maxRotation: 45, autoSkip: true, font: { size: 10 } } } } } });
    directorsChartInstance = renderChart(directorsChartInstance, reporteElements.directorsChartCanvas, { type: 'doughnut', data: { labels: topDirectors.map(d => d[0]), datasets: [{ label: 'Servicios', data: topDirectors.map(d => d[1]), backgroundColor: directorColors, borderWidth: 3 }] }, options: { onClick: directorClickHandler, responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', onClick: handleLegendClick, labels: { padding: 15 } } } } });
    
    if (songFilter && !directorFilter) { renderSongDetails(reporteElements.filterSong.value.trim(), services); } 
    else if (directorFilter && !songFilter) { renderDirectorDetails(reporteElements.filterDirector.value.trim(), services); }
}

function clearDetailsReporte() {
    reporteElements.songDetailsSection.classList.add('hidden');
    reporteElements.directorDetailsSection.classList.add('hidden');
    const existingSummary = reporteElements.songDetailsSection.querySelector('.summary-stats');
    if (existingSummary) existingSummary.remove();
}

function renderSongDetails(songName, servicesWithSong, append = false) {
    const { songDetailsSection, songDetailsTitle, songDetailsList, loadMoreSongDetailsBtn } = reporteElements;
    if (!songName) { songDetailsSection.classList.add('hidden'); return; }
    if (!append) {
        songDetailsList.innerHTML = ''; currentSongDetailsPage = 0;
        currentFilteredSongDetails = [...servicesWithSong].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        const directorCounts = currentFilteredSongDetails.reduce((acc, service) => { if(service.director) acc[service.director] = (acc[service.director] || 0) + 1; return acc; }, {});
        const sortedDirectors = Object.entries(directorCounts).sort((a, b) => b[1] - a[1]);
        const topDirector = sortedDirectors.length > 0 ? sortedDirectors[0][0] : 'N/A';
        const summaryHTML = `<div class="summary-stats"><div class="summary-item"><div class="value">${currentFilteredSongDetails.length}</div><div class="label">Veces Interpretada</div></div><div class="summary-item"><div class="value">${sortedDirectors.length}</div><div class="label">Directores Únicos</div></div><div class="summary-item"><div class="value" style="font-size: 1.5rem; line-height: 1.2;">${topDirector}</div><div class="label">Director Principal</div></div></div>`;
        songDetailsTitle.insertAdjacentHTML('afterend', summaryHTML);
    }
    songDetailsSection.classList.remove('hidden');
    songDetailsTitle.textContent = `Detalle de la Canción: "${songName}"`;
    const detailsToDisplay = currentFilteredSongDetails.slice(currentSongDetailsPage * detailsPerPage, (currentSongDetailsPage + 1) * detailsPerPage);
    if (detailsToDisplay.length === 0 && !append) { songDetailsList.innerHTML = '<li class="no-details">No se encontraron detalles.</li>'; loadMoreSongDetailsBtn.classList.add('hidden'); return; }
    detailsToDisplay.forEach(service => { const listItem = document.createElement('li'); listItem.className = 'details-item'; listItem.innerHTML = `<strong>${formatDate(service.fecha)}</strong><span class="date-director">Dirigió: ${service.director || 'N/A'}</span>`; songDetailsList.appendChild(listItem); });
    currentSongDetailsPage++;
    loadMoreSongDetailsBtn.classList.toggle('hidden', currentSongDetailsPage * detailsPerPage >= currentFilteredSongDetails.length);
}

function renderDirectorDetails(directorName, servicesByDirector, append = false) {
    const { directorDetailsSection, directorDetailsTitle, directorDetailsList, loadMoreDirectorDetailsBtn } = reporteElements;
    if (!directorName) { directorDetailsSection.classList.add('hidden'); return; }
    const songCounts = servicesByDirector.flatMap(s => s.canciones).reduce((acc, song) => { acc[song] = (acc[song] || 0) + 1; return acc; }, {});
    const sortedSongs = Object.entries(songCounts).sort((a, b) => b[1] - a[1]);
    if (!append) { 
        directorDetailsList.innerHTML = ''; currentDirectorDetailsPage = 0; currentFilteredDirectorSongs = sortedSongs; 
    }
    directorDetailsSection.classList.remove('hidden');
    directorDetailsTitle.textContent = `Canciones Dirigidas por: "${directorName}"`;
    const detailsToDisplay = currentFilteredDirectorSongs.slice(currentDirectorDetailsPage * detailsPerPage, (currentDirectorDetailsPage + 1) * detailsPerPage);
    if (detailsToDisplay.length === 0 && !append) { 
        directorDetailsList.innerHTML = '<li class="no-details">No se encontraron canciones.</li>'; loadMoreDirectorDetailsBtn.classList.add('hidden'); return; 
    }
    detailsToDisplay.forEach(([song, count]) => { 
        const listItem = document.createElement('li'); listItem.className = 'details-item'; listItem.innerHTML = `<strong>${song}</strong><span class="song-count">${count} ${count > 1 ? 'veces' : 'vez'}</span>`; directorDetailsList.appendChild(listItem); 
    });
    currentDirectorDetailsPage++;
    loadMoreDirectorDetailsBtn.classList.toggle('hidden', currentDirectorDetailsPage * detailsPerPage >= currentFilteredDirectorSongs.length);
}

function createChartClickHandler(filterInput, otherFilterInput) {
    return function(evt, elements) {
        if (!elements || elements.length === 0) return;
        const chartInstance = this;
        const itemName = chartInstance.data.labels[elements[0].index];
        filterInput.value = filterInput.value === itemName ? '' : itemName;
        if (filterInput.value) otherFilterInput.value = '';
        setTimeout(() => fetchAndRenderReports(), 0);
    }
}

function handleLegendClick(event, legendItem) {
    const itemName = legendItem.text;
    reporteElements.filterDirector.value = (reporteElements.filterDirector.value === itemName) ? '' : itemName;
    if (reporteElements.filterDirector.value) reporteElements.filterSong.value = '';
    setTimeout(() => fetchAndRenderReports(), 0);
}

export function initializePage() {
    if (!state.user) { 
        showPage('login-page'); 
        return; 
    }
    fetchAndRenderReports();
}

export function initializePageListeners() {
    reporteElements.applyBtn.addEventListener('click', fetchAndRenderReports);
    reporteElements.clearBtn.addEventListener('click', () => {
        reporteElements.filterDateStart.value = '';
        reporteElements.filterDateEnd.value = '';
        reporteElements.filterDirector.value = '';
        reporteElements.filterSong.value = '';
        reporteElements.filterArtist.value = '';
        fetchAndRenderReports();
    });
    
    setupFilterToggle(reporteElements.toggleFiltersBtn, reporteElements.filtersSection);

    reporteElements.loadMoreSongDetailsBtn.addEventListener('click', () => {
        const songNameMatch = reporteElements.songDetailsTitle.textContent.match(/"([^"]+)"/);
        if (songNameMatch) renderSongDetails(songNameMatch[1], currentFilteredSongDetails, true);
    });
    
    reporteElements.loadMoreDirectorDetailsBtn.addEventListener('click', () => {
        const directorNameMatch = reporteElements.directorDetailsTitle.textContent.match(/"([^"]+)"/);
        if (directorNameMatch) renderDirectorDetails(directorNameMatch[1], currentFilteredDirectorSongs, true);
    });

    setupAutocomplete(reporteElements.filterDirector, async (searchTerm) => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return state.allPeople.map(p => p.nombre_persona).filter(name => name.toLowerCase().includes(lowerCaseSearchTerm));
    });
    
    // CAMBIO: Actualizar el autocompletado de canciones en reportes
    setupAutocomplete(reporteElements.filterSong, searchSongsWithArtist, (selectedSong) => {
        // Al seleccionar, rellenar el campo de canción y también el de artista para un filtrado preciso
        reporteElements.filterSong.value = selectedSong.song_name;
        reporteElements.filterArtist.value = selectedSong.artist_name;
    });
    
    setupAutocomplete(reporteElements.filterArtist, searchArtists);

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (reporteElements.pageElement && !reporteElements.pageElement.classList.contains('hidden')) {
                if (songsChartInstance) songsChartInstance.resize();
                if (directorsChartInstance) directorsChartInstance.resize();
            }
        }, 250);
    });
}