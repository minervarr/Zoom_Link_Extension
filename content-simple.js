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
let allWeeksData = {}; // For recursive mode: { weekNumber: [recordings] }
let isRecursiveMode = false;
let periodo = ''; // Store periodo for export

// Show error panel
function showErrorPanel(message) {
    if (debugPanel) debugPanel.remove();

    debugPanel = document.createElement('div');
    debugPanel.id = 'utec-debug-panel';
    debugPanel.innerHTML = `
        <div style="
            position: fixed;
            top: 10px;
            right: 10px;
            width: 350px;
            background: white;
            border: 2px solid #dc3545;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 999999;
            font-family: Arial, sans-serif;
        ">
            <div style="
                background: #dc3545;
                color: white;
                padding: 10px;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span>Error</span>
                <button onclick="this.closest('#utec-debug-panel').remove()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                ">×</button>
            </div>
            <div style="padding: 15px;">
                <p style="margin: 0; color: #dc3545;">${message}</p>
            </div>
        </div>
    `;
    document.body.appendChild(debugPanel);
}

// Show mode selection panel
function showModeSelectionPanel() {
    if (debugPanel) debugPanel.remove();

    const weekNumber = getWeekNumber();
    periodo = getPeriodo();

    debugPanel = document.createElement('div');
    debugPanel.id = 'utec-debug-panel';
    debugPanel.innerHTML = `
        <div style="
            position: fixed;
            top: 10px;
            right: 10px;
            width: 350px;
            background: white;
            border: 2px solid #007acc;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 999999;
            font-family: Arial, sans-serif;
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
                <span>UTEC Extractor</span>
                <button onclick="this.closest('#utec-debug-panel').remove()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                ">×</button>
            </div>
            <div style="padding: 15px;">
                <p style="margin: 0 0 10px 0; color: #666;">
                    Periodo: <strong>${periodo}</strong> | Week: <strong>${weekNumber || 'Unknown'}</strong>
                </p>
                <button id="extract-single" style="
                    background: #007acc;
                    color: white;
                    border: none;
                    padding: 12px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                    margin-bottom: 10px;
                    font-size: 14px;
                ">Extract This Week Only</button>
                <button id="extract-all" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 12px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                    font-size: 14px;
                ">Extract All Weeks (${weekNumber} → 1)</button>
            </div>
        </div>
    `;
    document.body.appendChild(debugPanel);

    // Add event listeners
    document.getElementById('extract-single').onclick = () => {
        isRecursiveMode = false;
        allWeeksData = {};
        performExtraction();
    };

    document.getElementById('extract-all').onclick = () => {
        isRecursiveMode = true;
        allWeeksData = {};
        performExtraction();
    };
}

// Get periodo from page
function getPeriodo() {
    const periodoInput = document.querySelector('input.form-control[disabled]');
    if (periodoInput && periodoInput.value) {
        return periodoInput.value;
    }
    // Alternative: look for periodo label
    const inputs = document.querySelectorAll('input.form-control');
    for (const input of inputs) {
        if (input.value && input.value.match(/^\d{4}\s*-\s*\d$/)) {
            return input.value;
        }
    }
    return 'Unknown';
}

// Click "Anterior" button to go to previous week
function clickAnteriorButton() {
    const buttons = document.querySelectorAll('button.btn.btn-primary');
    for (const btn of buttons) {
        if (btn.textContent.trim() === 'Anterior') {
            btn.click();
            return true;
        }
    }
    return false;
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extract-links') {
        console.log('Received extract-links command');

        // Check if we're on the correct page
        if (!window.location.pathname.includes('/consulta-alumno')) {
            showErrorPanel('Please navigate to the "Consulta Alumno" page first.');
            return;
        }

        // Show mode selection panel
        showModeSelectionPanel();
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
            const currentWeek = getWeekNumber();

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

            if (isRecursiveMode) {
                // Store this week's data
                allWeeksData[currentWeek] = finalData;
                updateDebugPanel(`Week ${currentWeek}: Captured ${finalData.length} recording(s)`);

                // Check if we should continue to previous week
                if (currentWeek > 1) {
                    updateDebugPanel(`Moving to week ${currentWeek - 1}...`);

                    // Click Anterior and wait for page update
                    clickAnteriorButton();

                    // Wait for page to update, then continue extraction
                    await waitForWeekChange(currentWeek);

                    // Clear recordings for next week and continue
                    await browser.runtime.sendMessage({ action: 'clear-captured-recordings' });
                    extractedData = [];

                    // Continue with next week
                    performExtraction();
                } else {
                    // We've reached week 1, display all results
                    updateDebugPanel('All weeks extracted!');
                    displayAllWeeksResults();
                }
            } else {
                // Single week mode - just display results
                displayResults(finalData);
            }
        }
    } catch (error) {
        console.error('Error collecting recordings:', error);
        updateDebugPanel(`Error collecting recordings: ${error.message}`);
    }
}

