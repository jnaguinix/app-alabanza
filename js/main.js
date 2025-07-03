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

// --- Cliente Supabase (Lógica de Entorno) ---
let supabaseClient;

async function initializeSupabase() {
    let SUPABASE_URL, SUPABASE_ANON_KEY;

    // Esta lógica comprueba si estamos en un entorno de producción (como Netlify)
    // donde las variables se inyectan en `window`.
    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.URL) {
        // Estamos en producción, usamos las variables inyectadas
        console.log("Entorno de producción detectado. Usando variables inyectadas.");
        SUPABASE_URL = window.SUPABASE_CONFIG.URL;
        SUPABASE_ANON_KEY = window.SUPABASE_CONFIG.ANON_KEY;
    } else {
        // No estamos en producción, así que estamos en desarrollo local.
        // Importamos dinámicamente el archivo config.js (que está ignorado por Git).
        console.log("Entorno de desarrollo detectado. Importando config.js local.");
        try {
            const config = await import('../config.js');
            SUPABASE_URL = config.SUPABASE_URL;
            SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
        } catch (error) {
            console.error("Error: no se pudo cargar config.js. Asegúrate de que el archivo exista en la raíz del proyecto si estás en desarrollo local.", error);
            // Mostrar un error en la UI para que el desarrollador lo vea
            document.body.innerHTML = '<div style="padding: 2rem; text-align: center; font-family: sans-serif; color: red;"><h1>Error de Configuración</h1><p>No se pudo cargar <code>config.js</code>. Este archivo es necesario para el desarrollo local y debe contener tus claves de Supabase.</p></div>';
            return null;
        }
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error("Error: Las claves de Supabase no están definidas.");
        return null;
    }

    return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

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
        
        await loadInitialData();
        
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
    if (!supabaseClient) return;

    supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log("AuthStateChange event:", event, "Session:", session);
        
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

    initializeReportListeners();
    initializeHistoryListeners();
    initializeFormListeners();
}

// --- Punto de Entrada de la Aplicación ---
async function main() {
    console.log("Aplicación iniciada. DOM listo.");
    
    // Inicializamos Supabase y esperamos a que esté listo
    supabaseClient = await initializeSupabase();
    
    // Si la inicialización falló (ej. faltan claves), no continuamos.
    if (!supabaseClient) {
        console.error("La inicialización de Supabase falló. La aplicación no puede continuar.");
        return;
    }
    
    // Exportamos el cliente para que otros módulos puedan usarlo.
    // Esto es un pequeño truco para asegurar que la exportación ocurra después de la inicialización.
    window.supabaseClient = supabaseClient;

    initializeEventListeners();
    setupAuthStateListener(); 
}

// Para que otros módulos puedan importar el cliente de Supabase
// Hacemos una exportación tardía. No es lo ideal, pero funciona en este contexto simple.
// Una mejor aproximación sería usar un patrón de singleton o un inicializador de módulo.
export { supabaseClient };

document.addEventListener('DOMContentLoaded', main);