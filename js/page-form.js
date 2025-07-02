// ==========================================================================
// MÓDULO DE PÁGINA: Formulario
// ==========================================================================

import { state } from './main.js';
import { saveFullService, fetchFullServiceDetails, searchSongs, searchArtists } from './api.js';
import { showMessage, setupAutocomplete, showPage, closeModal } from './ui.js';

const formElements = {
    pageElement: document.getElementById('page-formulario'),
    dateInput: document.getElementById('fecha'),
    dynamicFields: document.getElementById('dynamic-fields'),
    directorInput: document.getElementById('director-input'),
    songsList: document.getElementById('songsList'),
    addSongBtn: document.getElementById('add-song-btn'),
    toggleMusiciansBtn: document.getElementById('toggle-musicians-btn'),
    musiciansSection: document.getElementById('musicians-section'),
    musiciansList: document.getElementById('musiciansList'),
    addMusicianBtn: document.getElementById('add-musician-btn'),
    cancelBtn: document.getElementById('cancel-btn'),
    saveBtn: document.getElementById('save-btn'),
    formMessage: document.getElementById('form-message'),
    modalCloseBtn: document.querySelector('#success-modal .modal-close-btn'),
    modalActionNewBtn: document.getElementById('modal-action-new'),
    modalActionHistorialBtn: document.getElementById('modal-action-historial'),
    modalActionReporteBtn: document.getElementById('modal-action-reporte'),
};

const instrumentIconMap = {
    'default': '🎶', 'Director': '🎤', 'Bateria': '🥁', 'Bajo': '🎸', 
    'Piano': '🎹', 'Guitarra Acustica': '🎸', 'Guitarra Electrica': '🎸', 'Corista': '🗣️'
};

let formActionListenersAssigned = false;
let modalListenersAssigned = false;

function addSong(song = { name: '', artist: '' }) {
    const songItem = document.createElement('div');
    songItem.className = 'song-item';
    
    songItem.innerHTML = `
        <div class="song-details-inputs">
            <div class="input-autocomplete-wrapper">
                <input type="text" class="song-input" placeholder="Nombre de la canción" value="${song.name || ''}">
            </div>
            <div class="input-autocomplete-wrapper">
                <input type="text" class="artist-input" placeholder="Artista" value="${song.artist || ''}">
            </div>
        </div>
        <button type="button" class="btn btn-danger remove-song-btn"><span class="icon">×</span></button>
    `;
    
    formElements.songsList.appendChild(songItem);
    
    const songInput = songItem.querySelector('.song-input');
    const artistInput = songItem.querySelector('.artist-input');

    setupAutocomplete(songInput, searchSongs);
    setupAutocomplete(artistInput, searchArtists);
    
    if (!song.name && !song.artist) {
        songInput.focus();
    }
};

function addMusicianCard(instrumentoId = '', personaId = '') {
    const card = document.createElement('div');
    card.className = 'musician-card';
    const instrumentOptions = state.allInstruments.map(i => `<option value="${i.id}" ${i.id == instrumentoId ? 'selected' : ''}>${i.nombre_instrumento}</option>`).join('');
    const peopleOptions = state.allPeople.map(p => `<option value="${p.id}" ${p.id == personaId ? 'selected' : ''}>${p.nombre_persona}</option>`).join('');
    
    card.innerHTML = `
        <div class="musician-card-header">
            <h4><span class="instrument-icon"></span><span class="instrument-name"></span></h4>
            <button type="button" class="btn btn-danger remove-musician-btn">×</button>
        </div>
        <div class="form-group"><label>Instrumento / Voz</label><select class="instrument-select"><option value="">-- Seleccionar --</option>${instrumentOptions}</select></div>
        <div class="form-group"><label>Persona</label><select class="person-select"><option value="">-- Seleccionar --</option>${peopleOptions}</select></div>
    `;
    
    const instrumentSelect = card.querySelector('.instrument-select');
    const updateCardHeader = () => {
        const selectedOption = instrumentSelect.options[instrumentSelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            const instrumentName = selectedOption.text;
            card.querySelector('.instrument-icon').textContent = instrumentIconMap[instrumentName] || instrumentIconMap.default;
            card.querySelector('.instrument-name').textContent = instrumentName;
        } else {
            card.querySelector('.instrument-icon').textContent = instrumentIconMap.default;
            card.querySelector('.instrument-name').textContent = "Nuevo Músico";
        }
    };
    instrumentSelect.addEventListener('change', updateCardHeader);
    card.querySelector('.remove-musician-btn').addEventListener('click', () => card.remove());
    formElements.musiciansList.appendChild(card);
    updateCardHeader();
};

async function handleSave() {
    const date = formElements.dateInput.value;
    const directorName = formElements.directorInput.value.trim();
    
    const songsData = [...formElements.songsList.querySelectorAll('.song-item')].map(item => ({ name: item.querySelector('.song-input').value.trim(), artist: item.querySelector('.artist-input').value.trim() })).filter(song => song.name);
    const musiciansData = [...formElements.musiciansList.querySelectorAll('.musician-card')].map(card => ({ instrumento_id: card.querySelector('.instrument-select').value, persona_id: card.querySelector('.person-select').value })).filter(m => m.instrumento_id && m.persona_id);

    if (!date || !directorName || songsData.length === 0) {
        showMessage(formElements.formMessage, 'Error: Fecha, director y al menos una canción son obligatorios.', 'error');
        return;
    }
    
    formElements.saveBtn.disabled = true;
    formElements.saveBtn.innerHTML = 'Guardando...';
    
    try {
        await saveFullService({ p_fecha: date, p_director_name: directorName, p_songs_data: songsData, p_musicians_list: musiciansData });
        cancelForm(); 
        document.getElementById('success-modal').classList.remove('hidden'); 
    } catch (error) {
        showMessage(formElements.formMessage, `Error al guardar: ${error.message}`, 'error');
    } finally {
        formElements.saveBtn.disabled = false;
        formElements.saveBtn.innerHTML = '💾<span class="btn-text"> Guardar Servicio</span>';
    }
}

