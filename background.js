/**
 * UTEC Conference Link Extractor - Background Script
 * Handles commands, notifications, and tab tracking
 */

// Store captured recording URLs with timestamps
let capturedRecordings = [];
let activeExtractionTabId = null;
let expectedRecording = null; // Track which recording we're expecting

// Recursive extraction state
let recursiveExtractionState = {
    active: false,
    phase: 'idle',        // 'idle', 'duplicating', 'extracting'
    originalTabId: null,
    spawnedTabs: [],      // Track tabs we create: [{ tabId, weekNumber }]
    allRecordings: {},    // { weekNumber: [recordings] }
    startWeek: null,
    periodo: '',
    extractionQueue: [],  // Queue of tabs to extract from
    currentExtractingTab: null
};

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
        console.log('Extract command received - triggering automatic full extraction');

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

                console.log('Sending automatic-extract message to content script');

                // Send message to content script - automatic mode (shortcut = full extraction)
                browser.tabs.sendMessage(activeTab.id, {
                    action: 'automatic-extract'  // New action for shortcut - goes directly to full extraction
                }).then(() => {
                    console.log('Automatic extract message sent successfully');
                }).catch((error) => {
                    console.error('Failed to send message to content script:', error);
                });
            } else {
                console.log('Not on UTEC domain');
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

    } else if (message.action === 'start-recursive-extraction') {
        // Initialize recursive extraction state - Phase 1: Duplicating tabs
        recursiveExtractionState = {
            active: true,
            phase: 'duplicating',
            originalTabId: sender.tab.id,
            spawnedTabs: [{ tabId: sender.tab.id, weekNumber: message.currentWeek }],
            allRecordings: {},
            startWeek: message.currentWeek,
            periodo: message.periodo,
            extractionQueue: [],
            currentExtractingTab: null
        };
        console.log('Started recursive extraction - Phase 1: Duplicating from week', message.currentWeek);
        sendResponse({ success: true });

    } else if (message.action === 'duplicate-tab-for-next-week') {
        // Phase 1: Duplicate current tab to go to previous week (NO extraction yet)
        const currentTabId = sender.tab.id;
        const currentWeek = message.currentWeek;
        const targetWeek = currentWeek - 1;
        // Calculate how many Anterior clicks needed from the starting week
        // (duplicated tabs always reset to the starting week)
        const anteriorClicks = recursiveExtractionState.startWeek - targetWeek;

        browser.tabs.duplicate(currentTabId).then((newTab) => {
            console.log('Duplicated tab:', newTab.id, 'for week', targetWeek, '- needs', anteriorClicks, 'Anterior clicks');

            // Wait for the tab to be ready, then tell it to click Anterior
            const waitForTabReady = (tabId, retries = 0) => {
                browser.tabs.get(tabId).then((tab) => {
                    if (tab.status === 'complete') {
                        setTimeout(() => {
                            browser.tabs.sendMessage(tabId, {
                                action: 'navigate-to-previous-week',
                                targetWeek: targetWeek,
                                anteriorClicks: anteriorClicks,
                                startWeek: recursiveExtractionState.startWeek
                            }).catch((err) => {
                                console.error('Failed to send navigate message:', err);
                                if (retries < 5) {
                                    setTimeout(() => waitForTabReady(tabId, retries + 1), 1000);
                                }
                            });
                        }, 500);
                    } else if (retries < 10) {
                        setTimeout(() => waitForTabReady(tabId, retries + 1), 500);
                    }
                }).catch(console.error);
            };

            waitForTabReady(newTab.id);
            sendResponse({ success: true, newTabId: newTab.id });
        }).catch((err) => {
            console.error('Failed to duplicate tab:', err);
            sendResponse({ success: false, error: err.message });
        });
        return true; // Keep channel open for async

    } else if (message.action === 'register-week-tab') {
        // Register a tab for a specific week (during duplication phase)
        const weekNumber = message.weekNumber;
        recursiveExtractionState.spawnedTabs.push({
            tabId: sender.tab.id,
            weekNumber: weekNumber
        });
        console.log(`Registered tab ${sender.tab.id} for week ${weekNumber}`);
        sendResponse({ success: true });

    } else if (message.action === 'all-tabs-ready') {
        // Phase 1 complete - all tabs duplicated, now start extraction
        console.log('All tabs ready! Starting Phase 2: Extraction');
        recursiveExtractionState.phase = 'extracting';

        // Build extraction queue (from week 1 to start week)
        const sortedTabs = recursiveExtractionState.spawnedTabs
            .sort((a, b) => a.weekNumber - b.weekNumber);
        recursiveExtractionState.extractionQueue = [...sortedTabs];

        console.log('Extraction queue:', recursiveExtractionState.extractionQueue);

        // Notify original tab that extraction is starting
        browser.tabs.sendMessage(recursiveExtractionState.originalTabId, {
            action: 'extraction-phase-starting',
            totalWeeks: sortedTabs.length
        }).catch(console.error);

        // Start extracting from first tab (week 1)
        startNextExtraction();
        sendResponse({ success: true });

    } else if (message.action === 'store-week-recordings') {
        // Store recordings for a specific week
        const week = message.weekNumber;
        recursiveExtractionState.allRecordings[week] = message.recordings;
        console.log(`Stored ${message.recordings.length} recordings for week ${week}`);

        // Notify original tab of progress
        browser.tabs.sendMessage(recursiveExtractionState.originalTabId, {
            action: 'week-extraction-complete',
            weekNumber: week,
            recordingsCount: message.recordings.length
        }).catch(console.error);

        sendResponse({ success: true });

    } else if (message.action === 'tab-extraction-complete') {
        // Current tab finished extraction, move to next
        console.log('Tab extraction complete, moving to next...');
        startNextExtraction();
        sendResponse({ success: true });

    } else if (message.action === 'get-recursive-state') {
        // Return current recursive extraction state
        sendResponse({
            success: true,
            state: recursiveExtractionState
        });

    } else if (message.action === 'finish-recursive-extraction') {
        // Finish extraction and close spawned tabs
        const allRecordings = recursiveExtractionState.allRecordings;
        const spawnedTabs = recursiveExtractionState.spawnedTabs;
        const originalTabId = recursiveExtractionState.originalTabId;

        // Close all spawned tabs EXCEPT the original
        const tabsToClose = spawnedTabs
            .filter(t => t.tabId !== originalTabId)
            .map(t => t.tabId);

        if (tabsToClose.length > 0) {
            browser.tabs.remove(tabsToClose).then(() => {
                console.log(`Closed ${tabsToClose.length} spawned tabs`);
            }).catch(console.error);
        }

        // Send final results to original tab
        if (originalTabId) {
            browser.tabs.sendMessage(originalTabId, {
                action: 'display-final-results',
                allRecordings: allRecordings,
                periodo: recursiveExtractionState.periodo
            }).catch(console.error);

            // Focus back on original tab
            browser.tabs.update(originalTabId, { active: true }).catch(console.error);
        }

        // Reset state
        recursiveExtractionState = {
            active: false,
            phase: 'idle',
            originalTabId: null,
            spawnedTabs: [],
            allRecordings: {},
            startWeek: null,
            periodo: '',
            extractionQueue: [],
            currentExtractingTab: null
        };

        sendResponse({ success: true });

    } else if (message.action === 'close-spawned-tabs') {
        // Close all spawned tabs without finishing (for cleanup)
        const tabsToClose = recursiveExtractionState.spawnedTabs
            .filter(t => t.tabId !== recursiveExtractionState.originalTabId)
            .map(t => t.tabId);
        if (tabsToClose.length > 0) {
            browser.tabs.remove(tabsToClose).catch(console.error);
        }
        recursiveExtractionState.spawnedTabs = [];
        sendResponse({ success: true });
    }

    return true; // Keep message channel open for async response
});

