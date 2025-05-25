// Configuration - Replace with your OpenAI API key
const OPENAI_API_KEY = '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';

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileDisplay = document.getElementById('fileDisplay');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFile = document.getElementById('removeFile');
const summarizeBtn = document.getElementById('summarizeBtn');
const progressContainer = document.getElementById('progressContainer');
const uploadProgress = document.getElementById('uploadProgress');
const summaryContainer = document.getElementById('summaryContainer');
const documentPreview = document.getElementById('documentPreview');
const downloadPdf = document.getElementById('downloadPdf');
const downloadWord = document.getElementById('downloadWord');
const newSummaryBtn = document.getElementById('newSummaryBtn');

let uploadedFile = null;
let summaryText = '';

// Initialize drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
});

// File input change event
fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
});

// Click to browse
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// Handle file selection
function handleFile(file) {
    if (!file) return;
    
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload a PDF or Word document.');
        return;
    }
    
    uploadedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = `(${formatFileSize(file.size)})`;
    
    uploadArea.style.display = 'none';
    fileDisplay.style.display = 'block';
}

// Remove file
removeFile.addEventListener('click', () => {
    uploadedFile = null;
    fileInput.value = '';
    uploadArea.style.display = 'block';
    fileDisplay.style.display = 'none';
});

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Extract text from PDF
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let text = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        text += pageText + '\n';
    }
    
    return text;
}

// Extract text from Word document
async function extractTextFromWord(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({arrayBuffer: arrayBuffer});
    return result.value;
}

// Generate summary using OpenAI
async function generateSummary(text) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are a legal assistant specializing in creating comprehensive legal briefs. Analyze the provided document and create a detailed legal brief that includes: 1) Case Overview, 2) Key Facts, 3) Legal Issues, 4) Relevant Law and Precedents, 5) Analysis, 6) Conclusion and Recommendations. Format the output in a clear, professional manner suitable for legal professionals.'
                },
                {
                    role: 'user',
                    content: `Please create a comprehensive legal brief for the following document:\n\n${text.substring(0, 15000)}` // Limit to prevent token overflow
                }
            ],
            max_tokens: 2000,
            temperature: 0.3
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to generate summary');
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

// Summarize button click
summarizeBtn.addEventListener('click', async () => {
    if (!uploadedFile) return;
    
    fileDisplay.style.display = 'none';
    progressContainer.style.display = 'block';
    
    // Animate progress bar
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        uploadProgress.style.width = `${progress}%`;
    }, 200);
    
    try {
        // Extract text based on file type
        let text = '';
        if (uploadedFile.type === 'application/pdf') {
            text = await extractTextFromPDF(uploadedFile);
        } else {
            text = await extractTextFromWord(uploadedFile);
        }
        
        // Generate summary
        summaryText = await generateSummary(text);
        
        // Complete progress
        clearInterval(progressInterval);
        uploadProgress.style.width = '100%';
        
        // Display summary
        setTimeout(() => {
            progressContainer.style.display = 'none';
            summaryContainer.style.display = 'block';
            documentPreview.innerHTML = formatSummaryHTML(summaryText);
        }, 500);
        
    } catch (error) {
        clearInterval(progressInterval);
        alert('Error generating summary. Please check your API key and try again.');
        console.error('Error:', error);
        resetUI();
    }
});

// Format summary for display
function formatSummaryHTML(text) {
    // Convert markdown-style formatting to HTML
    return text
        .split('\n')
        .map(line => {
            if (line.startsWith('#')) {
                const level = line.match(/^#+/)[0].length;
                return `<h${level + 2}>${line.replace(/^#+\s/, '')}</h${level + 2}>`;
            }
            if (line.trim() === '') return '<br>';
            return `<p>${line}</p>`;
        })
        .join('');
}

// Download as PDF
downloadPdf.addEventListener('click', async () => {
    const { PDFDocument, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    
    // Add title
    page.drawText('Legal Brief', {
        x: 50,
        y: height - 50,
        size: 20,
        color: rgb(0, 0, 0),
    });
    
    // Add summary text (simplified - in production, use proper text wrapping)
    const lines = summaryText.split('\n');
    let yPosition = height - 100;
    
    for (const line of lines) {
        if (yPosition < 50) {
            // Add new page if needed
            const newPage = pdfDoc.addPage();
            yPosition = newPage.getSize().height - 50;
        }
        
        page.drawText(line.substring(0, 80), {
            x: 50,
            y: yPosition,
            size: 10,
            color: rgb(0, 0, 0),
        });
        yPosition -= 15;
    }
    
    const pdfBytes = await pdfDoc.save();
    downloadFile(new Blob([pdfBytes], { type: 'application/pdf' }), 'legal_brief.pdf');
});

// Download as Word
downloadWord.addEventListener('click', () => {
    // Create a simple Word document using docx library
    const doc = new docx.Document({
        sections: [{
            properties: {},
            children: [
                new docx.Paragraph({
                    text: "Legal Brief",
                    heading: docx.HeadingLevel.TITLE,
                }),
                ...summaryText.split('\n').map(line => 
                    new docx.Paragraph({
                        text: line,
                        spacing: { after: 200 },
                    })
                ),
            ],
        }],
    });
    
    docx.Packer.toBlob(doc).then(blob => {
        downloadFile(blob, 'legal_brief.docx');
    });
});

// Download file helper
function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// New summary button
newSummaryBtn.addEventListener('click', () => {
    resetUI();
});

// Reset UI
function resetUI() {
    uploadedFile = null;
    fileInput.value = '';
    summaryText = '';
    uploadArea.style.display = 'block';
    fileDisplay.style.display = 'none';
    progressContainer.style.display = 'none';
    summaryContainer.style.display = 'none';
    uploadProgress.style.width = '0';
}
