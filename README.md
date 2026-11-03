# AlabanzApp

Registro, historial y reportes de los servicios de alabanza.
React + Vite + Tailwind CSS v4. Sin login: la app abre directo.

```bash
npm install
npm run dev      # desarrollo
npm run build    # producción en dist/
```

## Datos

Hoy todo se guarda en `localStorage` (con 14 servicios de ejemplo la primera vez).
Toda la persistencia vive en [`src/data/store.js`](src/data/store.js), escrita con la
forma de Firestore: las pantallas piden solo lo que muestran y nunca recorren todos
los servicios. Para pasar a Firebase hay que reescribir ese archivo manteniendo estas
funciones: `queryServices`, `getService`, `getServices`, `saveService`, `deleteService`
y `getIndex`.

### Colecciones

| Colección | Contenido |
| --- | --- |
| `servicios/{fecha}` | Un documento por servicio, con canciones y banda dentro: `{ id, fecha, director, songs, songKeys, band, updatedAt, deleted }` |
| `indice/canciones` | Por clave normalizada: `{ name, artist, count, dates: [fecha desc] }` |
| `indice/personas` | Por clave normalizada: `{ name, services, roles: { rol: n } }` |
| `indice/meta` | `{ serviceCount }` |

- **Claves normalizadas** (`keyOf`): "Océanos", "oceanos" y "oceanos " son la misma canción.
  Al guardar, los nombres se igualan con los que ya existen.
- **Índices:** se actualizan en la misma operación que guarda o borra un servicio
  (en Firestore: una transacción o una Cloud Function). El aviso de repetición, el
  repertorio, el autocompletado, "Equipo" y las estadísticas de Inicio leen el índice,
  no los servicios.
- **Borrado lógico:** `deleted: true` + `updatedAt`, para que otros dispositivos se
  enteren al sincronizar.
- **Consultas:** `queryServices({ from, to, director, text, order, limit, after })`
  devuelve `{ items, next }`. Historial pagina de 10 en 10 con ese cursor.

## Pendientes para cuando llegue Firebase

1. **Conectar Firestore** reescribiendo `store.js` (misma interfaz). Activar la
   persistencia sin conexión de Firestore: la app guarda en una copia local y
   sincroniza después.
2. **Mantener los índices en el servidor.** Hoy los actualiza `saveService` en el
   cliente; con varios dispositivos conviene hacerlo en una transacción o en una
   Cloud Function para que no se desfasen.
3. **Sincronizar solo lo que cambió.** Al abrir, pedir los servicios con
   `updatedAt` mayor al último sincronizado (casi siempre 0 o 1 documentos) en
   lugar de releer todo. Los borrados llegan como `deleted: true`.
4. **Búsqueda de texto en el Historial.** Hoy `queryServices` filtra `text` en el
   cliente. Firestore no busca texto libre: usar `songKeys` con `array-contains`
   para canciones y filtros por director/fecha nativos, o un servicio de búsqueda.
5. **Resumen de Reportes para periodos largos.** El resumen lee todos los servicios
   del periodo; con "Todo" y muchos años conviene guardar agregados por mes
   (`indice/meses/{aaaa-mm}`) y sumar esos documentos.
6. **Índice de personas por periodo.** "Equipo" en "Todo" usa el índice; para otros
   periodos lee los servicios del rango. Se resuelve con los mismos agregados por mes.
7. **Reglas de seguridad y roles.** Hoy cualquiera con el enlace puede editar o
   borrar. Definir quién ve y quién edita.
8. **Duplicados ya existentes.** Los nombres nuevos se igualan al guardar, pero hay
   que limpiar los que se guardaron antes con variantes distintas.
9. **Sin conexión (PWA).** Falta el service worker; el manifiesto y el ícono ya existen.
10. ~~**Respaldo.**~~ Hecho: **Ajustes → Copia de seguridad** exporta e importa JSON.

## Importar los datos viejos de Supabase

Hay dos pasos: sacar los datos de Supabase y cargarlos.

1. **Exportar de Supabase.** En el panel, **SQL Editor**, ejecutar la consulta de abajo. Devuelve
   una sola celda con todos los servicios; copiarla a un archivo `servicios.json`.
   Si el proyecto está pausado hay que restaurarlo primero (**Restore project**).
2. **Importar.** En la app: **Ajustes → Importar JSON**. Muestra cuántos servicios entran,
   cuántos reemplazan a uno existente (misma fecha) y cuántas entradas no son válidas.
   Une con lo que ya hay: la misma fecha se reemplaza y el resto se conserva.

Antes de borrar Supabase: comparar `select count(*) from servicios;` con los servicios
importados, y guardar también cada tabla como CSV (**Table Editor → Export**).

```sql
select json_agg(t order by t.fecha) as servicios
from (
  select
    s.fecha,
    (select p.nombre_persona
       from servicios_musicos sm
       join instrumentos i on i.id = sm.instrumento_id
       join personas p on p.id = sm.persona_id
      where sm.servicio_id = s.id and i.nombre_instrumento = 'Director'
      limit 1) as director,
    coalesce((
      select json_agg(json_build_object('name', c.nombre_cancion, 'artist', a.nombre_artista) order by sc.id)
        from servicios_canciones sc
        left join canciones_unificacion u on u.id_duplicado = sc.cancion_id
        join canciones c on c.id = coalesce(u.id_canonico, sc.cancion_id)
        left join artistas a on a.id = c.artista_id
       where sc.servicio_id = s.id), '[]'::json) as songs,
    coalesce((
      select json_agg(json_build_object('instrument', i.nombre_instrumento, 'person', p.nombre_persona) order by sm.id)
        from servicios_musicos sm
        join instrumentos i on i.id = sm.instrumento_id
        join personas p on p.id = sm.persona_id
       where sm.servicio_id = s.id and i.nombre_instrumento <> 'Director'), '[]'::json) as band
  from servicios s
) t;
```

