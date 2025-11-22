/**
 * UTEC Conference Link Extractor - Popup Script
 */

document.addEventListener('DOMContentLoaded', function() {
    updatePopupStatus();
    setupExtractionButton();
});

function setupExtractionButton() {
    const runtime = typeof browser !== 'undefined' ? browser : chrome;
    const extractBtn = document.getElementById('start-extraction');

    if (extractBtn) {
        extractBtn.onclick = async () => {
            try {
                const tabs = await runtime.tabs.query({ active: true, currentWindow: true });
                const currentTab = tabs[0];

                if (currentTab && currentTab.url && currentTab.url.includes('utec.edu.pe')) {
                    // Send message to content script to show mode selection
                    await runtime.tabs.sendMessage(currentTab.id, {
                        action: 'extract-links'
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

async function updatePopupStatus() {
    try {
        const runtime = typeof browser !== 'undefined' ? browser : chrome;
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
                    <div class="success">
                        ✅ Ready to extract! You're on the conference domain.
                    </div>
                `;
                if (extractBtn) extractBtn.disabled = false;
            } else {
                pageStatusElement.innerHTML = `
                    <div class="warning">
                        ⚠️ Please navigate to <strong>conference.utec.edu.pe</strong> to use the extractor.
                    </div>
                `;
                if (extractBtn) extractBtn.disabled = true;
            }
        } else {
            currentDomainElement.textContent = 'Unknown';
            pageStatusElement.innerHTML = `
                <div class="warning">
                    ⚠️ Cannot detect current page. Please refresh and try again.
                </div>
            `;
            if (extractBtn) extractBtn.disabled = true;
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
