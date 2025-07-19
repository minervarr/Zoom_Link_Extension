console.log('🚀 UTEC Conference Extractor loading...');

class UTECExtractor {
    constructor() {
        this.debugPanel = null;
        this.extractedSessions = [];
        this.isExtracting = false;
        this.logMessages = [];
        this.capturedURLs = [];
        
        this.init();
    }

    init() {
        console.log('🔥 UTEC Extractor initializing...');
        
        this.setupURLCapturing();
        
        const runtime = typeof browser !== 'undefined' ? browser : chrome;
        runtime.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📨 Message received:', message);
            if (message.action === 'extract-links') {
                this.handleExtractCommand();
                sendResponse({success: true});
            }
            return true;
        });

        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.shiftKey && event.code === 'KeyL') {
                event.preventDefault();
                console.log('🎯 KEYBOARD SHORTCUT DETECTED!');
                this.handleExtractCommand();
            }
        });

        this.log('🚀 UTEC Conference Extractor loaded successfully');
        this.log('📍 Current URL: ' + window.location.href);
        
        setTimeout(() => {
            const table = document.querySelector('.table');
            if (table) {
                const rows = table.querySelectorAll('tbody tr');
                this.log('✅ Table found with ' + rows.length + ' rows');
            } else {
                this.log('⚠️ No table found - navigate to conference page');
            }
        }, 1000);
    }

    setupURLCapturing() {
        this.capturedURLs = [];
        
        document.addEventListener('click', (event) => {
            const target = event.target.closest('button, a');
            if (target && target.id && target.id.startsWith('ver')) {
                this.log('🖱️ Recording button clicked: ' + target.id);
                setTimeout(() => {
                    this.scanForNewRecordingURLs();
                }, 2000);
            }
        }, true);

        const linkObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.scanNodeForRecordingURLs(node);
                    }
                });
            });
        });

        linkObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['href', 'src']
        });

        this.linkObserver = linkObserver;
        this.log('🔧 URL capturing system initialized (DOM-based)');
    }

    scanNodeForRecordingURLs(node) {
        try {
            if (node.tagName === 'A' && node.href) {
                this.checkAndCaptureURL(node.href);
            }
            
            if (node.querySelectorAll) {
                const links = node.querySelectorAll('a[href]');
                links.forEach(link => this.checkAndCaptureURL(link.href));
                
                const iframes = node.querySelectorAll('iframe[src]');
                iframes.forEach(iframe => this.checkAndCaptureURL(iframe.src));
            }
            
            if (node.textContent) {
                const urlMatches = node.textContent.match(/(https?:\/\/[^\s]+(?:zoom\.us\/rec|utec\.zoom\.us)[^\s]*)/g);
                if (urlMatches) {
                    urlMatches.forEach(url => this.checkAndCaptureURL(url));
                }
            }
        } catch (error) {
            // Silently handle errors
        }
    }

    scanForNewRecordingURLs() {
        try {
            const allLinks = document.querySelectorAll('a[href*="zoom.us/rec"], a[href*="utec.zoom.us"]');
            allLinks.forEach(link => this.checkAndCaptureURL(link.href));
            
            const allIframes = document.querySelectorAll('iframe[src*="zoom.us/rec"], iframe[src*="utec.zoom.us"]');
            allIframes.forEach(iframe => this.checkAndCaptureURL(iframe.src));
            
            const bodyText = document.body.textContent || '';
            const urlMatches = bodyText.match(/(https?:\/\/[^\s]+(?:zoom\.us\/rec|utec\.zoom\.us)[^\s]*)/g);
            if (urlMatches) {
                urlMatches.forEach(url => this.checkAndCaptureURL(url.trim()));
            }
            
            this.log('🔍 Scanned page, found ' + this.capturedURLs.length + ' total recording URLs');
        } catch (error) {
            this.log('⚠️ Error scanning for URLs: ' + error.message);
        }
    }

    checkAndCaptureURL(url) {
        if (url && (url.includes('zoom.us/rec') || url.includes('utec.zoom.us')) && !this.capturedURLs.includes(url)) {
            this.capturedURLs.push(url);
            this.log('🎯 Auto-captured recording URL: ' + url);
        }
    }

    async handleExtractCommand() {
        if (this.isExtracting) {
            this.log('⚠️ Extraction already in progress');
            return;
        }

        this.log('🎯 Extract command triggered!');
        this.showDebugPanel();
        await this.startExtraction();
    }

    showDebugPanel() {
        if (this.debugPanel) {
            this.debugPanel.remove();
        }

        this.debugPanel = document.createElement('div');
        this.debugPanel.id = 'utec-debug-panel';
        this.debugPanel.innerHTML = '<div class="debug-header"><h3>🔍 UTEC Conference Extractor</h3><button id="close-debug" class="close-btn">×</button></div><div class="debug-content"><div class="status-section"><div class="status-item"><span class="label">Status:</span><span id="status-text" class="status">Ready</span></div><div class="status-item"><span class="label">Sessions Found:</span><span id="sessions-count" class="count">0</span></div><div class="status-item"><span class="label">Recording Links:</span><span id="active-count" class="count">0</span></div></div><div class="log-section"><h4>📋 Extraction Log</h4><div id="log-content" class="log-content"></div></div><div class="actions-section"><button id="export-json" class="action-btn" disabled>📄 Export JSON</button><button id="collect-urls" class="action-btn">🔗 Collect URLs</button><button id="copy-log" class="action-btn">📋 Copy Log</button><button id="clear-log" class="action-btn">🗑️ Clear</button></div></div>';

        this.debugPanel.style.cssText = 'position: fixed; top: 20px; right: 20px; width: 400px; max-height: 80vh; background: #1e1e1e; border: 2px solid #007acc; border-radius: 8px; z-index: 10000; font-family: monospace; font-size: 12px; color: #ffffff; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);';

        const style = document.createElement('style');
        style.textContent = '#utec-debug-panel .debug-header { background: #007acc; padding: 10px; display: flex; justify-content: space-between; align-items: center; } #utec-debug-panel .debug-header h3 { margin: 0; font-size: 14px; color: white; } #utec-debug-panel .close-btn { background: none; border: none; color: white; font-size: 18px; cursor: pointer; } #utec-debug-panel .debug-content { padding: 15px; max-height: 60vh; overflow-y: auto; } #utec-debug-panel .status-section { margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; } #utec-debug-panel .status-item { display: flex; justify-content: space-between; margin-bottom: 5px; } #utec-debug-panel .label { color: #aaa; } #utec-debug-panel .status { color: #4CAF50; font-weight: bold; } #utec-debug-panel .count { color: #007acc; font-weight: bold; } #utec-debug-panel .log-section h4 { margin: 0 0 10px 0; color: #007acc; } #utec-debug-panel .log-content { background: #000; border: 1px solid #333; border-radius: 4px; padding: 10px; height: 200px; overflow-y: auto; font-size: 11px; line-height: 1.3; } #utec-debug-panel .actions-section { margin-top: 15px; display: flex; gap: 5px; flex-wrap: wrap; } #utec-debug-panel .action-btn { background: #007acc; border: none; color: white; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 10px; flex: 1; min-width: 80px; } #utec-debug-panel .action-btn:disabled { background: #555; cursor: not-allowed; }';
        
        document.head.appendChild(style);
        document.body.appendChild(this.debugPanel);

        document.getElementById('close-debug').addEventListener('click', () => {
            this.debugPanel.remove();
        });

        document.getElementById('export-json').addEventListener('click', () => {
            this.exportToJSON();
        });

        document.getElementById('collect-urls').addEventListener('click', () => {
            this.collectRecordingURLs();
        });

        document.getElementById('copy-log').addEventListener('click', () => {
            this.copyLogToClipboard();
        });

        document.getElementById('clear-log').addEventListener('click', () => {
            this.clearLog();
        });

        this.updateDebugPanel();
    }

    async startExtraction() {
        this.isExtracting = true;
        this.extractedSessions = [];
        this.updateStatus('🔄 Extracting...');
        
        try {
            this.log('🔍 Starting extraction process...');
            
            const currentWeek = this.getCurrentWeek();
            this.log('📅 Current week: ' + (currentWeek || 'Unknown'));
            
            await this.extractCurrentPage();
            
            this.updateStatus('✅ Extraction Complete');
            this.log('🎉 Extraction finished! Found ' + this.extractedSessions.length + ' sessions');
            
            const recordingCount = this.extractedSessions.filter(s => s.has_link).length;
            if (recordingCount > 0) {
                this.log('🎬 Found ' + recordingCount + ' recording tabs opened!');
            } else {
                this.log('📋 No recording tabs were opened');
            }
            
            const exportBtn = document.getElementById('export-json');
            if (exportBtn) exportBtn.disabled = false;
            
        } catch (error) {
            this.log('❌ Extraction failed: ' + error.message);
            this.updateStatus('❌ Failed');
        } finally {
            this.isExtracting = false;
        }
    }

    getCurrentWeek() {
        try {
            const selectors = ['input[disabled].form-control', 'input[disabled]', 'input.form-control[disabled]'];
            for (const selector of selectors) {
                const input = document.querySelector(selector);
                if (input && input.value && !isNaN(input.value)) {
                    return parseInt(input.value);
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async extractCurrentPage() {
        this.log('🔍 Looking for table...');
        
        const table = document.querySelector('.table');
        if (!table) {
            throw new Error('Table not found on current page');
        }
        
        this.log('✅ Table found');
        
        const rows = table.querySelectorAll('tbody tr');
        this.log('📋 Found ' + rows.length + ' table rows');
        
        for (let i = 0; i < rows.length; i++) {
            try {
                this.log('🔍 Processing row ' + (i + 1) + '/' + rows.length + '...');
                const session = await this.parseSessionRow(rows[i], i + 1);
                
                if (session) {
                    this.extractedSessions.push(session);
                    
                    if (session.has_link) {
                        this.log('   🎬 Row ' + (i + 1) + ': RECORDING TAB OPENED - ' + session.course);
                    } else if (session.button_id && session.button_id.startsWith('ver')) {
                        this.log('   🔴 Row ' + (i + 1) + ': DISABLED RECORDING - ' + session.course);
                    } else {
                        this.log('   📝 Row ' + (i + 1) + ': ' + session.course + ' - no recording button');
                    }
                }
                
                this.updateDebugPanel();
                await this.sleep(100);
                
            } catch (error) {
                this.log('   ❌ Row ' + (i + 1) + ': Error - ' + error.message);
            }
        }
    }

    async parseSessionRow(row, rowNumber) {
        const cells = row.querySelectorAll('td');
        
        if (cells.length < 5) {
            return null;
        }

        const session = {
            course: cells[0] ? cells[0].textContent.trim() : '',
            section: cells[1] ? cells[1].textContent.trim() : '',
            date: cells[2] ? cells[2].textContent.trim() : '',
            start_time: cells[3] ? cells[3].textContent.trim() : '',
            instructor: cells[4] ? cells[4].textContent.trim() : '',
            type: cells[5] ? cells[5].textContent.trim() : '',
            status: cells[6] ? cells[6].textContent.trim() : '',
            modality: cells[cells.length - 1] ? cells[cells.length - 1].textContent.trim() : '',
            week: this.getCurrentWeek(),
            has_link: false,
            link_url: null,
            button_id: null,
            button_enabled: false,
            extracted_at: new Date().toISOString()
        };

        const sessionKey = session.course + '-' + session.section + '-' + session.date + '-' + session.start_time;
        const alreadyProcessed = this.extractedSessions.find(s => 
            (s.course + '-' + s.section + '-' + s.date + '-' + s.start_time) === sessionKey
        );
        
        if (alreadyProcessed) {
            this.log('   🔄 Row ' + rowNumber + ': Duplicate detected, skipping');
            return null;
        }

        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const cellButtons = cell.querySelectorAll('button');
            
            for (const button of cellButtons) {
                const buttonId = button.id || '';
                
                if (buttonId.startsWith('ver')) {
                    this.log('   🎬 Recording button found: ' + buttonId);
                    
                    const buttonInfo = await this.analyzeButton(button, rowNumber, i);
                    if (buttonInfo.is_recording_button) {
                        session.has_link = buttonInfo.has_link;
                        session.link_url = buttonInfo.link_url;
                        session.button_id = buttonInfo.button_id;
                        session.button_enabled = buttonInfo.button_enabled;
                        break;
                    }
                }
            }
            
            if (session.button_id && session.button_id.startsWith('ver')) {
                break;
            }
        }

        return session;
    }

    async analyzeButton(button, rowNumber, cellIndex) {
        try {
            const buttonId = button.id || '';
            const buttonClasses = button.className || '';
            
            if (!buttonId.startsWith('ver')) {
                return { 
                    is_recording_button: false,
                    has_link: false, 
                    link_url: null, 
                    button_id: null, 
                    button_enabled: false 
                };
            }
            
            const isDisabled = button.disabled || buttonClasses.includes('disabled');
            const hasGreenIcon = this.hasGreenRecordingIcon(button);

            this.log('     🎯 Recording button: Disabled=' + isDisabled + ', Green=' + hasGreenIcon);

            if (isDisabled) {
                return {
                    is_recording_button: true,
                    has_link: false,
                    link_url: null,
                    button_id: buttonId,
                    button_enabled: false
                };
            }

            this.log('     🖱️ Clicking recording button...');
            const linkUrl = await this.extractLinkFromButton(button, rowNumber);

            return {
                is_recording_button: true,
                has_link: linkUrl !== null,
                link_url: linkUrl,
                button_id: buttonId,
                button_enabled: true
            };

        } catch (error) {
            this.log('     ❌ Error analyzing button: ' + error.message);
            return { 
                is_recording_button: false,
                has_link: false, 
                link_url: null, 
                button_id: null, 
                button_enabled: false 
            };
        }
    }

    hasGreenRecordingIcon(button) {
        const icons = button.querySelectorAll('i');
        for (const icon of icons) {
            if (icon.className && icon.className.includes('text-green')) {
                return true;
            }
        }
        return false;
    }

    async extractLinkFromButton(button, rowNumber) {
        try {
            this.log('     🎬 Extracting recording link for row ' + rowNumber + '...');
            
            // Method 1: Check for direct URL in button
            const directURL = this.getDirectURLFromButton(button);
            if (directURL) {
                this.log('     ✅ Found direct URL: ' + directURL);
                return directURL;
            }
            
            // Method 2: Simple click and wait approach
            this.log('     🖱️ Clicking button and monitoring for new tabs...');
            
            // Store current window count
            const beforeClick = Date.now();
            
            // Click the button
            button.click();
            
            // Wait and check for new tabs using a simple polling approach
            this.log('     ⏳ Waiting for recording tab to open...');
            
            for (let attempt = 0; attempt < 15; attempt++) {
                await this.sleep(1000);
                
                try {
                    // Try to communicate with background script
                    const runtime = typeof browser !== 'undefined' ? browser : chrome;
                    
                    // Use a simple promise with timeout
                    const checkPromise = new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('Background communication timeout'));
                        }, 2000);
                        
                        runtime.runtime.sendMessage({
                            action: 'get-captured-recordings'
                        }).then(response => {
                            clearTimeout(timeout);
                            resolve(response);
                        }).catch(error => {
                            clearTimeout(timeout);
                            reject(error);
                        });
                    });
                    
                    const response = await checkPromise;
                    
                    if (response && response.recordings && response.recordings.length > 0) {
                        // Check if any recording was captured after our click
                        const recentRecordings = response.recordings.filter(rec => 
                            rec.timestamp >= beforeClick
                        );
                        
                        if (recentRecordings.length > 0) {
                            const latestRecording = recentRecordings[recentRecordings.length - 1];
                            this.log('     ✅ Background captured URL: ' + latestRecording.url);
                            return latestRecording.url;
                        }
                    }
                    
                } catch (bgError) {
                    this.log('     ⚠️ Background communication failed: ' + bgError.message);
                    
                    // Fallback: Try DOM scanning
                    this.scanForNewRecordingURLs();
                    
                    if (this.capturedURLs.length > 0) {
                        const latestURL = this.capturedURLs[this.capturedURLs.length - 1];
                        this.log('     ✅ DOM scan found URL: ' + latestURL);
                        return latestURL;
                    }
                }
                
                // Log progress
                if (attempt % 3 === 0) {
                    this.log('     🔍 Still waiting for recording... (attempt ' + (attempt + 1) + '/15)');
                }
            }
            
            // Method 3: Final check for any recording URLs on the page
            this.log('     🔄 Final scan for recording URLs...');
            
            // Look for any recording links that might have appeared
            const allLinks = document.querySelectorAll('a[href*="zoom.us/rec"], a[href*="utec.zoom.us"]');
            if (allLinks.length > 0) {
                const foundURL = allLinks[0].href;
                this.log('     ✅ Found recording link on page: ' + foundURL);
                return foundURL;
            }
            
            // Check for iframes with recording content
            const allIframes = document.querySelectorAll('iframe');
            for (const iframe of allIframes) {
                try {
                    if (iframe.src && (iframe.src.includes('zoom.us/rec') || iframe.src.includes('utec.zoom.us'))) {
                        this.log('     ✅ Found recording URL in iframe: ' + iframe.src);
                        return iframe.src;
                    }
                } catch (e) {
                    // Cross-origin iframe, ignore
                }
            }
            
            // Method 4: Check if a new window was opened (basic detection)
            this.log('     🪟 Checking for new windows...');
            
            // Simple check: if the button was clicked and we're still here, 
            // assume a recording tab opened that we couldn't detect
            this.log('     💡 Button was clicked - a recording tab likely opened');
            this.log('     📝 Recording tab will need manual URL collection');
            
            return 'RECORDING_TAB_OPENED_FOR_ROW_' + rowNumber;

        } catch (error) {
            this.log('     ❌ Error extracting recording link: ' + error.message);
            return null;
        }
    }

    getDirectURLFromButton(button) {
        try {
            const onclick = button.getAttribute('onclick');
            if (onclick) {
                const urlMatch = onclick.match(/(https?:\/\/[^\s'"]+zoom\.us\/rec\/[^\s'"]+)/);
                if (urlMatch) {
                    return urlMatch[1];
                }
            }
            
            const dataAttrs = ['data-url', 'data-href', 'data-link', 'data-recording-url'];
            for (const attr of dataAttrs) {
                const value = button.getAttribute(attr);
                if (value && (value.includes('zoom.us/rec') || value.includes('utec.zoom.us'))) {
                    return value;
                }
            }
            
            const parentLink = button.closest('a[href]');
            if (parentLink && parentLink.href && (parentLink.href.includes('zoom.us/rec') || parentLink.href.includes('utec.zoom.us'))) {
                return parentLink.href;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    async collectRecordingURLs() {
        try {
            this.log('🔗 Starting manual recording URL collection...');
            
            const sessionsWithTabs = this.extractedSessions.filter(s => 
                s.link_url && s.link_url.startsWith('RECORDING_TAB_OPENED')
            );
            
            if (sessionsWithTabs.length === 0) {
                alert('No recording tabs were opened during extraction.');
                return;
            }
            
            const instructions = 'Found ' + sessionsWithTabs.length + ' recording tabs.\n\n1. Look at your browser tabs for recording URLs\n2. Copy each recording URL\n3. Match them to the courses below\n\nContinue?';
            
            if (!confirm(instructions)) {
                return;
            }
            
            let urlsCollected = 0;
            
            for (const session of sessionsWithTabs) {
                const sessionInfo = session.course + ' - ' + session.date + ' ' + session.start_time;
                const url = prompt('Paste recording URL for:\n\n' + sessionInfo + '\n\n(Cancel to skip)');
                
                if (url && (url.includes('zoom.us/rec') || url.includes('utec.zoom.us'))) {
                    session.link_url = url;
                    session.has_link = true;
                    urlsCollected++;
                    this.log('✅ URL collected for ' + session.course);
                } else if (url) {
                    this.log('⚠️ Invalid URL for ' + session.course);
                }
            }
            
            this.log('🎉 Collection complete! Updated ' + urlsCollected + ' sessions');
            this.updateDebugPanel();
            
            const exportBtn = document.getElementById('export-json');
            if (exportBtn) exportBtn.disabled = false;
            
            alert('Updated ' + urlsCollected + ' out of ' + sessionsWithTabs.length + ' sessions.\n\nYou can now export the JSON.');
            
        } catch (error) {
            this.log('❌ Error collecting URLs: ' + error.message);
        }
    }

    exportToJSON() {
        try {
            const activeSessions = this.extractedSessions.filter(s => s.has_link);
            
            const exportData = {
                extraction_info: {
                    extracted_at: new Date().toISOString(),
                    url: window.location.href,
                    total_sessions: this.extractedSessions.length,
                    active_sessions: activeSessions.length,
                    current_week: this.getCurrentWeek()
                },
                active_sessions: activeSessions,
                all_sessions: this.extractedSessions,
                debug_log: this.logMessages
            };

            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'utec_recording_extraction_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.log('💾 JSON exported successfully');

        } catch (error) {
            this.log('❌ Export failed: ' + error.message);
        }
    }

    copyLogToClipboard() {
        try {
            const logText = this.logMessages.join('\n');
            navigator.clipboard.writeText(logText).then(() => {
                this.log('📋 Log copied to clipboard!');
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = logText;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.log('📋 Log copied (fallback)');
            });
        } catch (error) {
            this.log('❌ Failed to copy log: ' + error.message);
        }
    }

    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = '[' + timestamp + '] ' + message;
        this.logMessages.push(logMessage);
        
        console.log(logMessage);
        
        const logContent = document.getElementById('log-content');
        if (logContent) {
            const messageDiv = document.createElement('div');
            messageDiv.textContent = logMessage;
            logContent.appendChild(messageDiv);
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    clearLog() {
        this.logMessages = [];
        const logContent = document.getElementById('log-content');
        if (logContent) {
            logContent.innerHTML = '';
        }
        this.log('🗑️ Log cleared');
    }

    updateStatus(status) {
        const statusText = document.getElementById('status-text');
        if (statusText) {
            statusText.textContent = status;
        }
    }

    updateDebugPanel() {
        const sessionsCount = document.getElementById('sessions-count');
        const activeCount = document.getElementById('active-count');
        
        if (sessionsCount) {
            sessionsCount.textContent = this.extractedSessions.length;
        }
        
        if (activeCount) {
            const active = this.extractedSessions.filter(s => s.has_link).length;
            activeCount.textContent = active;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const utecExtractor = new UTECExtractor();
window.utecExtractor = utecExtractor;
window.testExtraction = function() {
    console.log('🧪 Manual test triggered');
    utecExtractor.handleExtractCommand();
};

console.log('✅ UTEC Conference Extractor fully loaded!');