// Wait for week to change after clicking Anterior
async function waitForWeekChange(previousWeek) {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            const currentWeek = getWeekNumber();
            if (currentWeek !== previousWeek) {
                clearInterval(checkInterval);
                // Additional wait for table to load
                setTimeout(resolve, 1500);
            }
        }, 500);

        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 10000);
    });
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

            // Auto-download JSON after successful extraction
            exportData(data);
        }
    }
}

// Display results for all weeks (recursive mode)
function displayAllWeeksResults() {
    if (!debugPanel) return;

    const content = debugPanel.querySelector('#debug-content');
    const actions = debugPanel.querySelector('#debug-actions');

    // Calculate totals
    let totalRecordings = 0;
    const weekNumbers = Object.keys(allWeeksData).map(Number).sort((a, b) => b - a);
    weekNumbers.forEach(week => {
        totalRecordings += allWeeksData[week].length;
    });

    if (content) {
        content.innerHTML = `<h3 style="margin: 0 0 10px 0;">All Weeks Extracted!</h3>`;
        content.innerHTML += `<p style="color: green;">Total: ${totalRecordings} recordings across ${weekNumbers.length} weeks</p>`;

        weekNumbers.forEach(week => {
            const weekData = allWeeksData[week];
            content.innerHTML += `
                <div style="
                    margin: 8px 0;
                    padding: 8px;
                    background: #f5f5f5;
                    border-radius: 4px;
                    border-left: 3px solid #28a745;
                ">
                    <strong>Week ${week}</strong>: ${weekData.length} recording(s)
                </div>
            `;
        });
    }

    if (actions && totalRecordings > 0) {
        actions.style.display = 'block';
        actions.innerHTML = `
            <button id="export-json" style="
                background: #28a745;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                width: 48%;
                margin-right: 4%;
            ">Export All as JSON</button>
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
            exportBtn.onclick = () => exportAllWeeksData();
        }

        if (closeBtn) {
            closeBtn.onclick = () => closeAllZoomTabs();
        }

        // Auto-download combined JSON
        exportAllWeeksData();
    }

    // Show final notification
    browser.runtime.sendMessage({
        action: 'show-notification',
        title: 'Extraction Complete',
        message: `Extracted ${totalRecordings} recordings from ${weekNumbers.length} weeks`
    });
}

// Export all weeks data as combined JSON
function exportAllWeeksData() {
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[now.getDay()];
    const dateStr = now.toISOString().split('T')[0];

    // Calculate totals
    let totalRecordings = 0;
    Object.values(allWeeksData).forEach(weekData => {
        totalRecordings += weekData.length;
    });

    const combinedData = {
        extractionDate: dateStr,
        extractionDay: dayName,
        periodo: periodo,
        totalRecordings: totalRecordings,
        totalWeeks: Object.keys(allWeeksData).length,
        weeks: allWeeksData
    };

    const jsonData = JSON.stringify(combinedData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = `utec-recordings-all-weeks-${periodo.replace(/\s/g, '')}-${dayName}-${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    updateDebugPanel(`Data exported as: ${filename}`);
}

// Export data as JSON (single week)
function exportData(data) {
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Build enhanced filename with week number and day name
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[now.getDay()];
    const dateStr = now.toISOString().split('T')[0];
    const weekNumber = data[0]?.weekNumber || 'unknown';

    const filename = `utec-recordings-week${weekNumber}-${dayName}-${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    updateDebugPanel(`Data exported as: ${filename}`);

    // Show final notification for single week mode
    browser.runtime.sendMessage({
        action: 'show-notification',
        title: 'Extraction Complete',
        message: `Extracted ${data.length} recordings from week ${weekNumber}`
    });
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
