/**
 * UTEC Conference Link Extractor - Popup Script
 */

document.addEventListener('DOMContentLoaded', function() {
    updatePopupStatus();
});

async function updatePopupStatus() {
    try {
        const runtime = typeof browser !== 'undefined' ? browser : chrome;
        // Get current active tab
        const tabs = await runtime.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        const currentDomainElement = document.getElementById('current-domain');
        const pageStatusElement = document.getElementById('page-status');
        
        if (currentTab && currentTab.url) {
            const url = new URL(currentTab.url);
            currentDomainElement.textContent = url.hostname;
            
            // Check if we're on the conference domain
            if (url.hostname === 'conference.utec.edu.pe') {
                pageStatusElement.innerHTML = `
                    <div class="success">
                        ✅ Ready to extract! You're on the conference domain.
                        <br><strong>Press Ctrl+Alt+Shift+L to start extraction.</strong>
                    </div>
                `;
            } else {
                pageStatusElement.innerHTML = `
                    <div class="warning">
                        ⚠️ Please navigate to <strong>conference.utec.edu.pe</strong> to use the extractor.
                    </div>
                `;
            }
        } else {
            currentDomainElement.textContent = 'Unknown';
            pageStatusElement.innerHTML = `
                <div class="warning">
                    ⚠️ Cannot detect current page. Please refresh and try again.
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error updating popup status:', error);
        document.getElementById('current-domain').textContent = 'Error';
        document.getElementById('page-status').innerHTML = `
            <div class="warning">
                ❌ Error checking page status. Please refresh and try again.
            </div>
        `;
    }
}
