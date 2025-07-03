// ==========================================================================
// MÓDULO DE INTERFAZ DE USUARIO: ui.js
// RESPONSABILIDAD: Manejar la visualización de páginas, modales, mensajes y helpers de UI.
// ==========================================================================

import { dom, state } from './main.js';
import { initializePage as initializeReportPage } from './page-reports.js';
import { initializePage as initializeHistoryPage } from './page-history.js';
import { initializePage as initializeFormPage } from './page-form.js';

// ... (El resto del código hasta setupAutocomplete no cambia) ...

let confirmCallback = null;
let cancelCallback = null;
let confirmModalListenersAssigned = false;
let infoModalListenersAssigned = false;

const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalOkBtn = document.getElementById('confirm-modal-ok-btn');
const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');
const confirmModalCloseBtn = document.querySelector('#confirm-modal .modal-close-btn');
const infoModal = document.getElementById('info-modal');
const infoModalIcon = document.getElementById('info-modal-icon');
const infoModalTitle = document.getElementById('info-modal-title');
const infoModalMessage = document.getElementById('info-modal-message');

export function showPage(pageToShowId) {
    if (pageToShowId !== 'login-page' && !state.user) {
        showPage('login-page');
        return;
    }
    if (pageToShowId === 'login-page' && state.user) {
        showPage('page-reporte');
        return;
    }

    dom.mainAppContainer.className = 'main-app-container'; 
    if (state.user) {
        const pageName = pageToShowId.replace('page-', '');
        dom.mainAppContainer.classList.add(`active-${pageName}`);
    }

    Object.values(dom.pageElements).forEach(page => page.classList.add('hidden'));

    if (dom.pageElements[pageToShowId]) {
        dom.pageElements[pageToShowId].classList.remove('hidden');
    }
    
    Object.entries(dom.navButtons).forEach(([btnId, btn]) => {
        btn.classList.toggle('active', `nav-${pageToShowId.split('-')[1]}` === btnId);
    });
    
    if (pageToShowId === 'page-reporte') initializeReportPage();
    else if (pageToShowId === 'page-historial') initializeHistoryPage();
    else if (pageToShowId === 'page-formulario') initializeFormPage();
}

export function showMessage(element, message, type = 'error') {
    if (!element) return;
    element.textContent = message;
    
    if (message) {
        element.style.display = 'block';
        element.style.backgroundColor = type === 'success' ? 'var(--color-success)' : 'var(--color-danger)';
        element.style.color = 'white';
        setTimeout(() => { element.style.display = 'none'; }, 4000);
    } else {
        element.style.display = 'none';
        element.textContent = '';
        element.style.backgroundColor = '';
    }
}

export function closeModal(modalId) { 
    const modalOverlay = document.getElementById(modalId);
    if (modalOverlay) modalOverlay.classList.add('hidden');
}

export function showConfirmModal(title, message, onConfirm, onCancel = null) {
    if (!confirmModal) return;
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmCallback = onConfirm;
    cancelCallback = onCancel;
    confirmModal.classList.remove('hidden');

    if (!confirmModalListenersAssigned) {
        confirmModalOkBtn.addEventListener('click', handleConfirmOk);
        confirmModalCancelBtn.addEventListener('click', handleConfirmCancel);
        confirmModalCloseBtn.addEventListener('click', handleConfirmCancel); 
        confirmModalListenersAssigned = true;
    }
}

function handleConfirmOk() {
    closeModal('confirm-modal');
    if (confirmCallback) confirmCallback();
    resetConfirmCallbacks();
}

function handleConfirmCancel() {
    closeModal('confirm-modal');
    if (cancelCallback) cancelCallback();
    resetConfirmCallbacks();
}

function resetConfirmCallbacks() {
    confirmCallback = null;
    cancelCallback = null;
}

