// ==========================================================================
// MÓDULO PRINCIPAL: main.js (Versión Robusta y Final v2)
// ==========================================================================

// Importa los módulos de lógica
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
let supabaseClientInstance = null;
try {
    const supabaseUrl = window.SUPABASE_CONFIG?.URL || "https://xkxzloudrpcunqwutldk.supabase.co"; 
    const supabaseKey = window.SUPABASE_CONFIG?.ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhreHpsb3VkcnBjdW5xd3V0bGRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMDA2MTksImV4cCI6MjA2NjY3NjYxOX0.D7zw2RpXYYALBupty9CVHYTvC5MAYq__r6h0RIW9fBY";
    
    supabaseClientInstance = supabase.createClient(supabaseUrl, supabaseKey);
    console.log("Cliente de Supabase inicializado correctamente.");
} catch(e) {
    console.error("Error al inicializar Supabase:", e);
    document.body.innerHTML = '<h1>Error de Configuración de Supabase</h1>';
}
export const supabaseClient = supabaseClientInstance;


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