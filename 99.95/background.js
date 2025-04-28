chrome.runtime.onInstalled.addListener(() => {
    console.log("Class Schedule Countdown Extension Installed");
});

// Example: Listen for messages (optional)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "fetch_schedule") {
        // You can add logic to interact with JSON or other backend services
        sendResponse({ success: true });
    }
});

/* the code below opens a different page depening on whether output.json exists or not */

// background.js

// Core function to update popup based on storage state
function updatePopup() {
    chrome.storage.local.get('ical', (data) => {
      try {
        const popupPath = data.ical 
          ? 'chrome-extension/popup/popup.html'
          : 'chrome-extension/landing-page/landing.html';

        chrome.action.setPopup({ popup: popupPath });
        
        // Safe message passing with error handling
        chrome.runtime.sendMessage({ type: 'popupUpdate' }, (response) => {
          if (chrome.runtime.lastError) {
            // Expected error when no receivers - not critical
            console.debug('No active receivers:', chrome.runtime.lastError.message);
          }
        });
        
      } catch (error) {
        console.error('Popup update failed:', error);
        chrome.action.setPopup({ popup: 'assets/landing.html' });
      }
    });
}

// ================= Event Listeners =================
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'ical' in changes) updatePopup();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'storageUpdated') updatePopup();
});

chrome.action.onClicked.addListener(updatePopup);

// ================= Error Handling =================
// Handle message errors globally
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'error') {
    console.error('Received error report:', message.error);
  }
});

// ================= Initialization =================
chrome.runtime.onStartup.addListener(updatePopup);
chrome.runtime.onInstalled.addListener(updatePopup);

// Safety check interval (every 5 minutes)
const SAFETY_CHECK_INTERVAL = 300000;
setInterval(updatePopup, SAFETY_CHECK_INTERVAL);

// Initial check with error suppression
try {
  updatePopup();
} catch (error) {
  console.debug('Initialization error:', error.message);
}