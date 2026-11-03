import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { keyOf, formatDirectors, cleanSingleName, splitAndCleanNames, isCompoundName } from '../lib/format';
import { invalidateTeamCache } from './team';
import { invalidateServicesCache, DIRECTOR_ROLE } from './store';

export { cleanSingleName, splitAndCleanNames, isCompoundName };

const BATCH_SIZE = 400;


/**
 * Reconstruye el índice completo de personas y canciones a partir de la lista de servicios limpios.
 */
function buildIndexFromServices(servicesList) {
  const index = {
    songs: {},
    people: {},
    serviceCount: 0,
  };

  const insertDate = (dates, fecha) => (dates.includes(fecha) ? dates : [...dates, fecha].sort().reverse());

  servicesList.forEach((s) => {
    if (s.deleted) return;
    index.serviceCount++;

    // Canciones
    (s.songs || []).forEach((song) => {
      const k = keyOf(song.name);
      if (!k) return;
      const cur = index.songs[k] || { name: song.name, artist: song.artist || '', count: 0, dates: [] };
      cur.count += 1;
      cur.dates = insertDate(cur.dates, s.fecha);
      index.songs[k] = cur;
    });

    // Personas: directores
    const addRole = (name, role) => {
      if (!name) return;
      const k = keyOf(name);
      const cur = index.people[k] || { name, services: 0, roles: {} };
      cur.roles[role] = (cur.roles[role] || 0) + 1;
      index.people[k] = cur;
    };

    const rolesGivenToPersonInThisService = new Set();
    const dList = Array.isArray(s.directors) && s.directors.length
      ? s.directors
      : splitAndCleanNames(s.director);

    dList.forEach((d) => {
      addRole(d, DIRECTOR_ROLE);
      rolesGivenToPersonInThisService.add(keyOf(d));
    });

    // Personas: banda
    (s.band || []).forEach((m) => {
      if (m.person && m.instrument) {
        addRole(m.person, m.instrument);
        rolesGivenToPersonInThisService.add(keyOf(m.person));
      }
    });

    // Cada persona solo cuenta 1 servicio por fecha aunque tenga múltiples roles
    rolesGivenToPersonInThisService.forEach((k) => {
      if (index.people[k]) {
        index.people[k].services = (index.people[k].services || 0) + 1;
      }
    });
  });

  return index;
}

/**
 * Ejecuta la migración y normalización completa de datos:
 * 1. Limpia y separa los integrantes en Firestore (`integrantes`).
 * 2. Actualiza los servicios pasados en Firestore (`servicios`).
 * 3. Reconstruye el índice global (`indice/personas`, `indice/canciones`, `indice/meta`).
 */
