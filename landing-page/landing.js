document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('ics-upload');
    const fileNameDisplay = document.getElementById('file-name');
    const parseButton = document.getElementById('upload-button');
    // Use a separate status div for messages
    let statusDiv = document.getElementById('status-message');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'status-message';
        statusDiv.className = 'hidden';
        fileNameDisplay.parentNode.insertBefore(statusDiv, fileNameDisplay.nextSibling);
    }

    parseButton.disabled = true;

    fileInput.addEventListener('change', function() {
        if (fileInput.files.length > 0) {
            fileNameDisplay.textContent = `Selected file: ${fileInput.files[0].name}`;
            fileNameDisplay.classList.remove('hidden', 'error');
            parseButton.disabled = false;
            statusDiv.textContent = '';
            statusDiv.className = 'hidden';
        } else {
            fileNameDisplay.textContent = '';
            fileNameDisplay.classList.add('hidden');
            parseButton.disabled = true;
        }
    });

    parseButton.addEventListener('click', function() {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = function(e) {
                const icsData = e.target.result;
                parseIcsData(icsData);
            };

            reader.readAsText(file);
        } else {
            statusDiv.textContent = 'Please select an ICS file first.';
            statusDiv.classList.remove('hidden', 'success');
            statusDiv.classList.add('error');
        }
    });

    // Drag and Drop Support
    const dropZone = document.body;

    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.endsWith('.ics')) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                fileNameDisplay.textContent = `Selected file: ${file.name}`;
                fileNameDisplay.classList.remove('hidden', 'error');
                parseButton.disabled = false;
                statusDiv.textContent = '';
                statusDiv.className = 'hidden';
            } else {
                statusDiv.textContent = 'Please drop a valid .ics file.';
                statusDiv.classList.remove('hidden', 'success');
                statusDiv.classList.add('error');
                parseButton.disabled = true;
            }
        }
    });

    function parseIcsData(icsData) {
        try {
            if (typeof ICAL === 'undefined' || typeof moment === 'undefined') {
                throw new Error('Required libraries (ICAL, moment) are not loaded.');
            }
            const cal = new ICAL.Component(ICAL.parse(icsData));
            const events = cal.getAllSubcomponents('vevent');
            const blacklist = ["Yr7", "Yr8", "Yr9", "Yr10", "Yr11", "Yr12"];
            function filter(input) {
                return input.split(' ').filter(word => !blacklist.includes(word)).join(' ');
            }
            const allDates = [];
            events.forEach(event => {
                const start = moment(event.getFirstPropertyValue('dtstart').toString());
                const sydneyStart = start.clone().tz('Australia/Sydney');
                allDates.push(sydneyStart);
            });
            // Use valueOf for correct sorting
            allDates.sort((a, b) => a.valueOf() - b.valueOf());
            if (allDates.length === 0) {
                statusDiv.textContent = 'No events found in the ICS file.';
                statusDiv.classList.remove('hidden', 'success');
                statusDiv.classList.add('error');
                return;
            }
            const firstDate = allDates[0];
            const lastDate = allDates[allDates.length - 1];
            const days = lastDate.diff(firstDate, 'days') + 1;
            const outputData = {};
            for (let i = 0; i < days; i++) {
                const currentDate = firstDate.clone().add(i, 'days');
                const dateString = currentDate.format('YYYY-MM-DD');
                outputData[dateString] = [];
                events.forEach(event => {
                    const startDate = moment(event.getFirstPropertyValue('dtstart').toString());
                    const sydneyStart = startDate.clone().tz('Australia/Sydney');
                    if (sydneyStart.format('YYYY-MM-DD') === dateString) {
                        const endDate = moment(event.getFirstPropertyValue('dtend').toString());
                        const sydneyEnd = endDate.clone().tz('Australia/Sydney');
                        const summary = event.getFirstPropertyValue('summary') || '';
                        const summaryParts = summary.split(': ');
                        const classInfo = summaryParts[0];
                        const name = summaryParts.length > 1 ? summaryParts[1] : '';
                        const location = event.getFirstPropertyValue('location') || '';
                        const locationParts = location.split(': ');
                        const locationValue = locationParts.length > 1 ? locationParts[1] : '';
                        const description = event.getFirstPropertyValue('description') || '';
                        const descriptionLines = description.split('\n');
                        const teacherParts = descriptionLines[0] ? descriptionLines[0].split(': ') : ['', ''];
                        const periodParts = descriptionLines.length > 1 && descriptionLines[1] ? descriptionLines[1].split(': ') : ['', ''];
                        const teacher = teacherParts.length > 1 ? teacherParts[1] : '';
                        const period = periodParts.length > 1 ? periodParts[1] : '';
                        outputData[dateString].push({
                            "c": classInfo,
                            "n": filter(name),
                            "l": locationValue,
                            "t": teacher,
                            "p": period,
                            "s": sydneyStart.format('HH:mm'),
                            "e": sydneyEnd.format('HH:mm')
                        });
                    }
                });
                outputData[dateString].sort((a, b) => a.s.localeCompare(b.s));
            }
            const outputText = JSON.stringify(outputData);
            chrome.storage.local.set({ 'parsedIcsData': outputText }, function() {
                statusDiv.textContent = 'ICS data successfully parsed and stored!';
                statusDiv.classList.remove('error', 'hidden');
                statusDiv.classList.add('success');
                chrome.runtime.sendMessage({ type: 'storageUpdated' });
                console.log(`Parsed ICS data stored (${outputText.length} characters)`);
                window.location.href = '../popup/popup.html';
            });
        } catch (error) {
            statusDiv.textContent = 'Error parsing ICS file: ' + error.message;
            statusDiv.classList.remove('hidden', 'success');
            statusDiv.classList.add('error');
            console.error('Error parsing ICS file:', error);
        }
    }
});