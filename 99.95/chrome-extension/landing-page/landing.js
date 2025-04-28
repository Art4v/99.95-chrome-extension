const fileInput = document.getElementById('ics-upload');
const fileNameDisplay = document.getElementById('file-name');

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.name.toLowerCase().endsWith('.ics')) {
            fileNameDisplay.textContent = `Selected: ${file.name}`;
            fileNameDisplay.classList.remove('hidden');
            fileNameDisplay.classList.remove('error');
        } else {
            fileNameDisplay.textContent = 'Error: Please upload a valid .ics file.';
            fileNameDisplay.classList.remove('hidden');
            fileNameDisplay.classList.add('error');
            fileInput.value = ''; // clear the invalid file
        }
    } else {
        fileNameDisplay.textContent = '';
        fileNameDisplay.classList.add('hidden');

    }
});


document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('ics-upload');
    if (!fileInput) {
        console.error("Element with id 'ics-upload' not found.");
        return;
    }

    fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const fileContent = e.target.result;
            chrome.storage.local.set({ ical: fileContent }, () => {
                console.log('ICS file saved as ical');
                chrome.runtime.sendMessage({ type: 'storageUpdated' });
            });
        };
        reader.readAsText(file);
    });
});