export async function runDataCleanup() {
  const result = {
    membersSplitOrCleaned: 0,
    compoundDocsDeleted: [],
    membersCreatedOrUpdated: 0,
    servicesScanned: 0,
    servicesUpdated: 0,
  };

  try {
    // -------------------------------------------------------------
    // FASE 1: Limpieza del directorio de integrantes
    // -------------------------------------------------------------
    const integrantesSnap = await getDocs(collection(db, 'integrantes'));
    const existingMembers = new Map();
    const compoundMembersToDelete = [];
    const membersToSave = new Map();

    integrantesSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const rawName = data.name || docSnap.id;
      existingMembers.set(docSnap.id, { docId: docSnap.id, ...data });

      const split = splitAndCleanNames(rawName);
      const isCompound = split.length > 1;
      const needsNameFix = split.length === 1 && split[0] !== rawName;

      if (isCompound) {
        compoundMembersToDelete.push({ docId: docSnap.id, rawName, data, individualNames: split });
      } else if (needsNameFix) {
        const cleanName = split[0];
        const newKey = keyOf(cleanName);
        if (newKey !== docSnap.id) {
          compoundMembersToDelete.push({ docId: docSnap.id, rawName, data, individualNames: [cleanName] });
        }
        membersToSave.set(newKey, {
          id: newKey,
          name: cleanName,
          canDirect: data.canDirect ?? true,
          instruments: Array.isArray(data.instruments) && data.instruments.length ? data.instruments : ['Voz'],
          active: data.active !== false,
          updatedAt: Date.now(),
        });
      }
    });

    // Procesar cada miembro compuesto para crear/garantizar las personas individuales
    compoundMembersToDelete.forEach(({ data, individualNames }) => {
      individualNames.forEach((individualName) => {
        const key = keyOf(individualName);
        const existing = membersToSave.get(key) || existingMembers.get(key);

        const mergedInstruments = new Set([
          ...(existing?.instruments || []),
          ...(data.instruments || ['Voz']),
        ]);

        membersToSave.set(key, {
          id: key,
          name: individualName,
          canDirect: Boolean(existing?.canDirect ?? data.canDirect ?? true),
          instruments: mergedInstruments.size ? [...mergedInstruments] : ['Voz'],
          active: true,
          updatedAt: Date.now(),
        });
      });
    });

    // Ejecutar escritura por lotes para integrantes
    let memberBatch = writeBatch(db);
    let memberOps = 0;

    // Guardar individuales
    for (const [key, memberData] of membersToSave.entries()) {
      const docRef = doc(db, 'integrantes', key);
      memberBatch.set(docRef, memberData, { merge: true });
      memberOps++;
      result.membersCreatedOrUpdated++;

      if (memberOps >= BATCH_SIZE) {
        await memberBatch.commit();
        memberBatch = writeBatch(db);
        memberOps = 0;
      }
    }

    // Borrar compuestos
    for (const { docId, rawName } of compoundMembersToDelete) {
      const docRef = doc(db, 'integrantes', docId);
      memberBatch.delete(docRef);
      memberOps++;
      result.compoundDocsDeleted.push(rawName);

      if (memberOps >= BATCH_SIZE) {
        await memberBatch.commit();
        memberBatch = writeBatch(db);
        memberOps = 0;
      }
    }

    if (memberOps > 0) {
      await memberBatch.commit();
    }

    result.membersSplitOrCleaned = compoundMembersToDelete.length;
    invalidateTeamCache();

    // -------------------------------------------------------------
    // FASE 2: Limpieza del historial de servicios
    // -------------------------------------------------------------
    const serviciosSnap = await getDocs(collection(db, 'servicios'));
    const allCleanServices = [];
    let serviceBatch = writeBatch(db);
    let serviceOps = 0;

    result.servicesScanned = serviciosSnap.docs.length;

    for (const docSnap of serviciosSnap.docs) {
      const s = docSnap.data();
      let serviceChanged = false;

      // 1. Limpieza de directores
      const rawDirectorInput = Array.isArray(s.directors) && s.directors.length
        ? s.directors
        : s.director ? [s.director] : [];

      const cleanDirectors = [
        ...new Set(
          rawDirectorInput
            .flatMap((d) => splitAndCleanNames(d))
            .filter(Boolean)
        ),
      ];

      const cleanDirectorStr = formatDirectors(cleanDirectors);

      if (
        cleanDirectorStr !== s.director ||
        JSON.stringify(cleanDirectors) !== JSON.stringify(s.directors || [])
      ) {
        serviceChanged = true;
      }

      // 2. Limpieza de banda
      const cleanBand = [];
      (s.band || []).forEach((m) => {
        if (!m.person) return;
        const splitPeople = splitAndCleanNames(m.person);
        if (splitPeople.length > 1) {
          serviceChanged = true;
          splitPeople.forEach((p) => {
            cleanBand.push({ instrument: m.instrument || 'Voz', person: p });
          });
        } else {
          const singleClean = splitPeople[0] || cleanSingleName(m.person);
          if (singleClean !== m.person) {
            serviceChanged = true;
          }
          cleanBand.push({ instrument: m.instrument || 'Voz', person: singleClean });
        }
      });

      const updatedServiceDoc = {
        ...s,
        id: docSnap.id,
        director: cleanDirectorStr,
        directors: cleanDirectors,
        band: cleanBand,
      };

      allCleanServices.push(updatedServiceDoc);

      if (serviceChanged) {
        const sRef = doc(db, 'servicios', docSnap.id);
        serviceBatch.update(sRef, {
          director: cleanDirectorStr,
          directors: cleanDirectors,
          band: cleanBand,
          updatedAt: Date.now(),
        });
        serviceOps++;
        result.servicesUpdated++;

        if (serviceOps >= BATCH_SIZE) {
          await serviceBatch.commit();
          serviceBatch = writeBatch(db);
          serviceOps = 0;
        }
      }
    }

    if (serviceOps > 0) {
      await serviceBatch.commit();
    }

    // -------------------------------------------------------------
    // FASE 3: Reconstrucción global de los índices
    // -------------------------------------------------------------
    const newIndex = buildIndexFromServices(allCleanServices);

    const indexBatch = writeBatch(db);
    indexBatch.set(doc(db, 'indice', 'canciones'), { songs: newIndex.songs });
    indexBatch.set(doc(db, 'indice', 'personas'), { people: newIndex.people });
    indexBatch.set(doc(db, 'indice', 'meta'), { serviceCount: newIndex.serviceCount });
    await indexBatch.commit();

    invalidateServicesCache();
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'limpieza');
    throw error;
  }
}
