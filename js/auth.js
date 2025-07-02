// ==========================================================================
// MÓDULO DE AUTENTICACIÓN: auth.js
// RESPONSABILIDAD: Manejar la lógica de registro, login y logout con Supabase Auth.
// ==========================================================================

import { dom, state, supabaseClient } from './main.js';
import { showPage } from './ui.js';
import { fetchAllPeople, fetchAllInstruments, fetchAllArtists } from './api.js'; 

// --- Funciones de Manejo de Eventos ---

export async function handleLogin() {
    const email = dom.emailInput.value.trim();
    const password = dom.passwordInput.value.trim();

    // Limpiar mensajes de error previos
    dom.loginErrorMessage.textContent = '';
    dom.loginErrorMessage.style.display = 'none';

    if (!email || !password) {
        dom.loginErrorMessage.textContent = 'Por favor, ingresa tu correo y contraseña.';
        dom.loginErrorMessage.style.display = 'block';
        return;
    }

    try {
        // Llamada a Supabase Auth para iniciar sesión
        const { data: { user, session }, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            throw error; // Lanza el error para que sea capturado por el catch
        }

        // El listener onAuthStateChange en main.js se encargará de actualizar la UI.
        console.log("Inicio de sesión exitoso:", user, session);
        // Si el login es exitoso, el listener onAuthStateChange se activará con 'SIGNED_IN'
        // y la lógica de carga de datos se manejará allí.

    } catch (error) {
        console.error("Error en el inicio de sesión:", error);
        dom.loginErrorMessage.textContent = error.message || 'Ocurrió un error al iniciar sesión.';
        dom.loginErrorMessage.style.display = 'block';
    }
}

export async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error("Error al cerrar sesión:", error);
        }
        
        // El listener onAuthStateChange en main.js se encargará de la redirección y el reset del estado.
        console.log("Sesión cerrada.");

    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
}