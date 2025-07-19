/**
 * UTEC Conference Link Extractor - Background Script
 * Handles commands and notifications
 */

// Listen for command (Ctrl+Alt+Shift+L)
browser.commands.onCommand.addListener((command) => {
    if (command === 'extract-links') {
        // Get active tab
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            const activeTab = tabs[0];
            
            // Check if we're on the conference domain
            if (activeTab.url && activeTab.url.includes('conference.utec.edu.pe')) {
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
