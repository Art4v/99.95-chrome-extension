const fileInput = document.getElementById('ics-upload');
const fileNameDisplay = document.getElementById('file-name');
let selectedFileContent = null;

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.name.toLowerCase().endsWith('.ics')) {
            fileNameDisplay.textContent = `Selected: ${file.name}`;
            fileNameDisplay.classList.remove('hidden', 'error');
            // Only read file, do not save to storage yet
            const reader = new FileReader();
            reader.onload = function(e) {
                selectedFileContent = e.target.result;
            };
            reader.readAsText(file);
        } else {
            fileNameDisplay.textContent = 'Error: Please upload a valid .ics file.';
            fileNameDisplay.classList.remove('hidden');
            fileNameDisplay.classList.add('error');
            fileInput.value = '';
            selectedFileContent = null;
        }
    } else {
        fileNameDisplay.textContent = '';
        fileNameDisplay.classList.add('hidden');
        selectedFileContent = null;
    }
});

document.getElementById('upload-button').addEventListener('click', function() {
    if (!selectedFileContent) {
        fileNameDisplay.textContent = 'Please select a valid .ics file first.';
        fileNameDisplay.classList.remove('hidden');
        fileNameDisplay.classList.add('error');
        return;
    }
    chrome.storage.local.set({ ical: selectedFileContent }, () => {
        fileNameDisplay.textContent = 'Timetable uploaded!';
        fileNameDisplay.classList.remove('error');
        fileNameDisplay.classList.add('hidden');
        chrome.runtime.sendMessage({ type: 'storageUpdated' });
    });
});