/**
 * UTEC Conference Link Extractor - Content Script
 * Runs on conference.utec.edu.pe pages to extract and click recording links
 */

console.log('UTEC Conference Extractor content script loaded');

// Wait for page to be fully loaded before setting up
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    console.log('UTEC Extractor initialized. Current URL:', window.location.href);
    console.log('Page title:', document.title);
    
    // Check if there are any buttons with "ver" in their ID
    setTimeout(() => {
        const verButtons = document.querySelectorAll('button[id*="ver"]');
        console.log('Found buttons with "ver" in ID:', verButtons.length);
        if (verButtons.length > 0) {
            console.log('Sample button:', verButtons[0].outerHTML);
        }
    }, 1000);
}

// Store extracted conference data
let extractedData = [];
let debugPanel = null;

// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extract-links') {
        console.log('Received extract-links command');
        performExtraction();
    } else if (message.action === 'recording-captured') {
        console.log('Recording captured:', message.recording);
        updateDebugPanel();
    }
});

// Main extraction function
async function performExtraction() {
    try {
        console.log('Starting extraction process...');
        
        // Clear any existing data
        extractedData = [];
        
        // Get the week number
        const weekNumber = getWeekNumber();
        console.log('Week number:', weekNumber);
        
        // Notify background script that this is the extraction tab
        browser.runtime.sendMessage({ action: 'set-extraction-tab' });
        
        // Clear previous recordings
        await browser.runtime.sendMessage({ action: 'clear-captured-recordings' });
        
        // Show debug panel
        showDebugPanel();
        
        // Find all recording buttons immediately - no need to wait
        const recordingButtons = findRecordingButtons();
        
        if (recordingButtons.length === 0) {
            console.log('No available recording buttons found.');
            updateDebugPanel('No available recordings found on this page. Only green recording buttons can be clicked.');
            return;
        }
        
        updateDebugPanel(`Found ${recordingButtons.length} available recording(s) for Week ${weekNumber || 'Unknown'}. Extracting...`);
        
        // First, collect all the subject info and button IDs
        recordingButtons.forEach((button, index) => {
            const subjectData = extractSubjectInfo(button);
            const data = {
                index: index,
                ...subjectData,
                buttonId: button.id,
                timestamp: Date.now(),
                weekNumber: weekNumber
            };
            extractedData.push(data);
            console.log('Prepared data:', data);
        });
        
        // Now click each button with proper tracking
        for (let i = 0; i < recordingButtons.length; i++) {
            const button = recordingButtons[i];
            const data = extractedData[i];
            
            updateDebugPanel(`Opening recording ${i + 1}/${recordingButtons.length}: ${data.subject}`);
            
            // Add a marker to help track which recording corresponds to which subject
            // Store the expected subject in the background script before clicking
            await browser.runtime.sendMessage({ 
                action: 'expect-recording',
                expectedData: data
            });
            
            // Click the button
            console.log('Clicking button:', button.id);
            button.click();
            
            // Small delay just to avoid overwhelming the browser with too many tabs at once
            await sleep(500);
        }
        
        updateDebugPanel('All recordings opened. Collecting URLs...');
        
        // Short wait then collect - URLs should be captured almost instantly
        setTimeout(() => {
            collectCapturedRecordings();
        }, 1000);
        
    } catch (error) {
        console.error('Extraction error:', error);
        updateDebugPanel(`Error: ${error.message}`);
    }
}

// Find all recording buttons on the page
function findRecordingButtons() {
    const buttons = [];
    
    // Find all buttons with IDs starting with "ver"
    const allButtons = document.querySelectorAll('button[id^="ver"]');
    
    allButtons.forEach(button => {
        // Skip disabled buttons
        if (button.disabled || button.classList.contains('disabled')) {
            console.log('Skipping disabled button:', button.id);
            return;
        }
        
        // Only include buttons with green icons (available recordings)
        const hasGreenIcon = button.querySelector('.icon-user-desk-1.text-green');
        
        if (hasGreenIcon) {
            buttons.push(button);
            console.log('Found available recording button:', button.id);
        } else {
            console.log('Skipping button without green icon:', button.id);
        }
    });
    
    // Log what we found for debugging
    console.log(`Found ${buttons.length} available recording buttons`);
    
    return buttons;
}

