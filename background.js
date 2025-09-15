chrome.runtime.onInstalled.addListener(() => {
  console.log('Class Schedule Countdown Extension Installed');
});

/* the code below opens a different page depening on whether output.json exists or not */

// background.js

// Core function to update popup based on storage state
function updatePopup() {
    chrome.storage.local.get(['parsedIcsData', 'timetableConfirmed'], (data) => {
      try {
        let popupPath;
        if (!data.parsedIcsData) {
          popupPath = 'landing-page/landing.html';
        } else if (!data.timetableConfirmed) {
          popupPath = 'timetable-editor/timetable-editor.html';
        } else {
          popupPath = 'popup/popup.html';
        }
        
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
        chrome.action.setPopup({ popup: 'landing-page/landing.html' });
      }
    });
}

// ================= Event Listeners =================
// Listen for the specific storage key we care about.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.parsedIcsData) updatePopup();
});

// Single runtime message listener for simple commands
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;
  if (message.type === 'storageUpdated') {
    updatePopup();
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'fetch_schedule') {
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'error') {
    console.error('Received error report:', message.error);
    sendResponse({ received: true });
    return true;
  }
});

chrome.action.onClicked.addListener(updatePopup);

chrome.runtime.onStartup.addListener(updatePopup);

// Safety check interval (every 5 minutes)
const SAFETY_CHECK_INTERVAL = 300000;
setInterval(updatePopup, SAFETY_CHECK_INTERVAL);

// Initial check
updatePopup();