Cómo se traduce el esquema viejo (Supabase) al nuevo:

- `servicios.fecha` pasa a ser el id del documento (`YYYY-MM-DD`; era único).
- El **director** era un músico con el instrumento `Director`; ahora es el campo `director`.
- El **orden de las canciones** sale de `servicios_canciones.id` (no había columna de orden).
- `canciones_unificacion` (duplicado → canónico) ya viene aplicada por la consulta.
- `artistas`, `personas`, `instrumentos` y `canciones` dejan de ser tablas: sus nombres
  viven dentro del servicio y en los índices.

### Formato del archivo JSON

El importador acepta una lista, `{ "servicios": [...] }`, o una fila `[ { "servicios": [...] } ]`
tal como la copia el editor SQL. `songs` y `band` pueden venir como texto JSON (así salen en un CSV).

```json
{
  "servicios": [
    {
      "fecha": "2025-01-05",
      "director": "Laura Torres",
      "songs": [{ "name": "Océanos", "artist": "Hillsong United" }],
      "band": [{ "instrument": "Piano", "person": "Sofía Vargas" }]
    }
  ]
}
```

Reglas del lector ([`src/data/importer.js`](src/data/importer.js)): se descartan las entradas con
fecha inexistente (p. ej. `2025-02-30`); si una fecha se repite gana la última; se recortan
espacios; se quitan canciones sin nombre y músicos sin instrumento o persona; un artista
vacío queda como `Desconocido`.

## Nota para Google AI Studio (migrar a Firebase)

Si usas Google AI Studio para generar el código de la migración a Firestore, **no le pidas que
invente el modelo**: ya está definido arriba (colecciones `servicios`, `indice/canciones`,
`indice/personas`, `indice/meta`) y su lógica está en [`src/data/store.js`](src/data/store.js).
Pásale ese archivo, `src/data/importer.js`, `src/lib/format.js` (para `keyOf`) y este README.
Prompt sugerido:

```text
Tengo una app React (Vite) de servicios de alabanza que hoy guarda todo en localStorage
a través de src/data/store.js. Quiero migrarla a Firebase (Firestore) SIN cambiar las
pantallas: solo reescribir store.js manteniendo exactamente estas funciones y firmas:
queryServices({from,to,director,text,order,limit,after}) -> {items,next},
getService(fecha), getServices(fechas), saveService({fecha,director,songs,band}),
deleteService(fecha), getIndex(), importServices(list), previewImport(list),
exportServices(), resetToSample(), clearAll(), y la constante DIRECTOR_ROLE.

Reglas que debes respetar:
1. Colecciones: servicios/{fecha} con { id, fecha, director, songs:[{name,artist}],
   songKeys:[...], band:[{instrument,person}], updatedAt (ms), deleted (bool) };
   indice/canciones, indice/personas e indice/meta como se describe en el README.
2. Claves: usa keyOf() de src/lib/format.js para canciones y personas. Antes de guardar,
   iguala los nombres con los que ya existen en el índice (snapToIndex).
3. Índices: saveService y deleteService deben actualizar servicio + índices en UNA
   transacción (runTransaction) o writeBatch; copia la lógica de applyService (suma o
   resta la aportación de un servicio; "dates" ordenadas de más reciente a más antigua;
   borra la entrada si count/services llega a 0).
4. Borrado lógico: deleteService pone deleted:true y updatedAt; las lecturas ignoran los
   borrados.
5. queryServices: filtros from/to/director y orden por fecha con limit y cursor "after"
   como consultas nativas de Firestore (índices compuestos si hacen falta; dime cuáles).
   El filtro "text" no lo soporta Firestore: usa songKeys con array-contains para
   canciones y deja el resto como pendiente señalado.
6. importServices: escribe en lotes de máximo 500 operaciones (writeBatch) e incluye el
   cálculo de los índices; no hagas una escritura por cada canción.
7. Usa el SDK modular de Firebase v9+ (firebase/app, firebase/firestore), activa la
   persistencia sin conexión y lee la configuración de variables VITE_FIREBASE_*.
8. Escribe también las reglas de seguridad (firestore.rules) y dime qué cambia si más
   adelante se añade autenticación.
9. No cambies el formato del JSON de importación/exportación ni inventes datos.

Entrega: el store.js nuevo, firestore.rules, los índices compuestos necesarios y un
checklist para verificar que el número de servicios importados coincide con el original.
```

Cosas que conviene revisar en lo que genere:

- Que **no** guarde un documento por canción o por persona con relaciones tipo SQL.
- Que importar 300 servicios haga pocas escrituras (lotes), no cientos de transacciones.
- Que el conteo de `indice/meta.serviceCount` y el de `servicios` (sin borrados) coincidan.