// Handle extension installation
browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('UTEC Conference Link Extractor installed');
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

// Helper function to start extraction from next tab in queue
function startNextExtraction() {
    if (recursiveExtractionState.extractionQueue.length === 0) {
        // All tabs extracted, finish up
        console.log('All tabs extracted! Finishing...');
        browser.tabs.sendMessage(recursiveExtractionState.originalTabId, {
            action: 'all-extractions-complete'
        }).catch(console.error);

        // Trigger finish
        setTimeout(() => {
            const allRecordings = recursiveExtractionState.allRecordings;
            const spawnedTabs = recursiveExtractionState.spawnedTabs;
            const originalTabId = recursiveExtractionState.originalTabId;

            // Close all spawned tabs EXCEPT the original
            const tabsToClose = spawnedTabs
                .filter(t => t.tabId !== originalTabId)
                .map(t => t.tabId);

            if (tabsToClose.length > 0) {
                browser.tabs.remove(tabsToClose).then(() => {
                    console.log(`Closed ${tabsToClose.length} spawned tabs`);
                }).catch(console.error);
            }

            // Send final results to original tab
            if (originalTabId) {
                browser.tabs.sendMessage(originalTabId, {
                    action: 'display-final-results',
                    allRecordings: allRecordings,
                    periodo: recursiveExtractionState.periodo
                }).catch(console.error);

                browser.tabs.update(originalTabId, { active: true }).catch(console.error);
            }

            // Reset state
            recursiveExtractionState = {
                active: false,
                phase: 'idle',
                originalTabId: null,
                spawnedTabs: [],
                allRecordings: {},
                startWeek: null,
                periodo: '',
                extractionQueue: [],
                currentExtractingTab: null
            };
        }, 500);
        return;
    }

    // Get next tab from queue
    const nextTab = recursiveExtractionState.extractionQueue.shift();
    recursiveExtractionState.currentExtractingTab = nextTab;
    activeExtractionTabId = nextTab.tabId;

    console.log(`Starting extraction for week ${nextTab.weekNumber} (tab ${nextTab.tabId})`);

    // Focus on the tab and tell it to extract
    browser.tabs.update(nextTab.tabId, { active: true }).then(() => {
        setTimeout(() => {
            browser.tabs.sendMessage(nextTab.tabId, {
                action: 'extract-this-week',
                weekNumber: nextTab.weekNumber
            }).catch((err) => {
                console.error('Failed to send extract message:', err);
                // Skip this tab and move to next
                startNextExtraction();
            });
        }, 300);
    }).catch(console.error);
}

console.log('UTEC Conference Link Extractor background script loaded');
