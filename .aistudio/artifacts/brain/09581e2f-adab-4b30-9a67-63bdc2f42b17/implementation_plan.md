# Directorio Oficial de Integrantes y Directores Múltiples

Plan para solucionar la dispersión de nombres en el registro de servicios mediante un **Directorio Oficial de Integrantes en Firestore**, **selección exclusiva por menús desplegables** (sin texto libre) y un **selector de directores múltiples con tags y botón `+`** que unifica los nombres de forma natural (ej. *"Camilo y Kathe"*).

## Decisiones Críticas y Revisión del Usuario

> [!IMPORTANT]
> - **Directorio Oficial del Equipo**: Los nombres de directores, coristas y músicos ya no se escribirán como texto libre en los formularios. Se seleccionarán exclusivamente desde una lista oficial gestionada en **Ajustes → Directorio del Equipo**.
> - **Directores Múltiples con Tags**:
>   - En el formulario, los directores se añaden como etiquetas/chips mediante un botón `+ Añadir director`.
>   - La aplicación almacenará la lista de directores (`directors: [...]`) y generará el campo `director` unificado en formato natural (ej. *"Camilo y Kathe"*, *"Camilo, Kathe y Dani"*), manteniendo 100% de compatibilidad con las pantallas actuales.
>   - En las estadísticas e índices (`indice/personas`), cada persona recibirá su conteo de dirección por separado (Camilo sumará 1 y Kathe sumará 1), eliminando entradas híbridas ficticias como *"Camilo / Kathe"*.
> - **Selección de Banda (Músicos y Coristas)**: Menús desplegables cerrados basados en el directorio oficial y catálogo de instrumentos.

---

### 1. Resumen y Concepto Central

- **Problema actual**: Al usar campos de texto abierto, los usuarios escribían cadenas como *"Camilo / Kathe"* o *"Camilo y Hanny"* para indicar co-dirección, lo que generaba registros duplicados en los índices y desordenaba las estadísticas.
- **Solución**:
  1. Base de datos centralizada de miembros del equipo musical en Firestore (`/integrantes/{id}`).
  2. Panel de administración en Ajustes para dar de alta integrantes oficiales y asignarles roles/instrumentos.
  3. Interfaz intuitiva en el editor para añadir múltiples directores con etiquetas visuales y botón `+`.
  4. Desplegables estrictos para asignar músicos y coristas sin permitir texto libre.

---

### 2. Experiencia de Usuario y Diseño Visual

#### A. Paso 1 del Registro: ¿Cuándo y quién dirige?
- **Selector de Directores**:
  - Muestra los directores seleccionados como tags compactos con botón de eliminar (`✕`).
  - Botón interactivo `+ Añadir director` que despliega el listado de miembros del directorio oficial.
  - Al seleccionar una persona, se añade al grupo de directores. No permite seleccionar al mismo director dos veces.
  - Si hay 2 o más directores, se muestra una vista previa en tiempo real: *"Aparecerá como: Camilo y Kathe"*.

#### B. Paso 3 del Registro: Músicos y Coristas
- **Filas de Banda**:
  - Cada fila tiene:
    1. Desplegable de **Instrumento** (Voz / Coro, Piano, Guitarra acústica, Bajo, Batería, etc.).
    2. Desplegable de **Músico** (exclusivo de los integrantes registrados en el directorio oficial).
  - Cero inputs de texto libre para evitar nombres con faltas ortográficas o tildes faltantes.

#### C. Panel "Directorio del Equipo" en Ajustes
- Ubicado en **Ajustes → Directorio del Equipo** (accesible para Administradores y Gestores de canciones).
- Lista completa de músicos y cantantes del ministerio.
- Formulario rápido *"Añadir integrante"* con nombre y selección de si suele dirigir alabanza.
- Opciones para editar nombres o desactivar miembros que ya no estén activos.

---

### 3. Arquitectura Técnica y Modelo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│                    AJUSTES (ADMIN/GESTOR)                   │
│          Panel de Gestión del Directorio del Equipo         │
│  [Añadir integrante: Nombre + Puede dirigir + Instrumento]  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               FIRESTORE: /integrantes/{id}                  │
│   { id, name, key, canDirect: bool, instruments: [], active }│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       EDITOR DE SERVICIO                    │
│                                                             │
│  [Director(es)]                                             │
│  ┌──────────────┐ ┌─────────────┐  ┌───────────────────┐    │
│  │ Camilo   [✕] │ │ Kathe   [✕] │  │ + Añadir director │    │
│  └──────────────┘ └─────────────┘  └───────────────────┘    │
│  Previsualización: "Camilo y Kathe"                         │
│                                                             │
│  [Músicos y Banda]                                          │
│  [Desplegable Instrumento] ──► [Desplegable Integrante]     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               FIRESTORE: /servicios/{fecha}                 │
│  director: "Camilo y Kathe" (retrocompatible)               │
│  directors: ["Camilo", "Kathe"] (desagregado)               │
│  indice/personas: Camilo (+1 Dirige), Kathe (+1 Dirige)     │
└─────────────────────────────────────────────────────────────┘
```

#### Reglas de Seguridad (`firestore.rules`)
- Colección `/integrantes/{id}`:
  - Lectura: Permitida a cualquier usuario autenticado con rol activo (`admin`, `editor`, `viewer`).
  - Escritura/Modificación: Permitida a `admin` y `editor`.
- Colección `/servicios/{fecha}`:
  - Almacena `directors: [...]` y `director: string` para compatibilidad total con todas las consultas y reportes existentes.

---

### Pasos de Ejecución tras la Aprobación:
1. **Actualizar `firebase-blueprint.json`**: Añadir la entidad `TeamMember` y la ruta `/integrantes/{id}`.
2. **Actualizar y Desplegar `firestore.rules`**: Añadir los permisos para `/integrantes/{id}` y desplegar con `DeployRules`.
3. **Módulo del Directorio (`src/data/team.js`)**:
   - Funciones para listar, añadir, editar y precargar integrantes iniciales (extrayendo los nombres limpios existentes en los índices de la app).
4. **Actualizar `src/data/store.js`**:
   - Soportar el array `directors` y actualizar los índices de personas asignando el rol de `Dirige` a cada director individualmente, unificando el campo `director` con el formato "Persona A y Persona B".
5. **Componente de Gestión en Ajustes (`src/components/Shell.jsx`)**:
   - Modal del Directorio del Equipo para administrar los integrantes oficiales.
6. **Actualizar `src/pages/Editor.jsx`**:
   - Sustituir el input de director por el selector de directores múltiples con tags y botón `+`.
   - Sustituir los inputs de músicos por desplegables cerrados basados en el directorio oficial.
7. **Verificación**: Probar compilación con `compile_applet`, verificar persistencia en Firestore y probar la experiencia de selección en el registro.