export function showInfoModal(title, message, type = 'info', onClose = null) {
    if (!infoModal) return;
    infoModalTitle.textContent = title;
    infoModalMessage.textContent = message;
    infoModalIcon.className = `modal-icon ${type}`;
    switch (type) {
        case 'success': infoModalIcon.textContent = '✅'; break;
        case 'error': infoModalIcon.textContent = '❌'; break;
        default: infoModalIcon.textContent = 'ℹ️'; break;
    }
    infoModal.classList.remove('hidden');

    if (!infoModalListenersAssigned) {
        document.getElementById('info-modal-ok-btn')?.addEventListener('click', () => {
            closeModal('info-modal');
            if (infoModal.currentOnClose) infoModal.currentOnClose();
        });
        document.querySelector('#info-modal .modal-close-btn')?.addEventListener('click', () => {
            closeModal('info-modal');
            if (infoModal.currentOnClose) infoModal.currentOnClose();
        });
        infoModalListenersAssigned = true;
    }
    infoModal.currentOnClose = onClose;
}

export function formatDate(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
}

export function getDayOfWeek(isoDate) {
    if (!isoDate) return '';
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const date = new Date(`${isoDate}T00:00:00`);
    return days[date.getDay()];
}

export function normalizeString(str) {
    return str ? str.trim().toLowerCase() : '';
}

export function renderChart(instance, canvas, options) {
    if (instance) instance.destroy();
    return new Chart(canvas.getContext('2d'), options);
}

// CAMBIO: La función de autocompletado ahora es más flexible
export function setupAutocomplete(inputElement, getDataListFn, onSelectCallback = null) {
    let currentFocus;
    const closeAllLists = (elmnt) => {
        document.querySelectorAll('.autocomplete-suggestions').forEach(list => {
            if (elmnt !== list && elmnt !== inputElement && list && list.parentNode) { 
                list.parentNode.removeChild(list);
            }
        });
    };
    inputElement.addEventListener("input", async function() {
        let suggestionsContainer = this.parentNode.querySelector('.autocomplete-suggestions');
        if (suggestionsContainer) suggestionsContainer.remove();
        
        const val = this.value;
        if (!val || val.length < 2) return false;

        currentFocus = -1;
        suggestionsContainer = document.createElement("div");
        suggestionsContainer.setAttribute("class", "autocomplete-suggestions");
        this.parentNode.appendChild(suggestionsContainer);

        try {
            const dataList = await getDataListFn(val);
            suggestionsContainer.innerHTML = '';
            dataList.forEach(item => {
                const suggestionItem = document.createElement("div");
                suggestionItem.setAttribute('class', 'autocomplete-item');
                
                // Si el item es un objeto, busca 'display_name', si no, usa el item mismo (string)
                const displayName = (typeof item === 'object' && item.display_name) ? item.display_name : item;
                const regex = new RegExp(val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "gi");
                suggestionItem.innerHTML = displayName.replace(regex, "<strong>$&</strong>");
                
                suggestionItem.addEventListener("click", function() {
                    if (onSelectCallback) {
                        // Si hay un callback, le pasamos el objeto completo
                        onSelectCallback(item); 
                    } else {
                        // Comportamiento por defecto: rellenar el input
                        inputElement.value = displayName;
                    }
                    closeAllLists();
                });
                suggestionsContainer.appendChild(suggestionItem);
            });
        } catch (error) { console.error("Error en autocompletado:", error); closeAllLists(); }
    });

    inputElement.addEventListener("keydown", function(e) {
        let x = this.parentNode.querySelector(".autocomplete-suggestions");
        if (x) x = x.getElementsByTagName("div");
        if (!x) return;
        if (e.keyCode == 40) { currentFocus++; addActive(x); }
        else if (e.keyCode == 38) { currentFocus--; addActive(x); }
        else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) x[currentFocus].click(); }
    });

    function addActive(x) {
        if (!x || x.length === 0) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add("active");
    }
    function removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("active");
        }
    }
    document.addEventListener("click", (e) => closeAllLists(e.target));
}

export function setupFilterToggle(toggleBtn, section) {
    if (!toggleBtn || !section) return;
    toggleBtn.addEventListener('click', () => {
        const isHidden = section.classList.toggle('hidden');
        toggleBtn.classList.toggle('active-filter-toggle', !isHidden);
        toggleBtn.innerHTML = isHidden ? '🔍 Buscar' : '⬆️ Ocultar Búsqueda';
    });

    if (section.classList.contains('hidden')) {
        toggleBtn.innerHTML = '🔍 Buscar';
    } else {
        toggleBtn.innerHTML = '⬆️ Ocultar Búsqueda';
        toggleBtn.classList.add('active-filter-toggle');
    }
}