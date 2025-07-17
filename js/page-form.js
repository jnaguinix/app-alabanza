// ==========================================================================
// MÓDULO DE PÁGINA: Formulario (con Autocompletado Inteligente)
// ==========================================================================

import { state } from './main.js';
// CAMBIO: Importar la nueva función y eliminar la antigua
import { saveFullService, fetchFullServiceDetails, searchSongsWithArtist, searchArtists, deleteService } from './api.js'; 
import { showMessage, setupAutocomplete, showPage, closeModal, showConfirmModal, showInfoModal } from './ui.js';

// ... (El resto del código hasta la función addSong no cambia) ...

const domElements = {
    dateInput: document.getElementById('fecha'),
    formWizard: document.getElementById('form-wizard'),
    formMessage: document.getElementById('form-message'),
    stepIndicator: document.getElementById('step-indicator'),
    formSteps: document.querySelectorAll('.form-step'),
    directorInput: document.getElementById('director-input'),
    songsList: document.getElementById('songsList'),
    addSongBtn: document.getElementById('add-song-btn'),
    musiciansList: document.getElementById('musiciansList'),
    addMusicianBtn: document.getElementById('add-musician-btn'),
    summarySection: document.getElementById('summary-section'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    saveBtn: document.getElementById('save-btn'),
    deleteServiceFormBtn: document.getElementById('delete-service-form-btn'), // <-- NUEVA LÍNEA
    successModal: document.getElementById('success-modal'),
    modalCloseBtn: document.querySelector('#success-modal .modal-close-btn'),
    modalActionNewBtn: document.getElementById('modal-action-new'),
    modalActionHistorialBtn: document.getElementById('modal-action-historial'),
    modalActionReporteBtn: document.getElementById('modal-action-reporte'),
};

const TOTAL_STEPS = 3;
let currentStep = 1;

const formData = {
    date: null, directorName: '', songs: [], musicians: []
};

function showStep(stepNumber) {
    if (!document.getElementById(`form-step-${stepNumber}`)) return;
    
    domElements.formSteps.forEach(step => step.classList.add('hidden'));
    document.getElementById(`form-step-${stepNumber}`).classList.remove('hidden');

    const indicators = domElements.stepIndicator.querySelectorAll('li');
    indicators.forEach((indicator, index) => {
        indicator.classList.remove('active', 'completed');
        if (index + 1 < stepNumber) {
            indicator.classList.add('completed');
        } else if (index + 1 === stepNumber) {
            indicator.classList.add('active');
        }
    });

    domElements.prevBtn.classList.toggle('hidden', stepNumber === 1);
    domElements.nextBtn.classList.toggle('hidden', stepNumber === TOTAL_STEPS);
    domElements.saveBtn.classList.toggle('hidden', stepNumber !== TOTAL_STEPS);
}

function handleNextStep() {
    if (validateCurrentStep()) {
        saveStepData();
        currentStep++;
        if (currentStep === TOTAL_STEPS) {
            renderSummary();
        }
        showStep(currentStep);
        showMessage(domElements.formMessage, '');
    }
}

function handlePrevStep() {
    if (currentStep > 1) {
        saveStepData();
        currentStep--;
        showStep(currentStep);
        showMessage(domElements.formMessage, '');
    }
}

function validateCurrentStep() {
    showMessage(domElements.formMessage, ''); 
    
    if (currentStep === 1) {
        if (!domElements.directorInput.value.trim()) {
            showMessage(domElements.formMessage, 'El nombre del director es obligatorio.', 'error');
            return false;
        }
        const songs = [...domElements.songsList.querySelectorAll('.song-input')].map(input => input.value.trim());
        if (songs.length === 0 || songs.every(s => !s)) {
            showMessage(domElements.formMessage, 'Debes añadir al menos una canción.', 'error');
            return false;
        }
    }
    return true;
}

function saveStepData() {
    switch (currentStep) {
        case 1:
            formData.directorName = domElements.directorInput.value.trim();
            formData.songs = [...domElements.songsList.querySelectorAll('.song-item')]
                .map(item => ({ name: item.querySelector('.song-input').value.trim(), artist: item.querySelector('.artist-input').value.trim() || 'Desconocido' }))
                .filter(song => song.name);
            break;
        case 2:
            formData.musicians = [...domElements.musiciansList.querySelectorAll('.musician-card')]
                .map(card => ({ instrumento_id: card.querySelector('.instrument-select').value, persona_id: card.querySelector('.person-select').value }))
                .filter(m => m.instrumento_id && m.persona_id);
            break;
    }
}

function renderSummary() {
    saveStepData(2);
    let songsHTML = '<h4>Canciones</h4><ul>' + (formData.songs.map(s => `<li>${s.name} (${s.artist})</li>`).join('') || '<li>No se añadieron canciones.</li>') + '</ul>';
    
    let musiciansHTML = '<h4>Músicos y Coristas</h4><ul>' + (formData.musicians.map(m => {
        const person = state.allPeople.find(p => p.id == m.persona_id);
        const instrument = state.allInstruments.find(i => i.id == m.instrumento_id) || { nombre_instrumento: 'Voz' };
        return `<li><strong>${instrument.nombre_instrumento}:</strong> ${person?.nombre_persona || 'N/A'}</li>`;
    }).join('') || '<li>No se añadieron músicos.</li>') + '</ul>';
    
    const displayDate = formData.date ? new Date(formData.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric'}) : 'N/A';
    domElements.summarySection.innerHTML = `<p><strong>Fecha:</strong> ${displayDate}</p><p><strong>Director:</strong> ${formData.directorName}</p>${songsHTML}${musiciansHTML}`;
}

async function handleSave() {
    domElements.saveBtn.disabled = true;
    domElements.saveBtn.textContent = 'Guardando...';

    try {
        await saveFullService({
            p_fecha: formData.date,
            p_director_name: formData.directorName,
            p_songs_data: formData.songs,
            p_musicians_list: formData.musicians
        });
        resetAndHideWizard(true);
        domElements.successModal.classList.remove('hidden');
        showMessage(domElements.formMessage, '');
    } catch (error) {
        showMessage(domElements.formMessage, `Error al guardar: ${error.message}`, 'error');
    } finally {
        domElements.saveBtn.disabled = false;
        domElements.saveBtn.innerHTML = '💾<span class="btn-text"> Guardar Servicio</span>';
    }
}

function resetFormForNewEntry(keepDate = false) {
    if (!keepDate) {
        domElements.dateInput.value = '';
    }
    domElements.formWizard.classList.add('hidden');
    domElements.directorInput.value = '';
    domElements.songsList.innerHTML = '';
    domElements.musiciansList.innerHTML = '';
    currentStep = 1;
    Object.assign(formData, { directorName: '', songs: [], musicians: [] });
    showMessage(domElements.formMessage, '');
}

function resetAndHideWizard(keepDate = false) {
    resetFormForNewEntry(keepDate);
    state.dateToEdit = null;
}

function populateFormWithData(serviceData) {
    resetFormForNewEntry(true);
    
    domElements.directorInput.value = serviceData.director || '';

    domElements.songsList.innerHTML = '';
    if (serviceData.canciones && serviceData.canciones.length > 0) {
        serviceData.canciones.forEach(songString => {
            const match = songString.match(/(.*) \((.*)\)/);
            if (match) {
                addSong({ name: match[1], artist: match[2] });
            } else {
                addSong({ name: songString, artist: 'Desconocido' });
            }
        });
    } else {
        addSong();
    }

    domElements.musiciansList.innerHTML = '';
    if (serviceData.banda && serviceData.banda.length > 0) {
        serviceData.banda.forEach(musico => {
            const instrument = state.allInstruments.find(i => i.nombre_instrumento === musico.instrumento_nombre);
            const person = state.allPeople.find(p => p.nombre_persona === musico.persona_nombre);
            addMusicianCard(instrument?.id, person?.id);
        });
    }
    
    domElements.formWizard.classList.remove('hidden');
    showStep(1);
    showMessage(domElements.formMessage, 'Editando servicio existente.', 'info');
}

async function handleDateChange(e) {
    const selectedDate = e.target.value;
    if (!selectedDate) {
        resetAndHideWizard();
        return;
    }
    
    formData.date = selectedDate;

    try {
        const [existingService] = await fetchFullServiceDetails({ _start_date: selectedDate, _end_date: selectedDate, _limit: 1 });
        
        if (existingService) {
            populateFormWithData(existingService);
        } else {
            resetFormForNewEntry(true);
            addSong();
            domElements.formWizard.classList.remove('hidden');
            showStep(1);
        }
    } catch (error) {
        showMessage(domElements.formMessage, 'Error al verificar el servicio.', 'error');
        resetAndHideWizard(true);
    }
}


// CAMBIO: La función addSong ahora usa el nuevo autocompletado inteligente
function addSong(song = { name: '', artist: '' }) {
    const songItem = document.createElement('div');
    songItem.className = 'song-item';
    songItem.innerHTML = `<div class="song-details-inputs"><div class="input-autocomplete-wrapper"><input type="text" class="song-input" placeholder="Nombre de la canción" value="${song.name || ''}"></div><div class="input-autocomplete-wrapper"><input type="text" class="artist-input" placeholder="Artista" value="${song.artist || ''}"></div></div><button type="button" class="btn btn-danger remove-song-btn"><span>×</span></button>`;
    domElements.songsList.appendChild(songItem);
    
    const songInput = songItem.querySelector('.song-input');
    const artistInput = songItem.querySelector('.artist-input');

    // Configura el autocompletado para el campo de la canción
    setupAutocomplete(songInput, searchSongsWithArtist, (selectedSong) => {
        // Al seleccionar, rellena ambos campos
        songInput.value = selectedSong.song_name;
        artistInput.value = selectedSong.artist_name;
    });
    
    // El autocompletado para el artista sigue funcionando de forma independiente
    setupAutocomplete(artistInput, searchArtists);
}

function addMusicianCard(instrumentoId = '', personaId = '') {
    const card = document.createElement('div');
    card.className = 'musician-card';
    const instrumentOptions = state.allInstruments.map(i => `<option value="${i.id}" ${i.id == instrumentoId ? 'selected' : ''}>${i.nombre_instrumento}</option>`).join('');
    const peopleOptions = state.allPeople.map(p => `<option value="${p.id}" ${p.id == personaId ? 'selected' : ''}>${p.nombre_persona}</option>`).join('');
    
    card.innerHTML = `
        <select class="instrument-select" required>
            <option value="" disabled ${!instrumentoId ? 'selected' : ''}>Instrumento / Voz</option>
            ${instrumentOptions}
        </select>
        <select class="person-select" required>
            <option value="" disabled ${!personaId ? 'selected' : ''}>Persona</option>
            ${peopleOptions}
        </select>
        <button type="button" class="remove-musician-btn">×</button>
    `;
    
    domElements.musiciansList.appendChild(card);
}

let modalListenersAssigned = false;
function initializeModalListeners() {
    if (modalListenersAssigned) return;
    domElements.modalCloseBtn?.addEventListener('click', () => closeModal('success-modal'));
    domElements.modalActionNewBtn?.addEventListener('click', () => { closeModal('success-modal'); initializePage(); });
    domElements.modalActionHistorialBtn?.addEventListener('click', () => { closeModal('success-modal'); showPage('page-historial'); });
    domElements.modalActionReporteBtn?.addEventListener('click', () => { closeModal('success-modal'); showPage('page-reporte'); });
    modalListenersAssigned = true;
}

export function initializePage() {
    if (!state.user) {
        showPage('login-page');
        return;
    }

    if (state.dateToEdit) {
        domElements.dateInput.value = state.dateToEdit;
        domElements.dateInput.dispatchEvent(new Event('change'));
        domElements.deleteServiceFormBtn.classList.remove('hidden'); // <-- Mostrar botón de eliminar
        state.dateToEdit = null;
    } else {
        domElements.dateInput.value = '';
        resetAndHideWizard();
        domElements.deleteServiceFormBtn.classList.add('hidden'); // <-- Ocultar botón de eliminar
    }
}

export function initializePageListeners() {
    domElements.dateInput.addEventListener('change', handleDateChange);
    
    domElements.nextBtn.addEventListener('click', handleNextStep);
    domElements.prevBtn.addEventListener('click', handlePrevStep);
    domElements.saveBtn.addEventListener('click', handleSave);

    // NUEVO: Manejador para el botón de eliminar servicio desde el formulario
    domElements.deleteServiceFormBtn.addEventListener('click', async () => {
        const serviceDate = domElements.dateInput.value;
        if (!serviceDate) {
            showMessage(domElements.formMessage, 'No hay servicio seleccionado para eliminar.', 'error');
            return;
        }

        // Obtener el ID del servicio para eliminarlo
        try {
            const [existingService] = await fetchFullServiceDetails({ _start_date: serviceDate, _end_date: serviceDate, _limit: 1 });
            if (!existingService || !existingService.id) {
                showMessage(domElements.formMessage, 'No se encontró el servicio para eliminar.', 'error');
                return;
            }
            const serviceIdToDelete = existingService.id;

            showConfirmModal('¿Eliminar Servicio?', '¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer.',
                async () => {
                    try {
                        await deleteService(serviceIdToDelete);
                        showInfoModal('¡Éxito!', 'Servicio eliminado correctamente.', 'success', () => {
                            resetAndHideWizard(); // Limpiar el formulario
                            showPage('page-historial'); // Redirigir al historial
                        });
                    } catch (error) {
                        showInfoModal('Error', 'Error al eliminar el servicio. Por favor, intenta de nuevo.', 'error');
                        console.error("Error al eliminar servicio desde formulario:", error);
                    }
                }
            );
        } catch (error) {
            showMessage(domElements.formMessage, 'Error al obtener detalles del servicio para eliminar.', 'error');
            console.error("Error al obtener ID de servicio para eliminar:", error);
        }
    });

    domElements.addSongBtn.addEventListener('click', () => addSong());
    domElements.songsList.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.remove-song-btn');
        if (removeBtn) {
            removeBtn.closest('.song-item').remove();
        }
    });

    domElements.addMusicianBtn.addEventListener('click', () => addMusicianCard());
    domElements.musiciansList.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.remove-musician-btn');
        if (removeBtn) {
            removeBtn.closest('.musician-card').remove();
        }
    });

    setupAutocomplete(domElements.directorInput, async (searchTerm) => 
        state.allPeople
            .map(p => p.nombre_persona)
            .filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    initializeModalListeners();
}