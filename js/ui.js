// ==========================================================================
// MÓDULO DE INTERFAZ DE USUARIO: ui.js
// RESPONSABILIDAD: Manejar la visualización de páginas, modales, mensajes y helpers de UI.
// ==========================================================================

import { dom, state } from './main.js'; // Importamos dom y state para acceder al estado global y elementos
// Importar las funciones initializePage de cada módulo
import { initializePage as initializeReportPage } from './page-reports.js';
import { initializePage as initializeHistoryPage } from './page-history.js';
import { initializePage as initializeFormPage } from './page-form.js';


// --- Estado local para el modal de confirmación ---
let confirmCallback = null;
let cancelCallback = null;
let confirmModalListenersAssigned = false;
let infoModalListenersAssigned = false; // Bandera para los listeners del modal de información genérico

// --- Referencias a los elementos del modal de confirmación (pueden ser null si la página no los tiene) ---
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalOkBtn = document.getElementById('confirm-modal-ok-btn');
const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');
const confirmModalCloseBtn = document.querySelector('#confirm-modal .modal-close-btn');

// --- Referencias a los elementos del modal de información genérico ---
const infoModal = document.getElementById('info-modal');
const infoModalIcon = document.getElementById('info-modal-icon');
const infoModalTitle = document.getElementById('info-modal-title');
const infoModalMessage = document.getElementById('info-modal-message');
const infoModalOkBtn = document.getElementById('info-modal-ok-btn');
const infoModalCloseBtn = document.querySelector('#info-modal .modal-close-btn');


export function showPage(pageToShowId) {
    // Primero, verifica si el usuario está autenticado para mostrar páginas del dashboard
    if (pageToShowId !== 'login-page' && !state.user) {
        console.log(`Protección: Usuario no autenticado. Redirigiendo a login.`);
        showPage('login-page'); // Redirige al login si no está autenticado
        return; // No continúes mostrando la página solicitada
    }

    // Si la página es 'login-page', la mostramos si el usuario NO está autenticado
    if (pageToShowId === 'login-page' && state.user) {
        // Si el usuario ya está logueado y intenta ir a la página de login,
        // lo redirigimos a la página principal (ej. reportes).
        showPage('page-reporte'); 
        return;
    }

    // Oculta todas las páginas de contenido del dashboard
    Object.values(dom.pageElements).forEach(page => page.classList.add('hidden'));

    // Muestra la página solicitada (si existe)
    if (dom.pageElements[pageToShowId]) {
        dom.pageElements[pageToShowId].classList.remove('hidden');
    }
    
    // Actualiza las clases de los botones de navegación
    Object.entries(dom.navButtons).forEach(([btnId, btn]) => {
        // Compara el ID del botón con el ID de la página que se está mostrando
        btn.classList.toggle('active', `nav-${pageToShowId.split('-')[1]}` === btnId);
    });
    
    // ¡CRUCIAL! Llama a la función initializePage para la página seleccionada
    // Esto asegura que cada página cargue sus datos y se configure cuando se navega a ella.
    // Se llama DESPUÉS de asegurarse que el usuario está autenticado y la página está visible.
    if (pageToShowId === 'page-reporte') {
        initializeReportPage();
    } else if (pageToShowId === 'page-historial') {
        initializeHistoryPage();
    } else if (pageToShowId === 'page-formulario') {
        initializeFormPage();
    }
}

/**
 * Muestra un mensaje temporal al usuario.
 * @param {HTMLElement} element - Elemento donde se mostrará el mensaje.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - Tipo de mensaje ('success' o 'error').
 */
export function showMessage(element, message, type = 'error') {
    element.textContent = message;
    element.style.display = 'block';
    element.style.backgroundColor = type === 'success' ? 'var(--color-success)' : 'var(--color-danger)';
    element.style.color = 'white';
    setTimeout(() => { element.style.display = 'none'; }, 4000);
}

/**
 * Cierra un modal específico.
 * @param {string} modalId - El ID del modal a cerrar (ej. 'success-modal' o 'confirm-modal' o 'info-modal').
 */
export function closeModal(modalId = 'success-modal') { 
    const modalOverlay = document.getElementById(modalId);
    if (modalOverlay) {
        modalOverlay.classList.add('hidden');
    }
}

/**
 * Muestra un modal de confirmación personalizado.
 * @param {string} title - Título del modal de confirmación.
 * @param {string} message - Mensaje del modal de confirmación.
 * @param {Function} onConfirm - Función a ejecutar si el usuario confirma.
 * @param {Function} [onCancel] - Función opcional a ejecutar si el usuario cancela.
 */
export function showConfirmModal(title, message, onConfirm, onCancel = null) {
    if (!confirmModal || !confirmModalTitle || !confirmModalMessage || !confirmModalOkBtn || !confirmModalCancelBtn) {
        console.error("Confirm modal elements not found. Fallback to native confirm.");
        if (window.confirm(title + "\n" + message)) {
            onConfirm();
        } else if (onCancel) {
            onCancel();
        }
        return;
    }

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
    if (confirmCallback) {
        confirmCallback();
    }
    resetConfirmCallbacks();
}

function handleConfirmCancel() {
    closeModal('confirm-modal');
    if (cancelCallback) {
        cancelCallback();
    }
    resetConfirmCallbacks();
}

function resetConfirmCallbacks() {
    confirmCallback = null;
    cancelCallback = null;
}

/**
 * Muestra un modal de información/éxito/error genérico.
 * @param {string} title - Título del modal.
 * @param {string} message - Mensaje del modal.
 * @param {string} type - Tipo de mensaje ('success', 'error', 'info').
 * @param {Function} [onClose] - Función opcional a ejecutar al cerrar el modal.
 */
