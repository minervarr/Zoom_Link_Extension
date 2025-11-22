/**
 * UTEC Conference Link Extractor - Popup Script
 * Handles popup UI, tab navigation, and settings management
 */

// Default settings
const DEFAULT_SETTINGS = {
    autoDownload: true,
    includeMetadata: true,
    autoCloseTabs: true,
    autoCloseWeekTabs: true,
    showNotifications: true,
    debugMode: false,
    useWeekRange: false,
    weekFrom: 15,
    weekTo: 1
};

// Current settings
let currentSettings = { ...DEFAULT_SETTINGS };

// Detected week from the conference page
let detectedWeek = null;

// Browser API compatibility
const runtime = typeof browser !== 'undefined' ? browser : chrome;
const storage = runtime.storage?.local || runtime.storage?.sync;

document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    loadSettings();
    updatePopupStatus();
    setupExtractionButton();
    setupSettingsListeners();
    detectCurrentWeek();
});

/**
 * Initialize tab navigation
 */
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Update button states
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content visibility
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        if (storage) {
            const result = await storage.get('utecExtractorSettings');
            if (result.utecExtractorSettings) {
                currentSettings = { ...DEFAULT_SETTINGS, ...result.utecExtractorSettings };
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }

    // Update UI to reflect current settings
    updateSettingsUI();
}

/**
 * Save settings to storage
 */