// Extract subject information from the button's context
function extractSubjectInfo(button) {
    // Initialize data object with defaults
    let data = {
        subject: 'Unknown Subject',
        seccion: '',
        fecha: '',
        horaInicio: '',
        docente: '',
        tipo: '',
        estado: '',
        modalidad: ''
    };
    
    // Look for the row that contains this button
    const row = button.closest('tr');
    if (row) {
        const cells = row.querySelectorAll('td');
        
        // Extract data from each cell based on position
        if (cells.length >= 11) {
            // Cell 0: Curso (subject)
            data.subject = cells[0]?.textContent.trim() || 'Unknown Subject';
            
            // Cell 1: Sección
            data.seccion = cells[1]?.textContent.trim() || '';
            
            // Cell 2: Fecha
            data.fecha = cells[2]?.textContent.trim() || '';
            
            // Cell 3: Hora Inicio
            data.horaInicio = cells[3]?.textContent.trim() || '';
            
            // Cell 4: Docente
            data.docente = cells[4]?.textContent.trim() || '';
            
            // Cell 5: Tipo
            data.tipo = cells[5]?.textContent.trim() || '';
            
            // Cell 6: Estado
            data.estado = cells[6]?.textContent.trim() || '';
            
            // Cell 10: Modalidad (skip cells 7-9 which are Alerta, Acciones, Asistencia)
            data.modalidad = cells[10]?.textContent.trim() || '';
        }
    }
    
    console.log('Extracted data for button', button.id, ':', data);
    return data;
}

// Get the current week number
function getWeekNumber() {
    // Look for the week input field
    const weekInput = document.querySelector('input[disabled][type="text"][class*="form-control"]');
    if (weekInput && weekInput.value) {
        const weekValue = parseInt(weekInput.value);
        if (!isNaN(weekValue)) {
            return weekValue;
        }
    }
    
    // Alternative: look for label with "Semana" and get the next input
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
        if (label.textContent.includes('Semana')) {
            const input = label.parentElement?.querySelector('input');
            if (input && input.value) {
                const weekValue = parseInt(input.value);
                if (!isNaN(weekValue)) {
                    return weekValue;
                }
            }
        }
    }
    
    return null;
}

// Collect all captured recordings from background script
async function collectCapturedRecordings() {
    try {
        const response = await browser.runtime.sendMessage({ 
            action: 'get-captured-recordings' 
        });
        
        if (response && response.recordings) {
            const recordings = response.recordings;
            
            // The recordings already have all the data
            const finalData = recordings.map((recording) => {
                return {
                    weekNumber: recording.weekNumber,
                    subject: recording.subject,
                    seccion: recording.seccion,
                    fecha: recording.fecha,
                    horaInicio: recording.horaInicio,
                    docente: recording.docente,
                    tipo: recording.tipo,
                    estado: recording.estado,
                    modalidad: recording.modalidad,
                    url: recording.url,
                    title: recording.title,
                    timestamp: recording.timestamp,
                    buttonId: recording.buttonId
                };
            });
            
            displayResults(finalData);
        }
    } catch (error) {
        console.error('Error collecting recordings:', error);
        updateDebugPanel(`Error collecting recordings: ${error.message}`);
    }
}

