// ==========================================================================
// MÓDULO PRINCIPAL: main.js
// RESPONSABILIDAD: Punto de entrada, orquestación, estado global, DOM y gestión de la UI de autenticación.
// ==========================================================================

// --- Imports ---
import { handleLogin, handleLogout } from './auth.js'; 
import { showPage } from './ui.js';
import { initializePageListeners as initializeReportListeners } from './page-reports.js';
import { initializePageListeners as initializeHistoryListeners } from './page-history.js';
import { initializePageListeners as initializeFormListeners } from './page-form.js';
// Importamos la función para cargar datos iniciales desde 'api.js'
import { fetchAllPeople, fetchAllInstruments, fetchAllArtists } from './api.js';

// --- Estado Global de la Aplicación ---
export const state = {
    allPeople: [],
    allInstruments: [],
    allArtists: [],
    currentEditingId: null,
    historialPage: 0,
    historialResultsPerPage: 10,
    isLoadingHistorial: false,
    hasMoreHistorial: true,
    user: null // Almacena la información del usuario actual
};

// --- Cliente Supabase ---
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Referencias a Elementos del DOM ---
export const dom = {
    loginPage: document.getElementById('login-page'),
    emailInput: document.getElementById('email'),
    passwordInput: document.getElementById('password'),
    loginBtn: document.getElementById('login-btn'),
    loginErrorMessage: document.getElementById('login-error-message'),

    mainAppContainer: document.querySelector('.main-app-container'),
    logoutBtn: document.getElementById('logout-btn'),

    pageElements: {
        'page-reporte': document.getElementById('page-reporte'),
        'page-historial': document.getElementById('page-historial'),
        'page-formulario': document.getElementById('page-formulario'),
    },

    navButtons: {
        'nav-reporte': document.getElementById('nav-reporte'),
        'nav-historial': document.getElementById('nav-historial'),
        'nav-formulario': document.getElementById('nav-formulario'),
    },
};

// --- Función para cargar los datos iniciales necesarios para la app ---
async function loadInitialData() {
    try {
        const [people, instruments, artists] = await Promise.all([
            fetchAllPeople(),
            fetchAllInstruments(),
            fetchAllArtists()
        ]);

        state.allPeople = people;
        state.allInstruments = instruments;
        state.allArtists = artists;
        console.log("Datos iniciales cargados (Personas, Instrumentos, Artistas).");
    } catch (error) {
        console.error("Error al cargar los datos iniciales:", error);
        alert("No se pudieron cargar los datos iniciales. Por favor, recarga la página.");
    }
}

// --- Lógica para Gestionar la UI según el Estado de Autenticación ---
async function manageUIForAuthState(user) {
    state.user = user; // Actualizamos el estado global

    if (user) {
        // Usuario está autenticado
        dom.loginPage.classList.add('hidden');      
        dom.mainAppContainer.classList.remove('hidden'); 
        dom.logoutBtn.classList.remove('hidden');  
        
        // **NUEVO:** Cargar los datos iniciales DESPUÉS de confirmar que hay un usuario
        await loadInitialData();
        
        // **NUEVO:** Mostrar la página inicial DESPUÉS de cargar los datos
        showPage('page-reporte');

    } else {
        // Usuario NO está autenticado
        dom.mainAppContainer.classList.add('hidden'); 
        dom.loginPage.classList.remove('hidden');      
        dom.logoutBtn.classList.add('hidden');          

        // Limpiar estado y campos
        state.user = null;
        state.allPeople = [];
        state.allInstruments = [];
        state.allArtists = [];
        dom.emailInput.value = '';
        dom.passwordInput.value = '';
        dom.loginErrorMessage.textContent = '';
        dom.loginErrorMessage.style.display = 'none';
    }
}

// --- Suscripción a Cambios de Estado de Supabase Auth ---
function setupAuthStateListener() {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log("AuthStateChange event:", event, "Session:", session);
        
        // Solo reaccionamos a los eventos de login y logout para evitar recargas innecesarias
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            manageUIForAuthState(session?.user || null);
        } else if (event === 'SIGNED_OUT') {
            manageUIForAuthState(null);
        }
    });
}


// --- Inicialización de Eventos ---
function initializeEventListeners() {
    dom.loginBtn.addEventListener('click', handleLogin);
    dom.logoutBtn.addEventListener('click', handleLogout);

    for (const navBtnId in dom.navButtons) {
        const button = dom.navButtons[navBtnId];
        const pageId = navBtnId.replace('nav-', 'page-');
        
        button.addEventListener('click', () => {
            showPage(pageId); 
        });
    }

    // Los listeners de página se inicializan aquí, pero se aseguran de que el estado esté listo
    initializeReportListeners();
    initializeHistoryListeners();
    initializeFormListeners();
}

// --- Punto de Entrada de la Aplicación ---
function main() {
    console.log("Aplicación iniciada. DOM listo.");
    initializeEventListeners();
    setupAuthStateListener(); 
}

document.addEventListener('DOMContentLoaded', main);