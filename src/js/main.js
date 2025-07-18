// ==========================================================================
// MÓDULO PRINCIPAL: main.js (Versión Robusta y Final v2)
// ==========================================================================

// Importaciones de CSS (manejadas por Vite)
import '../css/base.css';
import '../css/layout.css';
import '../css/forms.css';
import '../css/buttons.css';
import '../css/components.css';
import '../css/modals.css';
import '../css/login.css';
import '../css/pages/history.css';
import '../css/pages/reports.css';
import '../css/pages/form-wizard.css';
import '../css/utilities.css';
import '../css/responsive.css';

// Importaciones de JS
import { createClient } from '@supabase/supabase-js';
import { handleLogin, handleLogout } from './auth.js';
import { showPage } from './ui.js';
import { initializePageListeners as initializeReportListeners } from './page-reports.js';
import { initializePageListeners as initializeHistoryListeners } from './page-history.js';
import { initializePageListeners as initializeFormListeners } from './page-form.js';
import { fetchAllPeople, fetchAllInstruments, fetchAllArtists } from './api.js';

// --- Estado Global ---
export const state = {
    allPeople: [], allInstruments: [], allArtists: [],
    historialPage: 0, historialResultsPerPage: 10,
    isLoadingHistorial: false, hasMoreHistorial: true, user: null,
    isAppInitialized: false,
    dateToEdit: null // CAMBIO: Nueva propiedad para manejar la edición
};

// --- Referencias al DOM ---
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

// --- Cliente Supabase (Inicialización Robusta) ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseClient = createClient(supabaseUrl, supabaseKey);


// --- Lógica Principal de la Aplicación ---
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
    } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
    }
}

async function manageUIForAuthState(user) {
    state.user = user;
    if (user) {
        if (!state.isAppInitialized) {
            await loadInitialData();
            showPage('page-reporte');
            state.isAppInitialized = true;
        }
        dom.loginPage.classList.add('hidden');
        dom.mainAppContainer.classList.remove('hidden');
        dom.logoutBtn.classList.remove('hidden');
    } else {
        dom.mainAppContainer.classList.add('hidden');
        dom.loginPage.classList.remove('hidden');
        dom.logoutBtn.classList.add('hidden');
        state.isAppInitialized = false;
        state.user = null;
    }
}

function setupAuthStateListener() {
    if (!supabaseClient) return;
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        manageUIForAuthState(session?.user || null);
    });
}

function initializeEventListeners() {
    dom.loginBtn.addEventListener('click', handleLogin);
    dom.logoutBtn.addEventListener('click', handleLogout);
    
    for (const navBtnId in dom.navButtons) {
        dom.navButtons[navBtnId].addEventListener('click', () => {
            showPage(navBtnId.replace('nav-', 'page-'));
        });
    }

    initializeReportListeners();
    initializeHistoryListeners();
    initializeFormListeners();
}

// Punto de Entrada
document.addEventListener('DOMContentLoaded', () => {
    if (supabaseClient) {
        console.log("DOM Cargado. Inicializando aplicación.");
        initializeEventListeners();
        setupAuthStateListener();
    }
});