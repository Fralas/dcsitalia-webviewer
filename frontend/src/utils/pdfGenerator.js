import { jsPDF } from 'jspdf';
import { savePDFToDirectory } from './fileSystemAccess';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BASE_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

/**
 * Check if airport has charts available
 * @param {string} airportId - Airport ID
 * @returns {Promise<boolean>}
 */
export async function checkChartsAvailable(airportId) {
  try {
    const response = await fetch(`${API_URL}/airports/${airportId}/charts`);
    const data = await response.json();
    return data.available && data.charts.length > 0;
  } catch (error) {
    console.error('Error checking charts availability:', error);
    return false;
  }
}

/**
 * Generate PDF with airport charts
 * @param {string} airportId - Airport ID
 * @param {string} airportName - Airport display name
 * @returns {Promise<void>}
 */
export async function generateChartsPDF(airportId, airportName) {
  try {
    // Fetch charts list from backend
    const response = await fetch(`${API_URL}/airports/${airportId}/charts`);
    const data = await response.json();

    if (!data.available || data.charts.length === 0) {
      alert(data.message || 'Chart non disponibili per questo aeroporto');
      return;
    }

    // Create PDF - will set dimensions based on first image
    let pdf = null;

    // Load and add each chart image
    for (let i = 0; i < data.charts.length; i++) {
      const chart = data.charts[i];

      try {
        // Load image - use BASE_URL since chart.url already has full path starting with /charts
        const imgUrl = `${BASE_URL}${chart.url}`;
        const img = await loadImage(imgUrl);

        // Convert pixel dimensions to mm (assuming 96 DPI)
        // 1 inch = 25.4 mm, 96 pixels = 1 inch, so 1 pixel = 25.4/96 mm
        const pixelToMm = 25.4 / 96;
        const imgWidthMm = img.width * pixelToMm;
        const imgHeightMm = img.height * pixelToMm;

        // Create PDF on first iteration, or add new page with custom dimensions
        if (pdf === null) {
          // First page - create PDF with image dimensions
          pdf = new jsPDF({
            orientation: imgWidthMm > imgHeightMm ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [imgWidthMm, imgHeightMm]
          });
        } else {
          // Add new page with custom dimensions for this image
          pdf.addPage([imgWidthMm, imgHeightMm]);
        }

        // Add image at full size (0,0 position, full page)
        pdf.addImage(img, 'PNG', 0, 0, imgWidthMm, imgHeightMm);

      } catch (error) {
        console.error(`Error loading chart ${chart.filename}:`, error);
        // Skip this image and continue with next one
      }
    }

    // Check if at least one image was loaded successfully
    if (pdf === null) {
      alert('Errore: nessuna chart è stata caricata con successo.');
      return;
    }

    // Save PDF
    // Remove all special characters from airportId (keep only letters and numbers)
    const cleanAirportId = airportId.replace(/[^a-zA-Z0-9]/g, '');
    const filename = `${cleanAirportId}charts.pdf`;

    // Try to save to selected directory first
    const blob = pdf.output('blob');
    const savedToDir = await savePDFToDirectory(blob, filename);

    if (savedToDir) {
      alert(`PDF salvato con successo nella directory selezionata!\n\nFile: ${filename}`);
    } else {
      // Fallback to regular download
      pdf.save(filename);
    }

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Errore nella generazione del PDF: ' + error.message);
  }
}

/**
 * Load image from URL
 * @param {string} url - Image URL
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));

    img.src = url;
  });
}
