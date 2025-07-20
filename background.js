/**
 * UTEC Conference Link Extractor - Background Script
 * Handles commands, notifications, and tab tracking
 */

// Store captured recording URLs with timestamps
let capturedRecordings = [];
let activeExtractionTabId = null;
let expectedRecording = null; // Track which recording we're expecting

// Listen for new tabs being created
browser.tabs.onCreated.addListener((tab) => {
    // Check if this might be a recording tab opened from our extraction tab
    if (activeExtractionTabId && tab.openerTabId === activeExtractionTabId) {
        console.log('New tab opened from extraction tab:', tab.id, 'URL:', tab.url);
        
        // Check immediately - the URL is often available right away
        if (tab.url) {
            checkAndCaptureRecordingURL(tab);
        }
        
        // Also listen for the first URL update in case it wasn't ready
        const updateListener = (tabId, changeInfo, updatedTab) => {
            if (tabId === tab.id && changeInfo.url) {
                checkAndCaptureRecordingURL(updatedTab);
                // Remove listener after first URL capture
                browser.tabs.onUpdated.removeListener(updateListener);
            }
        };
        browser.tabs.onUpdated.addListener(updateListener);
    }
});

// Listen for tab updates (URL changes)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if URL changed and it might be a recording
    if (changeInfo.url && activeExtractionTabId && tab.openerTabId === activeExtractionTabId) {
        console.log('Tab URL updated:', tabId, 'New URL:', changeInfo.url);
        checkAndCaptureRecordingURL(tab);
    }
});

// Function to check and capture recording URLs
function checkAndCaptureRecordingURL(tab) {
    if (!tab.url) return;
    
    // Check if this is a Zoom recording URL
    const isZoomRecording = 
        tab.url.includes('zoom.us/rec') || 
        tab.url.includes('utec.zoom.us') ||
        tab.url.includes('zoom.us/recording') ||
        (tab.url.includes('zoom.us') && tab.url.includes('play'));
    
    if (isZoomRecording) {
        const recording = {
            url: tab.url,
            tabId: tab.id,
            timestamp: Date.now(),
            title: tab.title || 'Recording',
            // Include all the expected data if available
            subject: expectedRecording?.subject || 'Unknown Subject',
            buttonId: expectedRecording?.buttonId || null,
            seccion: expectedRecording?.seccion || '',
            fecha: expectedRecording?.fecha || '',
            horaInicio: expectedRecording?.horaInicio || '',
            docente: expectedRecording?.docente || '',
            tipo: expectedRecording?.tipo || '',
            estado: expectedRecording?.estado || '',
            modalidad: expectedRecording?.modalidad || '',
            weekNumber: expectedRecording?.weekNumber || null
        };
        
        // Avoid duplicates
        const exists = capturedRecordings.some(r => r.url === recording.url);
        if (!exists) {
            capturedRecordings.push(recording);
            console.log('Captured recording URL:', recording.url, 'for subject:', recording.subject);
            
            // Clear the expected recording since we captured it
            expectedRecording = null;
            
            // Notify content script immediately
            if (activeExtractionTabId) {
                browser.tabs.sendMessage(activeExtractionTabId, {
                    action: 'recording-captured',
                    recording: recording
                }).catch(console.error);
            }
            
            // Show notification
            browser.notifications.create({
                type: 'basic',
                iconUrl: 'icon48.png',
                title: 'Recording Captured',
                message: `Captured: ${recording.subject}`
            });
            
            // Close the tab after capturing the URL
            if (tab.id && tab.id !== activeExtractionTabId) {
                setTimeout(() => {
                    browser.tabs.remove(tab.id).then(() => {
                        console.log('Closed tab:', tab.id);
                    }).catch(err => {
                        console.log('Could not close tab:', err);
                    });
                }, 500); // Small delay to ensure URL is fully captured
            }
        }
    }
}

// Listen for command (Ctrl+Shift+L)
browser.commands.onCommand.addListener((command) => {
    if (command === 'extract-links') {
        console.log('Extract command received');
        
        // Get active tab
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            const activeTab = tabs[0];
            
            // Check if we're on the conference domain
            if (activeTab.url && activeTab.url.includes('utec.edu.pe')) {
                // Set the active extraction tab
                activeExtractionTabId = activeTab.id;
                
                // Clear old recordings older than 5 minutes
                const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
                capturedRecordings = capturedRecordings.filter(r => r.timestamp > fiveMinutesAgo);
                
                console.log('Sending extract-links message to content script');
                
                // Send message to content script
                browser.tabs.sendMessage(activeTab.id, {
                    action: 'extract-links'
                }).then(() => {
                    console.log('Message sent successfully');
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
                    message: 'Please navigate to a UTEC page first'
                });
            }
        });
    }
});

// Listen for messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.action);
    
    if (message.action === 'show-notification') {
        browser.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: message.title,
            message: message.message
        });
        sendResponse({ success: true });
        
    } else if (message.action === 'expect-recording') {
        // Store the expected recording data for the next URL capture
        expectedRecording = message.expectedData;
        console.log('Expecting recording for:', expectedRecording.subject);
        sendResponse({ success: true });
        
    } else if (message.action === 'get-captured-recordings') {
        // Return all captured recordings
        console.log('Returning captured recordings:', capturedRecordings.length);
        sendResponse({ 
            success: true, 
            recordings: capturedRecordings 
        });
        
    } else if (message.action === 'clear-captured-recordings') {
        // Clear captured recordings for a fresh start
        capturedRecordings = [];
        expectedRecording = null;
        console.log('Cleared captured recordings');
        sendResponse({ success: true });
        
    } else if (message.action === 'close-zoom-tabs') {
        // Close all open Zoom tabs
        browser.tabs.query({}).then(tabs => {
            let closedCount = 0;
            const tabsToClose = [];
            
            tabs.forEach(tab => {
                if (tab.url && tab.url.includes('zoom.us') && tab.id !== activeExtractionTabId) {
                    tabsToClose.push(tab.id);
                }
            });
            
            // Close all Zoom tabs
            if (tabsToClose.length > 0) {
                browser.tabs.remove(tabsToClose).then(() => {
                    console.log(`Closed ${tabsToClose.length} Zoom tabs`);
                    sendResponse({ success: true, count: tabsToClose.length });
                }).catch(err => {
                    console.error('Error closing tabs:', err);
                    sendResponse({ success: false, error: err.message });
                });
            } else {
                sendResponse({ success: true, count: 0 });
            }
        });
        return true; // Keep channel open for async response
        
    } else if (message.action === 'set-extraction-tab') {
        // Update the active extraction tab
        activeExtractionTabId = sender.tab.id;
        console.log('Set extraction tab:', activeExtractionTabId);
        sendResponse({ success: true });
    }
    
    return true; // Keep message channel open for async response
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
            message: 'Use Ctrl+Shift+L on UTEC pages to extract links'
        });
    }
});

// Clean up when extraction tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
    if (tabId === activeExtractionTabId) {
        activeExtractionTabId = null;
        console.log('Extraction tab closed, clearing state');
    }
});

// Monitor web navigation for better URL capture
browser.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0 && activeExtractionTabId) { // Main frame only
        browser.tabs.get(details.tabId).then((tab) => {
            if (tab.openerTabId === activeExtractionTabId) {
                // Capture URL as soon as navigation starts
                checkAndCaptureRecordingURL({
                    ...tab,
                    url: details.url
                });
            }
        }).catch(console.error);
    }
}, {
    url: [
        { hostContains: "zoom.us" }
    ]
});

console.log('UTEC Conference Link Extractor background script loaded');
