document.addEventListener('DOMContentLoaded', function() {

    const modal = document.getElementById('user-selection-modal');
    const macBtn = document.getElementById('mac-user');
    const winBtn = document.getElementById('windows-user');
    const uploadContainer = document.querySelector('.upload-container');
    const instructionsList = document.getElementById('instructions-list');
    const uploadOptions = document.getElementById('upload-options');
    const uploadBtn = document.getElementById('upload-button');
    const statusDiv = document.getElementById('status-message');
    const changePlatform = document.getElementById('change-platform');


    const macInstructions = `
        <ol>
            <li>Log in to Sentral.</li>
            <li>Go to your timetable page and click <strong>Export as ICS</strong> (usually at the top right of the timetable).</li>
            <li>Save the downloaded timetable file to your computer.</li>
            <li><strong>To upload your timetable:</strong>
                <ul><li>Drag and drop the ICS file anywhere on this page.</li></ul>
            </li>
            <li>Click <strong>Upload Timetable</strong> to finish.</li>
        </ol>`;
    const winInstructions = `
        <ol>
            <li>Log in to Sentral.</li>
            <li>Go to your timetable page and click <strong>Export as ICS</strong> (usually at the top right of the timetable).</li>
            <li>Save the downloaded timetable file to your computer.</li> 
            <li><strong>To upload your timetable:</strong>
                <ul>
                    <li>Click anywhere in the upload box below and select your downloaded ICS file, <em>or</em></li>
                    <li>Drag and drop the ICS file anywhere on this page.</li>
                </ul>
            </li>
            <li>Click <strong>Upload Timetable</strong> to finish.</li>
        </ol>`;


    function macUploadOption() {
        return `<div class="drag-drop-area" id="drag-drop-area" tabindex="0">
            <div>Drag and drop your timetable file here</div>
            <div class="file-feedback" id="file-feedback"></div>
            <input type="file" id="ics-upload" class="hidden" accept=".ics">
        </div>`;
    }
    function winUploadOption() {
        return `<div class="drag-drop-area clickable" id="drag-drop-area" tabindex="0" role="button" aria-label="Click to select ICS file or drag and drop">
            <div>Click to choose file or drag and drop your timetable file here</div>
            <div class="file-feedback" id="file-feedback"></div>
            <input type="file" id="ics-upload" class="hidden" accept=".ics">
        </div>`;
    }

    // this is how we do statemenanagement
    let platform = localStorage.getItem('platform');
    let file = null;


    function showModal() {
        modal.style.display = 'flex';
        uploadContainer.style.display = 'none';
    }
    function hideModal() {
        modal.style.display = 'none';
        uploadContainer.style.display = '';
    }

    function setPlatform(p) {
        platform = p;
        localStorage.setItem('platform', p);
        hideModal();
        renderUI();
    }
    function clearPlatform() {
        localStorage.removeItem('platform');
        showModal();
    }

    macBtn.onclick = () => setPlatform('mac');
    winBtn.onclick = () => setPlatform('win');
    changePlatform.onclick = (e) => { e.preventDefault(); clearPlatform(); };


    function renderUI() {
        file = null;
        statusDiv.textContent = '';
        statusDiv.className = 'status hidden';
        uploadBtn.disabled = true;





        instructionsList.innerHTML = platform === 'mac' ? macInstructions : winInstructions;

        uploadOptions.innerHTML = platform === 'mac' ? macUploadOption() : winUploadOption();

        setupUploadHandlers();
    }


    function setupUploadHandlers() {
        const dragDropArea = document.getElementById('drag-drop-area');
        const fileInput = document.getElementById('ics-upload');
        const fileFeedback = document.getElementById('file-feedback');


        if (platform === 'win') {
            dragDropArea.addEventListener('click', function(e) {
                if (e.target !== fileInput) fileInput.click();
            });
            dragDropArea.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInput.click();
                }
            });
        }


        dragDropArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            dragDropArea.classList.add('dragover');
        });
        dragDropArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dragDropArea.classList.remove('dragover');
        });
        dragDropArea.addEventListener('drop', function(e) {
            e.preventDefault();
            dragDropArea.classList.remove('dragover');
            handleFiles(e.dataTransfer.files, fileInput, fileFeedback);
        });

        let dragCounter = 0;
        window.addEventListener('dragenter', function(e) {
            dragCounter++;
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                document.body.classList.add('window-dragover');
                const dragDropArea = document.getElementById('drag-drop-area');
                if (dragDropArea) dragDropArea.classList.add('dragover');
            }
        });
        window.addEventListener('dragleave', function(e) {
            dragCounter--;
            if (dragCounter <= 0) {
                document.body.classList.remove('window-dragover');
                const dragDropArea = document.getElementById('drag-drop-area');
                if (dragDropArea) dragDropArea.classList.remove('dragover');
            }
        });
        window.addEventListener('dragover', function(e) {
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                document.body.classList.add('window-dragover');
                const dragDropArea = document.getElementById('drag-drop-area');
                if (dragDropArea) dragDropArea.classList.add('dragover');
            }
        });
        window.addEventListener('drop', function(e) {
            dragCounter = 0;
            document.body.classList.remove('window-dragover');
            const dragDropArea = document.getElementById('drag-drop-area');
            if (dragDropArea) dragDropArea.classList.remove('dragover');
            e.preventDefault();
            e.stopPropagation();

            const fileInput = document.getElementById('ics-upload');
            const fileFeedback = document.getElementById('file-feedback');
            if (e.dataTransfer && e.dataTransfer.files && fileInput && fileFeedback) {
                handleFiles(e.dataTransfer.files, fileInput, fileFeedback);
            }
        });

        fileInput.addEventListener('change', function() {
            handleFiles(fileInput.files, fileInput, fileFeedback);
        });
    }

    function handleFiles(files, fileInput, fileFeedback) {
        if (files.length > 0) {
            const f = files[0];
            if (f.name.endsWith('.ics')) {
                file = f;
                fileFeedback.textContent = `Selected file: ${f.name}`;
                fileFeedback.className = 'file-feedback valid';
                uploadBtn.disabled = false;

                if (fileInput && fileInput.files !== files) {
                    const dt = new DataTransfer();
                    dt.items.add(f);
                    fileInput.files = dt.files;
                }
            } else {
                file = null;
                fileFeedback.textContent = 'Please select a valid .ics file';
                fileFeedback.className = 'file-feedback error';
                uploadBtn.disabled = true;
            }
        } else {
            file = null;
            fileFeedback.textContent = '';
            fileFeedback.className = 'file-feedback';
            uploadBtn.disabled = true;
        }
    }


    uploadBtn.onclick = function() {
        if (!file) {
            statusDiv.textContent = 'Please select an ICS file first.';
            statusDiv.className = 'status error';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const icsData = e.target.result;
            parseIcsData(icsData);
        };
        reader.readAsText(file);
    };


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
            allDates.sort((a, b) => a.valueOf() - b.valueOf());
            if (allDates.length === 0) {
                statusDiv.textContent = 'No events found in the ICS file.';
                statusDiv.className = 'status error';
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
                statusDiv.className = 'status success';
                chrome.runtime.sendMessage({ type: 'storageUpdated' });
                window.location.href = '../popup/popup.html';
            });
        } catch (error) {
            statusDiv.textContent = 'Error parsing ICS file: ' + error.message;
            statusDiv.className = 'status error';
            console.error('Error parsing ICS file:', error);
        }
    }


    if (platform === 'mac' || platform === 'win') {
        hideModal();
        renderUI();
    } else {
        showModal();
    }
});