export function showInfoModal(title, message, type = 'info', onClose = null) {
    // Verificar que los elementos del modal existan
    if (!infoModal || !infoModalTitle || !infoModalMessage || !infoModalIcon || !infoModalOkBtn) {
        console.error("Info modal elements not found. Fallback to native alert.");
        window.alert(title + "\n" + message);
        if (onClose) onClose();
        return;
    }

    infoModalTitle.textContent = title;
    infoModalMessage.textContent = message;
    infoModalIcon.className = `modal-icon ${type}`; // Añadir clase de tipo para el color del icono

    // Establecer el icono según el tipo
    switch (type) {
        case 'success':
            infoModalIcon.textContent = '✅';
            break;
        case 'error':
            infoModalIcon.textContent = '❌';
            break;
        case 'info':
            infoModalIcon.textContent = 'ℹ️';
            break;
        default:
            infoModalIcon.textContent = '💬'; // Icono por defecto
    }
    
    infoModal.classList.remove('hidden');

    // Asignar listeners solo una vez al inicio, pero con cuidado al manejar `onClose`
    if (!infoModalListenersAssigned) {
        // Clonar para eliminar todos los listeners existentes y añadir uno nuevo limpio
        const currentOkBtn = document.getElementById('info-modal-ok-btn');
        const newOkBtn = currentOkBtn.cloneNode(true); 
        currentOkBtn.parentNode.replaceChild(newOkBtn, currentOkBtn);
        newOkBtn.addEventListener('click', () => { 
            closeModal('info-modal');
            if (infoModal.currentOnClose) infoModal.currentOnClose(); 
        });

        const currentCloseBtn = document.querySelector('#info-modal .modal-close-btn'); 
        const newCloseBtn = currentCloseBtn.cloneNode(true);
        currentCloseBtn.parentNode.replaceChild(newCloseBtn, currentCloseBtn);
        newCloseBtn.addEventListener('click', () => {
            closeModal('info-modal');
            if (infoModal.currentOnClose) infoModal.currentOnClose();
        });
        infoModalListenersAssigned = true;
    } else {
        // Si ya están asignados, solo actualizamos el callback.
        infoModal.currentOnClose = onClose;
    }
}


// Añadido 'export' a las funciones formatDate y getDayOfWeek
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

export function setupAutocomplete(inputElement, getDataListFn, onSelectCallback) {
    let currentFocus;
    let timeoutId;
    const closeAllLists = (elmnt) => {
        document.querySelectorAll('.autocomplete-suggestions').forEach(list => {
            if (elmnt !== list && elmnt !== inputElement && list && list.parentNode) { 
                list.parentNode.removeChild(list);
            }
        });
    };
    inputElement.addEventListener("input", function() {
        clearTimeout(timeoutId);
        const val = this.value;
        timeoutId = setTimeout(async () => {
            closeAllLists();
            if (!val || val.length < 2) return false;
            currentFocus = -1;
            const suggestionsContainer = document.createElement("div");
            suggestionsContainer.setAttribute("class", "autocomplete-suggestions");
            this.parentNode.appendChild(suggestionsContainer); 
            try {
                const dataList = await getDataListFn(val);
                suggestionsContainer.innerHTML = '';
                dataList.forEach(item => {
                    const suggestionItem = document.createElement("div");
                    suggestionItem.setAttribute('class', 'autocomplete-item');
                    const displayName = (typeof item === 'object' && item.display_name) ? item.display_name : item;
                    const regex = new RegExp(val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "gi");
                    suggestionItem.innerHTML = displayName.replace(regex, "<strong>$&</strong>");
                    suggestionItem.addEventListener("click", function() {
                        if (onSelectCallback) { onSelectCallback(item); }
                        else { inputElement.value = displayName; }
                        closeAllLists();
                    });
                    suggestionsContainer.appendChild(suggestionItem);
                });
            } catch (error) { console.error("Error en autocompletado:", error); closeAllLists(); }
        }, 150);
    });
    inputElement.addEventListener("keydown", function(e) {
        let x = this.parentNode.querySelector(".autocomplete-suggestions");
        if (x) x = x.getElementsByTagName("div");
        if (e.keyCode == 40) { currentFocus++; addActive(x); }
        else if (e.keyCode == 38) { currentFocus--; addActive(x); }
        else if (e.keyCode == 13) { e.preventDefault(); if (currentFocus > -1) { if (x) x[currentFocus].click(); } }
    });
    function addActive(x) { if (!x || x.length === 0) return false; removeActive(x); if (currentFocus >= x.length) currentFocus = 0; if (currentFocus < 0) currentFocus = x.length - 1; x[currentFocus].classList.add("active"); }
    function removeActive(x) { for (let i = 0; i < x.length; i++) { x[i].classList.remove("active"); } }
    document.addEventListener("click", (e) => closeAllLists(e.target));
}

// Función para el botón de alternar filtros
export function setupFilterToggle(toggleBtn, section) {
    if (toggleBtn && section) {
        toggleBtn.addEventListener('click', () => {
            section.classList.toggle('hidden');
            const isHidden = section.classList.contains('hidden');
            toggleBtn.classList.toggle('active-filter-toggle', !isHidden);
            
            if (!isHidden) {
                toggleBtn.innerHTML = '⬆️ Ocultar Filtros';
            } else {
                toggleBtn.innerHTML = '🔍 Buscar';
            }
        });
        
        const isSectionHiddenInitially = section.classList.contains('hidden');
        toggleBtn.classList.toggle('active-filter-toggle', !isSectionHiddenInitially); 

        if (!isSectionHiddenInitially) {
            toggleBtn.innerHTML = '⬆️ Ocultar Filtros';
        } else {
            toggleBtn.innerHTML = '🔍 Buscar';
        }
    }
}