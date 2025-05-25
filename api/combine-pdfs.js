// api/combine-pdfs.js
const { PDFDocument } = require('pdf-lib');
const { formidable } = require('formidable'); // Note the destructuring here
const fs = require('fs').promises;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  console.log('Request method:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting PDF combination process...');
    
    // Parse the multipart form data
    const form = formidable({
      multiples: true,
      keepExtensions: true,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Form parse error:', err);
          reject(err);
        }
        else {
          console.log('Fields:', fields);
          console.log('Files:', files);
          resolve([fields, files]);
        }
      });
    });
    
    // Get the PDFs - handle both single and multiple files
    let pdfFiles = files.pdfs;
    if (!Array.isArray(pdfFiles)) {
      pdfFiles = pdfFiles ? [pdfFiles] : [];
    }
    
    if (pdfFiles.length === 0) {
      return res.status(400).json({ error: 'No PDF files uploaded' });
    }
    
    // Extract order information
    const fileOrder = [];
    Object.keys(fields).forEach(key => {
      if (key.startsWith('order_')) {
        const index = parseInt(key.split('_')[1]);
        const order = parseInt(Array.isArray(fields[key]) ? fields[key][0] : fields[key]);
        fileOrder[order] = index;
      }
    });

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Process PDFs in the specified order
    for (let i = 0; i < fileOrder.length; i++) {
      const fileIndex = fileOrder[i];
      const file = pdfFiles[fileIndex];
      
      if (!file || !file.filepath) {
        console.error('Missing file at index:', fileIndex);
        continue;
      }
      
      try {
        // Read the PDF file
        const pdfBytes = await fs.readFile(file.filepath);
        const pdf = await PDFDocument.load(pdfBytes);
        
        // Copy all pages from the current PDF
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (error) {
        console.error('Error processing PDF:', file.originalFilename, error);
      }
    }

    // Serialize the merged PDF
    const mergedPdfBytes = await mergedPdf.save();

    // Clean up temporary files
    await Promise.all(pdfFiles.map(file => 
      fs.unlink(file.filepath).catch(err => console.error('Error deleting temp file:', err))
    ));

    // Send the merged PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="combined_document.pdf"');
    res.status(200).send(Buffer.from(mergedPdfBytes));
    
  } catch (error) {
    console.error('Error combining PDFs:', error);
    res.status(500).json({ error: 'Failed to combine PDFs', details: error.message });
  }
}
