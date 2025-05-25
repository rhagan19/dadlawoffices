// Global variables
let uploadedFiles = [];
let sortable = null;

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileListContainer = document.getElementById('fileListContainer');
const fileList = document.getElementById('fileList');
const combineBtn = document.getElementById('combineBtn');
const clearBtn = document.getElementById('clearBtn');
const progressContainer = document.getElementById('progressContainer');
const uploadProgress = document.getElementById('uploadProgress');
const resultContainer = document.getElementById('resultContainer');
const downloadLink = document.getElementById('downloadLink');
const newSessionBtn = document.getElementById('newSessionBtn');

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
    handleFiles(e.dataTransfer.files);
});

// File input change event
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

// Click to browse
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// Handle file selection
function handleFiles(files) {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
        alert('Please upload only PDF files.');
        return;
    }
    
    if (pdfFiles.length !== files.length) {
        alert('Some files were skipped. Only PDF files are accepted.');
    }
    
    uploadedFiles = [...uploadedFiles, ...pdfFiles];
    displayFiles();
}

// Display uploaded files
function displayFiles() {
    fileList.innerHTML = '';
    
    if (uploadedFiles.length === 0) {
        fileListContainer.style.display = 'none';
        return;
    }
    
    fileListContainer.style.display = 'block';
    
    uploadedFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.dataset.index = index;
        
        li.innerHTML = `
            <span class="file-icon">📄</span>
            <span class="file-name">${file.name}</span>
            <span class="file-size">(${formatFileSize(file.size)})</span>
            <button class="remove-btn" onclick="removeFile(${index})" aria-label="Remove file">✖</button>
        `;
        
        fileList.appendChild(li);
    });
    
    // Initialize sortable
    if (sortable) {
        sortable.destroy();
    }
    
    sortable = new Sortable(fileList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function(evt) {
            const movedFile = uploadedFiles.splice(evt.oldIndex, 1)[0];
            uploadedFiles.splice(evt.newIndex, 0, movedFile);
        }
    });
}

// Remove file
function removeFile(index) {
    uploadedFiles.splice(index, 1);
    displayFiles();
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Clear all files
clearBtn.addEventListener('click', () => {
    uploadedFiles = [];
    displayFiles();
});

// Combine PDFs using client-side PDF-lib
combineBtn.addEventListener('click', async () => {
    if (uploadedFiles.length === 0) {
        alert('Please upload at least one PDF file.');
        return;
    }
    
    // Show progress
    progressContainer.style.display = 'block';
    fileListContainer.style.display = 'none';
    uploadProgress.style.width = '10%';
    
    try {
        // Create a new PDF document
        const mergedPdf = await PDFLib.PDFDocument.create();
        
        // Process each file
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            const arrayBuffer = await file.arrayBuffer();
            
            // Update progress
            const progressPercent = 10 + (80 * (i + 1) / uploadedFiles.length);
            uploadProgress.style.width = `${progressPercent}%`;
            
            // Small delay to show progress animation
            await new Promise(resolve => setTimeout(resolve, 100));
            
            try {
                // Load the PDF
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                
                // Copy all pages
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                
                // Add pages to merged document
                pages.forEach(page => mergedPdf.addPage(page));
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                alert(`Error processing ${file.name}. Skipping this file.`);
            }
        }
        
        // Save the merged PDF
        uploadProgress.style.width = '90%';
        const mergedPdfBytes = await mergedPdf.save();
        
        // Create blob and download link
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Complete progress
        uploadProgress.style.width = '100%';
        
        // Show result
        setTimeout(() => {
            progressContainer.style.display = 'none';
            resultContainer.style.display = 'block';
            downloadLink.href = url;
            downloadLink.download = 'combined_document.pdf';
        }, 500);
        
    } catch (error) {
        alert('Error combining PDFs. Please try again.');
        console.error('Error:', error);
        resetUI();
    }
});

// Start new session
newSessionBtn.addEventListener('click', () => {
    resetUI();
    uploadedFiles = [];
    fileInput.value = '';
});

// Reset UI
function resetUI() {
    progressContainer.style.display = 'none';
    resultContainer.style.display = 'none';
    fileListContainer.style.display = 'none';
    uploadProgress.style.width = '0';
}
