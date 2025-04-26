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