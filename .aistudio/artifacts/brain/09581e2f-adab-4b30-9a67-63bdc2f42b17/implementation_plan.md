# Sistema de Roles RBAC y Gestor de Usuarios para AlabanzApp

Plan para implementar un sistema de control de acceso basado en roles (**Admin**, **Gestor de canciones**, **Visualizador**), un **Gestor de Usuarios** en Ajustes exclusivo para administradores, restricción de importación y exportación de datos, y obligatoriedad de inicio de sesión con Google para acceder al contenido.

## Decisiones Críticas y Revisión del Usuario

> [!IMPORTANT]
> - **Roles definidos**:
>   1. **Admin** (`admin`): Acceso total, gestión de usuarios, importación/exportación de JSON, borrado y creación de servicios.
>      - *Correos iniciales*: `jnaguinix@gmail.com`, `jamesdpuertam@gmail.com`.
>   2. **Gestor de canciones** (`editor`): Puede crear y modificar servicios, canciones y músicos. No puede importar/exportar JSON ni gestionar usuarios.
>      - *Correos iniciales*: `katherua@gmail.com`, `camilohurtado120@gmail.com`.
>   3. **Visualizador** (`viewer`): Solo consulta de servicios, repertorio, historial y reportes en modo solo lectura.
>      - *Correo inicial*: `manuela201022@gmail.com`.
> - **Ubicación del Gestor**: Dentro de **Ajustes**, como sección protegida visible y ejecutable únicamente para administradores.
> - **Acceso privado obligatorio**: Se requiere inicio de sesión con Google para ver cualquier contenido. Usuarios sin cuenta o sin rol autorizado verán una pantalla de bienvenida y solicitud de acceso.
> - **Almacenamiento dinámico de usuarios**: Los roles se almacenan en una colección de Firestore `/usuarios/{email}` precargada con los correos indicados, permitiendo a los administradores agregar, modificar roles o revocar accesos en cualquier momento directamente desde la app.

---

### 1. Resumen y Concepto Central

- **Propósito**: Proteger los datos y servicios del ministerio de alabanza garantizando que solo los miembros autorizados tengan acceso, y restringiendo las acciones críticas (como importar/exportar JSON y administrar usuarios) exclusivamente a los administradores designados.
- **Audiencia**: Administradores de la iglesia/ministerio, líderes de alabanza (gestores) y músicos/integrantes del equipo (visualizadores).

---

### 2. Experiencia de Usuario y Flujos

1. **Pantalla de Bienvenida y Autenticación**:
   - Si el usuario no ha iniciado sesión, la aplicación muestra una pantalla de bienvenida limpia con el logo de AlabanzApp y el botón *"Iniciar sesión con Google"*.
   - Una vez autenticado:
     - Si su correo está registrado con un rol, accede directamente a la aplicación con los permisos correspondientes.
     - Si su correo no está en la lista de usuarios autorizados, se muestra un aviso cordial indicando que su cuenta requiere que un administrador le asigne un rol.

2. **Diferenciación de Permisos en la UI**:
   - **Admin**:
     - Acceso completo a Inicio, Historial, Registro y Reportes.
     - En **Ajustes**: Ve y opera la sección **Gestor de Usuarios** y las herramientas de **Exportar JSON** e **Importar JSON**.
   - **Gestor de canciones**:
     - Acceso a Inicio, Historial, Registro y Reportes.
     - Puede crear y editar cualquier servicio.
     - En **Ajustes**: Ocultas las opciones de importar/exportar JSON y el Gestor de Usuarios.
   - **Visualizador**:
     - Acceso a Inicio, Historial y Reportes.
     - La pestaña de **Registro** se deshabilita o muestra solo lectura, y los botones de editar o crear servicio no están disponibles.
     - En **Ajustes**: Solo opciones de apariencia y cerrar sesión.

3. **Gestor de Usuarios (Panel de Administrador)**:
   - Lista interactiva de usuarios autorizados con su foto/inicial, correo, rol actual y fecha de alta.
   - Selector rápido para cambiar el rol de un usuario entre *Admin*, *Gestor de canciones* y *Visualizador*.
   - Botón para eliminar acceso (con confirmación y protección para no eliminarse a sí mismo).
   - Formulario sencillo *"Añadir miembro"* para escribir un correo de Google y asignarle su rol inicial.

---

### 3. Decisiones Técnicas y Reglas de Seguridad

- **Colección Firestore `/usuarios/{email}`**:
  - Documentos identificados por correo en minúsculas: `{ email, role: 'admin'|'editor'|'viewer', createdAt, updatedAt, updatedBy }`.
  - Precarga automática de los 5 correos solicitados al inicializar la base de datos si aún no existen.
- **Reglas de Seguridad (`firestore.rules`)**:
  - `usuarios/{email}`:
    - Lectura: Cualquier usuario autenticado puede leer su propio documento de rol; los administradores pueden leer todos.
    - Escritura: Exclusiva para administradores.
  - `servicios/{fecha}`:
    - Lectura: Permitida si el usuario está autenticado y tiene rol `admin`, `editor` o `viewer`.
    - Creación y Actualización: Permitida si tiene rol `admin` o `editor`.
    - Borrado: Permitido únicamente a administradores (`admin`).
  - `indice/{indexId}`:
    - Lectura: Permitida a usuarios con rol.
    - Escritura: Permitida a `admin` y `editor`.

---

### 4. Diagrama de Arquitectura de Acceso

```
┌─────────────────────────────────────────────────────────────┐
│                       ALABANZAPP UI                         │
│                                                             │
│  [No autenticado] ──► Pantalla de Login con Google          │
│  [Sin autorización] ──► Pantalla de "Pendiente de acceso"    │
│  [Visualizador]   ──► Inicio, Historial, Reportes (Lectura) │
│  [Gestor Canción] ──► + Registro / Edición de Servicios     │
│  [Administrador]  ──► + Gestor de Usuarios + Import/Export  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 App Context & Auth Manager                  │
│       user, role (admin | editor | viewer), permissions     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     FIREBASE FIRESTORE                      │
│                                                             │
│  📁 usuarios/{email}       ◄── Admins gestionan roles       │
│  📁 servicios/{fecha}      ◄── Admins + Gestores escriben   │
│  📁 indice/{canciones,...} ◄── Índices atómicos             │
│                                                             │
│  🔒 Reglas ABAC validadas contra auth.token.email           │
└─────────────────────────────────────────────────────────────┘
```

---

### Pasos de Ejecución tras la Aprobación:
1. **Actualizar `firebase-blueprint.json`**: Añadir la entidad `UserRole` y la ruta `/usuarios/{email}`.
2. **Actualizar y Desplegar `firestore.rules`**: Implementar los helpers de rol (`isAdmin()`, `isEditor()`, `hasAccess()`) y desplegar con `DeployRules`.
3. **Módulo de Gestión de Usuarios (`src/data/users.js`)**: Funciones para listar, precargar los correos iniciales, asignar rol y revocar acceso.
4. **Actualizar `src/app-context.jsx`**: Cargar el rol del usuario conectado, calcular permisos (`canEdit`, `canManageUsers`, `canBackup`) y controlar la puerta de acceso.
5. **Componente `UserManagement` en `SettingsSheet` (`src/components/Shell.jsx`)**: Interfaz para añadir miembros y alternar roles, y ocultar las opciones de importación/exportación a los no administradores.
6. **Protección de Páginas**: Adaptar `Editor.jsx` e `Home.jsx` para que solo los roles autorizados puedan acceder al flujo de edición.
7. **Verificación**: Comprobar compilación (`compile_applet`) y verificar los flujos de cada rol.
