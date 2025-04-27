// This event fires as soon as the DOM is ready:
document.addEventListener("DOMContentLoaded", () => {
  console.log("[MyExtension] Popup opened at", new Date().toISOString());
});

// code for upload button
document.getElementById("saveButton").addEventListener("click", async () => {
    const fileInput  = document.getElementById("icsFileInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("No file selected!");
        return;
    }

    try {
        // store ics file as text
        const icsText = await file.text();
        await chrome.storage.local.set({ icsData: icsText });
        alert("ICS file saved successfully!");
        console.log("ICS file saved successfully!");

    } catch (error) {
        alert("Failed to save ICS file!");
    }
});

//code for read button
document.getElementById("readButton").addEventListener("click", async () => {
  try {
    // no key passed = get *all* keys
    const allData = await chrome.storage.local.get();
    console.log("📦 All chrome.storage.local data:", allData);
  } catch (err) {
    console.error("❌ Error reading storage:", err);
  }
});


// code for delete button 
document.getElementById("deleteButton").addEventListener("click", () => {
  chrome.storage.local.remove(["icsData"], () => {
    console.log("ICS data cleared from storage!");
    alert("ICS data cleared successfully!");
    console.log("ICS data cleared successfully!")
  });
});

