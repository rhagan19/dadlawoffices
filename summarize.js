// Configuration - Replace with your OpenAI API key
const OPENAI_API_KEY = 'your-openai-api-key-here';

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
    // Split into sections and format
    const sections = text.split(/\*\*(\d+\)|[0-9]+\.)\s*/);
    let html = '<div style="padding: 20px;">';
    
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();
        if (!section) continue;
        
        // Check if this is a header
        if (section.includes('Case Overview') || 
            section.includes('Key Facts') || 
            section.includes('Legal Issues') || 
            section.includes('Relevant Law') || 
            section.includes('Analysis') || 
            section.includes('Conclusion')) {
            
            // Extract the header and content
            const lines = section.split('\n');
            const header = lines[0].replace(/\*\*/g, '');
            html += `<h4 style="margin-top: 20px; margin-bottom: 10px; color: #000;">${header}</h4>`;
            
            // Add the rest as paragraphs
            for (let j = 1; j < lines.length; j++) {
                if (lines[j].trim()) {
                    html += `<p style="margin-bottom: 10px; text-align: justify;">${lines[j].trim()}</p>`;
                }
            }
        } else {
            // Regular paragraph
            const paragraphs = section.split('\n');
            paragraphs.forEach(para => {
                if (para.trim()) {
                    html += `<p style="margin-bottom: 10px; text-align: justify;">${para.trim()}</p>`;
                }
            });
        }
    }
    
    html += '</div>';
    return html;
}

// Download as PDF
downloadPdf.addEventListener('click', async () => {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    
    // Embed font
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const margin = 50;
    const lineHeight = 20;
    const maxWidth = width - 2 * margin;
    let yPosition = height - margin;
    
    // Add title
    page.drawText('Legal Brief', {
        x: margin,
        y: yPosition,
        size: 24,
        font: timesRomanBold,
        color: rgb(0, 0, 0),
    });
    yPosition -= 40;
    
    // Split text into lines and paragraphs
    const paragraphs = summaryText.split('\n');
    
    for (const paragraph of paragraphs) {
        if (paragraph.trim() === '') {
            yPosition -= lineHeight;
            continue;
        }
        
        // Check if it's a heading
        const isHeading = paragraph.includes('Case Overview') || 
                         paragraph.includes('Key Facts') || 
                         paragraph.includes('Legal Issues') || 
                         paragraph.includes('Relevant Law') || 
                         paragraph.includes('Analysis') || 
                         paragraph.includes('Conclusion');
        
        const font = isHeading ? timesRomanBold : timesRoman;
        const fontSize = isHeading ? 14 : 11;
        
        // Wrap text
        const words = paragraph.split(' ');
        let line = '';
        
        for (const word of words) {
            const testLine = line + word + ' ';
            const textWidth = font.widthOfTextAtSize(testLine, fontSize);
            
            if (textWidth > maxWidth && line !== '') {
                // Check if we need a new page
                if (yPosition < margin + lineHeight) {
                    page = pdfDoc.addPage();
                    yPosition = height - margin;
                }
                
                page.drawText(line.trim(), {
                    x: margin,
                    y: yPosition,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0),
                });
                yPosition -= lineHeight;
                line = word + ' ';
            } else {
                line = testLine;
            }
        }
        
        // Draw remaining text
        if (line.trim() !== '') {
            if (yPosition < margin + lineHeight) {
                page = pdfDoc.addPage();
                yPosition = height - margin;
            }
            
            page.drawText(line.trim(), {
                x: margin,
                y: yPosition,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
            });
            yPosition -= lineHeight;
        }
        
        // Add extra space after headings
        if (isHeading) {
            yPosition -= 10;
        }
    }
    
    const pdfBytes = await pdfDoc.save();
    downloadFile(new Blob([pdfBytes], { type: 'application/pdf' }), 'legal_brief.pdf');
});

// Download as Word
downloadWord.addEventListener('click', () => {
    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
    
    // Parse the summary text into sections
    const sections = summaryText.split('\n');
    const children = [
        new Paragraph({
            text: "Legal Brief",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
        }),
    ];
    
    // Add each section
    sections.forEach(section => {
        const trimmedSection = section.trim();
        if (!trimmedSection) {
            children.push(new Paragraph({ text: "" }));
            return;
        }
        
        // Check if it's a heading
        const isHeading = trimmedSection.includes('Case Overview') || 
                         trimmedSection.includes('Key Facts') || 
                         trimmedSection.includes('Legal Issues') || 
                         trimmedSection.includes('Relevant Law') || 
                         trimmedSection.includes('Analysis') || 
                         trimmedSection.includes('Conclusion');
        
        if (isHeading) {
            children.push(
                new Paragraph({
                    text: trimmedSection.replace(/\*\*/g, ''),
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 240, after: 120 },
                })
            );
        } else {
            children.push(
                new Paragraph({
                    text: trimmedSection,
                    spacing: { after: 200 },
                    alignment: AlignmentType.JUSTIFIED,
                })
            );
        }
    });
    
    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });
    
    Packer.toBlob(doc).then(blob => {
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