async function saveSettings() {
    try {
        if (storage) {
            await storage.set({ utecExtractorSettings: currentSettings });

            // Also notify background script about settings change
            runtime.runtime.sendMessage({
                action: 'settings-updated',
                settings: currentSettings
            }).catch(() => {}); // Ignore if background not ready
        }
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

/**
 * Update settings UI to reflect current values
 */
function updateSettingsUI() {
    document.getElementById('setting-auto-download').checked = currentSettings.autoDownload;
    document.getElementById('setting-include-metadata').checked = currentSettings.includeMetadata;
    document.getElementById('setting-auto-close-tabs').checked = currentSettings.autoCloseTabs;
    document.getElementById('setting-auto-close-week-tabs').checked = currentSettings.autoCloseWeekTabs;
    document.getElementById('setting-show-notifications').checked = currentSettings.showNotifications;
    document.getElementById('setting-debug-mode').checked = currentSettings.debugMode;

    // Week range settings
    document.getElementById('setting-use-week-range').checked = currentSettings.useWeekRange;
    document.getElementById('setting-week-from').value = currentSettings.weekFrom;
    document.getElementById('setting-week-to').value = currentSettings.weekTo;

    // Show/hide week range inputs based on toggle
    const weekRangeInputs = document.getElementById('week-range-inputs');
    if (currentSettings.useWeekRange) {
        weekRangeInputs.classList.add('active');
    } else {
        weekRangeInputs.classList.remove('active');
    }
}

/**
 * Setup settings toggle listeners
 */
function setupSettingsListeners() {
    // Auto-download
    document.getElementById('setting-auto-download').addEventListener('change', (e) => {
        currentSettings.autoDownload = e.target.checked;
        saveSettings();
    });

    // Include metadata
    document.getElementById('setting-include-metadata').addEventListener('change', (e) => {
        currentSettings.includeMetadata = e.target.checked;
        saveSettings();
    });

    // Auto-close Zoom tabs
    document.getElementById('setting-auto-close-tabs').addEventListener('change', (e) => {
        currentSettings.autoCloseTabs = e.target.checked;
        saveSettings();
    });

    // Auto-close week tabs
    document.getElementById('setting-auto-close-week-tabs').addEventListener('change', (e) => {
        currentSettings.autoCloseWeekTabs = e.target.checked;
        saveSettings();
    });

    // Show notifications
    document.getElementById('setting-show-notifications').addEventListener('change', (e) => {
        currentSettings.showNotifications = e.target.checked;
        saveSettings();
    });

    // Debug mode
    document.getElementById('setting-debug-mode').addEventListener('change', (e) => {
        currentSettings.debugMode = e.target.checked;
        saveSettings();
    });

    // Week range toggle
    document.getElementById('setting-use-week-range').addEventListener('change', (e) => {
        currentSettings.useWeekRange = e.target.checked;
        const weekRangeInputs = document.getElementById('week-range-inputs');
        if (e.target.checked) {
            weekRangeInputs.classList.add('active');
        } else {
            weekRangeInputs.classList.remove('active');
        }
        saveSettings();
    });

    // Week from input
    document.getElementById('setting-week-from').addEventListener('change', (e) => {
        const value = parseInt(e.target.value) || 15;
        currentSettings.weekFrom = Math.max(1, Math.min(20, value));
        e.target.value = currentSettings.weekFrom;
        saveSettings();
    });

    // Week to input
    document.getElementById('setting-week-to').addEventListener('change', (e) => {
        const value = parseInt(e.target.value) || 1;
        currentSettings.weekTo = Math.max(1, Math.min(20, value));
        e.target.value = currentSettings.weekTo;
        saveSettings();
    });

    // Reset settings
    document.getElementById('reset-settings').addEventListener('click', async () => {
        currentSettings = { ...DEFAULT_SETTINGS };
        updateSettingsUI();
        await saveSettings();

        // Show brief feedback
        const resetBtn = document.getElementById('reset-settings');
        const originalText = resetBtn.textContent;
        resetBtn.textContent = 'Settings reset!';
        setTimeout(() => {
            resetBtn.textContent = originalText;
        }, 1500);
    });

    // Help link
    document.getElementById('help-link').addEventListener('click', (e) => {
        e.preventDefault();
        // Switch to main tab and show help info
        alert('UTEC Extractor v1.5.0\n\nShortcuts:\n• Ctrl+Shift+L: Full automatic extraction\n\nModes:\n• Single Week: Extract current week only\n• All Weeks: Extract all weeks (or custom range)\n\nWeek Range:\n• Enable "Custom week range" in Settings\n• Set "From" and "To" weeks (e.g., 15 to 13)\n\nSettings:\n• Configure auto-download, notifications, tab behavior, and week range.');
    });
}

/**
 * Setup extraction button
 */
function setupExtractionButton() {
    const extractBtn = document.getElementById('start-extraction');

    if (extractBtn) {
        extractBtn.onclick = async () => {
            try {
                const tabs = await runtime.tabs.query({ active: true, currentWindow: true });
                const currentTab = tabs[0];

                if (currentTab && currentTab.url && currentTab.url.includes('utec.edu.pe')) {
                    // Send message to content script to show mode selection
                    // Also pass current settings
                    await runtime.tabs.sendMessage(currentTab.id, {
                        action: 'extract-links',
                        settings: currentSettings
                    });
                    // Close popup
                    window.close();
                } else {
                    alert('Please navigate to conference.utec.edu.pe first');
                }
            } catch (error) {
                console.error('Error starting extraction:', error);
                alert('Error: ' + error.message);
            }
        };
    }
}

/**
 * Update popup status display
 */
async function updatePopupStatus() {
    try {
        // Get current active tab
        const tabs = await runtime.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        const currentDomainElement = document.getElementById('current-domain');
        const pageStatusElement = document.getElementById('page-status');
        const extractBtn = document.getElementById('start-extraction');

        if (currentTab && currentTab.url) {
            const url = new URL(currentTab.url);
            currentDomainElement.textContent = url.hostname;

            // Check if we're on the conference domain
            if (url.hostname === 'conference.utec.edu.pe') {
                pageStatusElement.innerHTML = `
                    <div class="alert alert-success">
                        <span>Ready to extract! You're on the conference domain.</span>
                    </div>
                `;
                if (extractBtn) extractBtn.disabled = false;
            } else {
                pageStatusElement.innerHTML = `
                    <div class="alert alert-warning">
                        <span>Navigate to <strong>conference.utec.edu.pe</strong> to use the extractor.</span>
                    </div>
                `;
                if (extractBtn) extractBtn.disabled = true;
            }
        } else {
            currentDomainElement.textContent = 'Unknown';
            pageStatusElement.innerHTML = `
                <div class="alert alert-warning">
                    <span>Cannot detect current page. Please refresh and try again.</span>
                </div>
            `;
            if (extractBtn) extractBtn.disabled = true;
        }

    } catch (error) {
        console.error('Error updating popup status:', error);
        document.getElementById('current-domain').textContent = 'Error';
        document.getElementById('page-status').innerHTML = `
            <div class="alert alert-warning">
                <span>Error checking page status. Please refresh and try again.</span>
            </div>
        `;
    }
}

/**
 * Detect the current week from the conference page
 */
async function detectCurrentWeek() {
    try {
        const tabs = await runtime.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        if (!currentTab || !currentTab.url || !currentTab.url.includes('utec.edu.pe')) {
            return;
        }

        // Send message to content script to get current week
        const response = await runtime.tabs.sendMessage(currentTab.id, {
            action: 'get-current-week'
        });

        if (response && response.weekNumber) {
            detectedWeek = response.weekNumber;
            updateDetectedWeekUI(detectedWeek);
        }
    } catch (error) {
        console.error('Error detecting current week:', error);
    }
}

/**
 * Update UI elements with detected week
 */
function updateDetectedWeekUI(weekNumber) {
    // Update main tab week display
    const weekStatusItem = document.getElementById('week-status-item');
    const currentWeekElement = document.getElementById('current-week');
    if (weekStatusItem && currentWeekElement) {
        weekStatusItem.style.display = 'flex';
        currentWeekElement.textContent = `Week ${weekNumber}`;
    }

    // Update settings badge
    const detectedWeekBadge = document.getElementById('detected-week-badge');
    const detectedWeekValue = document.getElementById('detected-week-value');
    if (detectedWeekBadge && detectedWeekValue) {
        detectedWeekBadge.style.display = 'inline-block';
        detectedWeekValue.textContent = weekNumber;
    }

    // Update "Use detected week" button
    const useDetectedWeekBtn = document.getElementById('use-detected-week');
    const useDetectedWeekValue = document.getElementById('use-detected-week-value');
    if (useDetectedWeekBtn && useDetectedWeekValue) {
        useDetectedWeekBtn.style.display = 'inline-block';
        useDetectedWeekValue.textContent = weekNumber;
    }

    // Auto-set the "From week" to detected week if it hasn't been customized
    // Only auto-set if week range is enabled and weekFrom is still default
    const weekFromInput = document.getElementById('setting-week-from');
    if (weekFromInput) {
        // Check if user hasn't manually changed it from default
        if (currentSettings.weekFrom === DEFAULT_SETTINGS.weekFrom) {
            weekFromInput.value = weekNumber;
            currentSettings.weekFrom = weekNumber;
            saveSettings();
        }
    }

    // Add click handler for "Use detected week" button
    const useDetectedBtn = document.getElementById('use-detected-week');
    if (useDetectedBtn) {
        useDetectedBtn.onclick = () => {
            const weekFromInput = document.getElementById('setting-week-from');
            if (weekFromInput && detectedWeek) {
                weekFromInput.value = detectedWeek;
                currentSettings.weekFrom = detectedWeek;
                saveSettings();

                // Show brief feedback
                const originalText = useDetectedBtn.textContent;
                useDetectedBtn.textContent = 'Applied!';
                setTimeout(() => {
                    useDetectedBtn.innerHTML = `Use detected week (<span id="use-detected-week-value">${detectedWeek}</span>) as start`;
                }, 1000);
            }
        };
    }
}
