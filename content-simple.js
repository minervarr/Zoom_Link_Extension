/**
 * UTEC Conference Link Extractor - Enhanced Background Script
 * Handles commands, notifications, and tab tracking
 */

// Store captured recording URLs with timestamps
let capturedRecordings = [];
let activeExtractionTabId = null;

// Listen for new tabs being created
browser.tabs.onCreated.addListener((tab) => {
    // Check if this might be a recording tab
    if (activeExtractionTabId && tab.openerTabId === activeExtractionTabId) {
        console.log('New tab opened from extraction tab:', tab.id);
        
        // Wait a bit for the URL to load
        setTimeout(() => {
            browser.tabs.get(tab.id).then((updatedTab) => {
                checkAndCaptureRecordingURL(updatedTab);
            }).catch(console.error);
        }, 500);
    }
});

// Listen for tab updates (URL changes)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if URL changed and it might be a recording
    if (changeInfo.url) {
        checkAndCaptureRecordingURL(tab);
    }
});

// Function to check and capture recording URLs
function checkAndCaptureRecordingURL(tab) {
    if (tab.url && (tab.url.includes('zoom.us/rec') || tab.url.includes('utec.zoom.us'))) {
        const recording = {
            url: tab.url,
            tabId: tab.id,
            timestamp: Date.now(),
            title: tab.title || 'Recording'
        };
        
        // Avoid duplicates
        const exists = capturedRecordings.some(r => r.url === recording.url);
        if (!exists) {
            capturedRecordings.push(recording);
            console.log('Captured recording URL:', recording.url);
            
            // Notify content script immediately
            if (activeExtractionTabId) {
                browser.tabs.sendMessage(activeExtractionTabId, {
                    action: 'recording-captured',
                    recording: recording
                }).catch(console.error);
            }
        }
    }
}

// Listen for command (Ctrl+Shift+L)
browser.commands.onCommand.addListener((command) => {
    if (command === 'extract-links') {
        // Get active tab
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            const activeTab = tabs[0];
            
            // Check if we're on the conference domain
            if (activeTab.url && activeTab.url.includes('conference.utec.edu.pe')) {
                // Set the active extraction tab
                activeExtractionTabId = activeTab.id;
                
                // Clear old recordings older than 5 minutes
                const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
                capturedRecordings = capturedRecordings.filter(r => r.timestamp > fiveMinutesAgo);
                
                // Send message to content script
                browser.tabs.sendMessage(activeTab.id, {
                    action: 'extract-links'
                }).catch((error) => {
                    console.error('Failed to send message to content script:', error);
                    // Show notification if content script not ready
                    browser.notifications.create({
                        type: 'basic',
                        iconUrl: 'icon48.png',
                        title: 'UTEC Extractor',
                        message: 'Please refresh the page and try again'
                    });
                });
            } else {
                // Show notification that we're not on the right domain
                browser.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon48.png',
                    title: 'UTEC Extractor',
                    message: 'Please navigate to conference.utec.edu.pe first'
                });
            }
        });
    }
});

// Listen for messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'show-notification') {
        browser.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: message.title,
            message: message.message
        });
    } else if (message.action === 'get-captured-recordings') {
        // Return all captured recordings
        sendResponse({ 
            success: true, 
            recordings: capturedRecordings 
        });
    } else if (message.action === 'clear-captured-recordings') {
        // Clear captured recordings for a fresh start
        capturedRecordings = [];
        sendResponse({ success: true });
    } else if (message.action === 'set-extraction-tab') {
        // Update the active extraction tab
        activeExtractionTabId = sender.tab.id;
        sendResponse({ success: true });
    }
    
    return true;
});

// Handle extension installation
browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('UTEC Conference Link Extractor installed');
        
        // Show welcome notification
        browser.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: 'UTEC Extractor Installed',
            message: 'Use Ctrl+Shift+L on conference.utec.edu.pe to extract links'
        });
    }
});

// Clean up when extraction tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeExtractionTabId) {
        activeExtractionTabId = null;
    }
});
