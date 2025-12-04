import { jsPDF } from 'jspdf';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Generate PDF with airport charts
 * @param {string} airportId - Airport ID
 * @param {string} airportName - Airport display name
 * @returns {Promise<void>}
 */
export async function generateChartsPDF(airportId, airportName) {
  try {
    // Fetch charts list from backend
    const response = await fetch(`${API_URL}/api/airports/${airportId}/charts`);
    const data = await response.json();

    if (!data.available || data.charts.length === 0) {
      alert(data.message || 'Chart non disponibili per questo aeroporto');
      return;
    }

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    // Add title page
    pdf.setFontSize(24);
    pdf.setTextColor(41, 128, 185); // Blue color
    pdf.text(`Charts - ${airportName}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Aeroporto: ${airportId}`, pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
    pdf.text(`Totale Charts: ${data.charts.length}`, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });
    pdf.text(`Generato: ${new Date().toLocaleString('it-IT')}`, pageWidth / 2, pageHeight / 2 + 30, { align: 'center' });

    // Load and add each chart image
    for (let i = 0; i < data.charts.length; i++) {
      const chart = data.charts[i];

      try {
        // Add new page for each chart (except the first one after title page)
        pdf.addPage();

        // Load image
        const imgUrl = `${API_URL}${chart.url}`;
        const img = await loadImage(imgUrl);

        // Calculate dimensions to fit the page while maintaining aspect ratio
        const imgAspectRatio = img.width / img.height;
        const pageAspectRatio = (pageWidth - 2 * margin) / (pageHeight - 2 * margin - 15);

        let imgWidth, imgHeight;
        if (imgAspectRatio > pageAspectRatio) {
          // Image is wider, fit to width
          imgWidth = pageWidth - 2 * margin;
          imgHeight = imgWidth / imgAspectRatio;
        } else {
          // Image is taller, fit to height
          imgHeight = pageHeight - 2 * margin - 15; // Reserve space for filename
          imgWidth = imgHeight * imgAspectRatio;
        }

        // Center the image
        const x = (pageWidth - imgWidth) / 2;
        const y = margin;

        // Add image to PDF
        pdf.addImage(img, 'PNG', x, y, imgWidth, imgHeight);

        // Add filename at the bottom
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(chart.filename, pageWidth / 2, pageHeight - 5, { align: 'center' });

      } catch (error) {
        console.error(`Error loading chart ${chart.filename}:`, error);

        // Add error page
        pdf.setFontSize(14);
        pdf.setTextColor(220, 53, 69); // Red color
        pdf.text('Errore nel caricamento della chart', pageWidth / 2, pageHeight / 2, { align: 'center' });
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(chart.filename, pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
      }
    }

    // Save PDF
    const filename = `${airportId}_charts_${Date.now()}.pdf`;
    pdf.save(filename);

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
