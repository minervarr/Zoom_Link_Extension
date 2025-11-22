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
    debugMode: false
};

// Current settings
let currentSettings = { ...DEFAULT_SETTINGS };

// Browser API compatibility
const runtime = typeof browser !== 'undefined' ? browser : chrome;
const storage = runtime.storage?.local || runtime.storage?.sync;

document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    loadSettings();
    updatePopupStatus();
    setupExtractionButton();
    setupSettingsListeners();
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
        alert('UTEC Extractor v1.3.0\n\nShortcuts:\n• Ctrl+Shift+L: Full automatic extraction\n\nModes:\n• Single Week: Extract current week only\n• All Weeks: Extract all weeks (1 to current)\n\nSettings:\n• Configure auto-download, notifications, and tab behavior in the Settings tab.');
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