async function handleDateChange(e) {
    const selectedDate = e.target.value;
    if (!selectedDate) {
        formElements.dynamicFields.classList.add('hidden');
        resetForm();
        return;
    }
    
    formElements.dynamicFields.classList.remove('hidden');
    formElements.formMessage.textContent = 'Cargando datos del servicio...';
    formElements.formMessage.style.display = 'block';
    formElements.formMessage.style.backgroundColor = 'var(--color-info)';

    try {
        const data = await fetchFullServiceDetails({ _start_date: selectedDate, _end_date: selectedDate });
        const serviceData = data && data.length > 0 ? data[0] : null;

        if (serviceData) {
            state.currentEditingId = serviceData.id;
            formElements.directorInput.value = serviceData.director || '';
            formElements.songsList.innerHTML = '';
            (serviceData.canciones || []).forEach(songString => {
                const match = songString.match(/(.*) \((.*)\)/); 
                if (match && match[1] && match[2]) { addSong({ name: match[1].trim(), artist: match[2].trim() }); } 
                else { addSong({ name: songString }); }
            });
            formElements.musiciansList.innerHTML = '';
            if (serviceData.banda && serviceData.banda.length > 0) {
                formElements.musiciansSection.classList.remove('hidden');
                formElements.toggleMusiciansBtn.textContent = '➖ Ocultar Sección';
                serviceData.banda.forEach(musico => addMusicianCard(musico.instrumento_id, musico.persona_id));
            } else {
                formElements.musiciansSection.classList.add('hidden');
                formElements.toggleMusiciansBtn.textContent = '✨ Añadir Músicos y Coristas';
            }
        } else {
            resetForm();
        }
        formElements.formMessage.style.display = 'none';
    } catch (error) {
        console.error("Error al verificar servicio:", error);
        showMessage(formElements.formMessage, "Error al cargar datos del servicio.", 'error');
        resetForm();
    }
}

function resetForm() {
    state.currentEditingId = null;
    formElements.directorInput.value = '';
    formElements.songsList.innerHTML = '';
    addSong();
    formElements.musiciansList.innerHTML = '';
    formElements.musiciansSection.classList.add('hidden'); 
    formElements.toggleMusiciansBtn.textContent = '✨ Añadir Músicos y Coristas';
    formElements.formMessage.style.display = 'none';
}

function cancelForm() {
    formElements.dateInput.value = '';
    formElements.dynamicFields.classList.add('hidden');
    resetForm();
}

export function initializePage() {
    if (!state.user) {
        showPage('login-page');
        return;
    }
    formElements.dateInput.value = '';
    formElements.dynamicFields.classList.add('hidden'); 
    resetForm();
}

export function initializePageListeners() {
    // **CORRECCIÓN:** Se elimina la guarda if(!state.user) para que los listeners SIEMPRE se asignen.
    formElements.addSongBtn.addEventListener('click', () => addSong());
    
    if (!formActionListenersAssigned) {
        formElements.cancelBtn.addEventListener('click', cancelForm);
        formElements.saveBtn.addEventListener('click', handleSave);
        formActionListenersAssigned = true; 
    }
    
    formElements.dateInput.addEventListener('change', handleDateChange);
    formElements.dateInput.addEventListener('input', handleDateChange);

    formElements.songsList.addEventListener('click', (event) => {
        const removeBtn = event.target.closest('.remove-song-btn');
        if (removeBtn) {
            if (formElements.songsList.children.length > 1) {
                removeBtn.closest('.song-item').remove();
            } else {
                removeBtn.closest('.song-item').querySelector('.song-input').value = '';
                removeBtn.closest('.song-item').querySelector('.artist-input').value = '';
            }
        }
    });

    formElements.toggleMusiciansBtn.addEventListener('click', () => {
        const isHidden = formElements.musiciansSection.classList.toggle('hidden');
        formElements.toggleMusiciansBtn.textContent = isHidden ? '✨ Añadir Músicos y Coristas' : '➖ Ocultar Sección';
        if (!isHidden && formElements.musiciansList.children.length === 0) {
            addMusicianCard();
        }
    });

    formElements.addMusicianBtn.addEventListener('click', () => addMusicianCard());
    
    setupAutocomplete(formElements.directorInput, async (searchTerm) => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return state.allPeople.map(p => p.nombre_persona).filter(name => name.toLowerCase().includes(lowerCaseSearchTerm));
    });

    if (!modalListenersAssigned) {
        if (formElements.modalCloseBtn) formElements.modalCloseBtn.addEventListener('click', () => closeModal('success-modal'));
        if (formElements.modalActionNewBtn) formElements.modalActionNewBtn.addEventListener('click', () => { closeModal('success-modal'); cancelForm(); });
        if (formElements.modalActionHistorialBtn) formElements.modalActionHistorialBtn.addEventListener('click', () => { closeModal('success-modal'); showPage('page-historial'); });
        if (formElements.modalActionReporteBtn) formElements.modalActionReporteBtn.addEventListener('click', () => { closeModal('success-modal'); showPage('page-reporte'); });
        modalListenersAssigned = true;
    }
}