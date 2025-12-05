/**
 * File System Access API utility with IndexedDB persistence
 * Allows saving PDFs to a user-selected directory on Chrome/Edge
 * Falls back to regular download on other browsers
 */

const DB_NAME = 'DCSWarehouseViewer';
const DB_VERSION = 1;
const STORE_NAME = 'settings';
const DIRECTORY_KEY = 'pdfDirectory';

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported() {
  return 'showDirectoryPicker' in window;
}

/**
 * Open IndexedDB
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save directory handle to IndexedDB
 */
async function saveDirectoryHandle(dirHandle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(dirHandle, DIRECTORY_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get directory handle from IndexedDB
 */
async function getDirectoryHandle() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(DIRECTORY_KEY);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Request permission for a directory handle
 */
async function verifyPermission(dirHandle, readWrite = true) {
  const options = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }

  // Check if permission was already granted
  if ((await dirHandle.queryPermission(options)) === 'granted') {
    return true;
  }

  // Request permission
  if ((await dirHandle.requestPermission(options)) === 'granted') {
    return true;
  }

  return false;
}

/**
 * Prompt user to select a directory for saving PDFs
 * Returns true if successful, false otherwise
 */
export async function selectPDFDirectory() {
  if (!isFileSystemAccessSupported()) {
    alert(
      'La selezione della directory non è supportata in questo browser.\n\n' +
      'Questa funzionalità è disponibile solo su Chrome e Edge.\n' +
      'Il PDF verrà scaricato nella cartella Downloads predefinita.'
    );
    return false;
  }

  try {
    // Show directory picker
    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });

    // Verify we have permission
    const hasPermission = await verifyPermission(dirHandle);
    if (!hasPermission) {
      alert('Permesso negato per salvare nella directory selezionata.');
      return false;
    }

    // Save handle to IndexedDB for future use
    await saveDirectoryHandle(dirHandle);

    return true;
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error selecting directory:', error);
      alert('Errore nella selezione della directory: ' + error.message);
    }
    return false;
  }
}

/**
 * Get the saved PDF directory handle (if exists and has permission)
 * Returns directory handle or null
 */
export async function getSavedPDFDirectory() {
  if (!isFileSystemAccessSupported()) {
    return null;
  }

  try {
    const dirHandle = await getDirectoryHandle();
    if (!dirHandle) {
      return null;
    }

    // Verify we still have permission
    const hasPermission = await verifyPermission(dirHandle);
    if (!hasPermission) {
      return null;
    }

    return dirHandle;
  } catch (error) {
    console.error('Error getting saved directory:', error);
    return null;
  }
}

/**
 * Save a Blob to the selected directory
 * Falls back to regular download if directory is not set or API not supported
 */
export async function savePDFToDirectory(blob, filename) {
  const dirHandle = await getSavedPDFDirectory();

  if (!dirHandle) {
    // Fallback to regular download
    return false;
  }

  try {
    // Create file in the directory
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();

    // Write the blob
    await writable.write(blob);
    await writable.close();

    return true;
  } catch (error) {
    console.error('Error saving PDF to directory:', error);
    return false;
  }
}

/**
 * Clear the saved directory handle
 */
export async function clearPDFDirectory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(DIRECTORY_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
