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
