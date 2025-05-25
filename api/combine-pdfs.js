const { PDFDocument } = require('pdf-lib');

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For Vercel, we need to handle the multipart data manually
    const chunks = [];
    
    req.on('data', chunk => chunks.push(chunk));
    
    await new Promise((resolve, reject) => {
      req.on('end', resolve);
      req.on('error', reject);
    });
    
    const buffer = Buffer.concat(chunks);
    const boundary = req.headers['content-type'].split('boundary=')[1];
    
    // Parse multipart form data manually
    const parts = buffer.toString('binary').split(`--${boundary}`);
    const files = [];
    
    for (const part of parts) {
      if (part.includes('Content-Type: application/pdf')) {
        const headerEnd = part.indexOf('\r\n\r\n');
        const headers = part.substring(0, headerEnd);
        const filenameMatch = headers.match(/filename="(.+?)"/);
        
        if (filenameMatch) {
          const dataStart = headerEnd + 4;
          const dataEnd = part.lastIndexOf('\r\n');
          const fileData = Buffer.from(part.substring(dataStart, dataEnd), 'binary');
          files.push(fileData);
        }
      }
    }
    
    if (files.length === 0) {
      return res.status(400).json({ error: 'No PDF files found' });
    }
    
    // Create merged PDF
    const mergedPdf = await PDFDocument.create();
    
    // Add each PDF
    for (const fileData of files) {
      try {
        const pdf = await PDFDocument.load(fileData);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      } catch (err) {
        console.error('Error processing individual PDF:', err);
      }
    }
    
    // Save merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    
    // Send response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="combined.pdf"');
    res.status(200).send(Buffer.from(mergedPdfBytes));
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to combine PDFs' });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
