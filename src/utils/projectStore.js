const DATABASE_NAME = 'amazoniaink-projects';
const STORE_NAME = 'projects';
const DATABASE_VERSION = 1;

const openDatabase = () => new Promise((resolve, reject) => {
  if (!('indexedDB' in globalThis)) {
    reject(new Error('Este navegador no admite guardado local de proyectos.'));
    return;
  }
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento local.'));
  request.onblocked = () => reject(new Error('El almacenamiento está bloqueado por otra pestaña.'));
});

const execute = async (mode, operation) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Falló el almacenamiento local del proyecto.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Se canceló el almacenamiento local del proyecto.'));
    };
    try {
      result = operation(store);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
};

export const saveProject = (project) => execute('readwrite', store => store.put(project));

export const deleteProject = (id) => execute('readwrite', store => store.delete(id));

export const listProjects = async () => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const items = [];
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target?.result;
      if (cursor) {
        const val = cursor.value;
        items.push({
          id: val.id,
          name: val.projectName || val.activePresetName || val.id,
          savedAt: val.savedAt || '',
          imageSize: val.imageSize || null
        });
        cursor.continue();
      }
    };
    request.onerror = () => {
      reject(request.error || new Error('No se pudo listar los proyectos guardados.'));
    };
    transaction.oncomplete = () => {
      database.close();
      items.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
      resolve(items);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Falló la lectura de proyectos guardados.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Se canceló la lectura de proyectos guardados.'));
    };
  });
};

export const getProject = async (id) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    let result = null;
    request.onsuccess = () => {
      result = request.result || null;
    };
    request.onerror = () => {
      reject(request.error || new Error('No se pudo leer el proyecto.'));
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Falló la lectura del proyecto.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Se canceló la lectura del proyecto.'));
    };
  });
};