// Show debug panel
function showDebugPanel() {
    if (debugPanel) {
        debugPanel.remove();
    }
    
    debugPanel = document.createElement('div');
    debugPanel.id = 'utec-debug-panel';
    debugPanel.innerHTML = `
        <div style="
            position: fixed;
            top: 10px;
            right: 10px;
            width: 400px;
            max-height: 600px;
            background: white;
            border: 2px solid #007acc;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 999999;
            font-family: Arial, sans-serif;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        ">
            <div style="
                background: #007acc;
                color: white;
                padding: 10px;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span>UTEC Conference Extractor</span>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                ">×</button>
            </div>
            <div id="debug-content" style="
                padding: 15px;
                overflow-y: auto;
                flex: 1;
            ">
                <p>Starting extraction...</p>
            </div>
            <div id="debug-actions" style="
                padding: 10px;
                border-top: 1px solid #eee;
                display: none;
            ">
                <button id="export-json" style="
                    background: #007acc;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                ">Export as JSON</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(debugPanel);
}

// Update debug panel content
function updateDebugPanel(message) {
    if (!debugPanel) return;
    
    const content = debugPanel.querySelector('#debug-content');
    if (content) {
        const timestamp = new Date().toLocaleTimeString();
        content.innerHTML += `<p style="margin: 5px 0;"><span style="color: #666;">[${timestamp}]</span> ${message}</p>`;
        content.scrollTop = content.scrollHeight;
    }
}

// Display final results
function displayResults(data) {
    if (!debugPanel) return;
    
    const content = debugPanel.querySelector('#debug-content');
    const actions = debugPanel.querySelector('#debug-actions');
    
    if (content) {
        const weekNumber = data[0]?.weekNumber || 'Unknown';
        content.innerHTML = `<h3 style="margin: 0 0 10px 0;">Extraction Complete! - Week ${weekNumber}</h3>`;
        
        if (data.length === 0) {
            content.innerHTML += '<p>No recordings were captured.</p>';
        } else {
            content.innerHTML += `<p style="color: green;">Successfully captured ${data.length} recordings:</p>`;
            
            data.forEach((item, index) => {
                content.innerHTML += `
                    <div style="
                        margin: 10px 0;
                        padding: 10px;
                        background: #f5f5f5;
                        border-radius: 4px;
                        border-left: 3px solid #007acc;
                    ">
                        <strong>${index + 1}. ${item.subject}</strong><br>
                        <small style="color: #666;">
                            ${item.fecha} - ${item.horaInicio} | ${item.docente}<br>
                            ${item.seccion} | ${item.modalidad}
                        </small><br>
                        <a href="${item.url}" target="_blank" style="
                            color: #007acc;
                            text-decoration: none;
                            font-size: 12px;
                            word-break: break-all;
                        ">${item.url}</a>
                    </div>
                `;
            });
        }
        
        // Show export button and close tabs button
        if (actions && data.length > 0) {
            actions.style.display = 'block';
            actions.innerHTML = `
                <button id="export-json" style="
                    background: #007acc;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 48%;
                    margin-right: 4%;
                ">Export as JSON</button>
                <button id="close-tabs" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 48%;
                ">Close All Zoom Tabs</button>
            `;
            
            const exportBtn = actions.querySelector('#export-json');
            const closeBtn = actions.querySelector('#close-tabs');
            
            if (exportBtn) {
                exportBtn.onclick = () => exportData(data);
            }
            
            if (closeBtn) {
                closeBtn.onclick = () => closeAllZoomTabs();
            }
        }
    }
}

// Export data as JSON
function exportData(data) {
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `utec-recordings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    updateDebugPanel('Data exported successfully!');
}

// Close all Zoom tabs
async function closeAllZoomTabs() {
    try {
        const response = await browser.runtime.sendMessage({ 
            action: 'close-zoom-tabs' 
        });
        
        if (response && response.success) {
            updateDebugPanel(`Closed ${response.count} Zoom tab(s).`);
        }
    } catch (error) {
        console.error('Error closing tabs:', error);
        updateDebugPanel(`Error closing tabs: ${error.message}`);
    }
}

// Utility function for delays
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Notify that content script is ready
console.log('UTEC Conference Extractor ready. Press Ctrl+Shift+L to extract links.');
