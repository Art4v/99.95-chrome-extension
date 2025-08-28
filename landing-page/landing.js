document.addEventListener('DOMContentLoaded', function() {
    // Cache selectors
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
                <ul><li>Drag and drop the ICS file anywhere on this page <strong>(from the same desktop window as the extension, minimise the browser)</strong>.</li></ul>
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

    const uploadOptionTemplates = {
        mac: () => `
            <div class="drag-drop-area" id="drag-drop-area" tabindex="0">
                <div>Drag and drop your timetable file here</div>
                <div class="file-feedback" id="file-feedback"></div>
                <input type="file" id="ics-upload" class="hidden" accept=".ics">
            </div>`,
        win: () => `
            <div class="drag-drop-area clickable" id="drag-drop-area" tabindex="0" role="button" aria-label="Click to select ICS file or drag and drop">
                <div>Click to choose file or drag and drop your timetable file here</div>
                <div class="file-feedback" id="file-feedback"></div>
                <input type="file" id="ics-upload" class="hidden" accept=".ics">
            </div>`
    };

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
        uploadOptions.innerHTML = uploadOptionTemplates[platform]();
        setupUploadHandlers();
    }

    function setupUploadHandlers() {
        const dragDropArea = document.getElementById('drag-drop-area');
        const fileInput = document.getElementById('ics-upload');
        const fileFeedback = document.getElementById('file-feedback');

        if (platform === 'win') {
            dragDropArea.addEventListener('click', e => {
                if (e.target !== fileInput) fileInput.click();
            });
            dragDropArea.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInput.click();
                }
            });
        }

        // Drag and drop events
        ['dragover', 'dragleave', 'drop'].forEach(event => {
            dragDropArea.addEventListener(event, function(e) {
                e.preventDefault();
                if (event === 'dragover') {
                    dragDropArea.classList.add('dragover');
                } else {
                    dragDropArea.classList.remove('dragover');
                }
                if (event === 'drop') {
                    handleFiles(e.dataTransfer.files, fileInput, fileFeedback);
                }
            });
        });

        // Window drag events (for highlighting)
        let dragCounter = 0;
        function setWindowDrag(state) {
            document.body.classList.toggle('window-dragover', state);
            const area = document.getElementById('drag-drop-area');
            if (area) area.classList.toggle('dragover', state);
        }
        window.addEventListener('dragenter', function(e) {
            dragCounter++;
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) setWindowDrag(true);
        });
        window.addEventListener('dragleave', function(e) {
            dragCounter--;
            if (dragCounter <= 0) setWindowDrag(false);
        });
        window.addEventListener('dragover', function(e) {
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                setWindowDrag(true);
            }
        });
        window.addEventListener('drop', function(e) {
            dragCounter = 0;
            setWindowDrag(false);
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
                // Sync file input if needed
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
            parseIcsData(e.target.result);
        };
        reader.readAsText(file);
    };

    function parseIcsData(icsData) {
        try {
            if (typeof ICAL === 'undefined' || typeof moment === 'undefined' || !window._99_95_utils) {
                throw new Error('Required libraries (ICAL, moment) or shared utilities are not loaded.');
            }

            const cal = new ICAL.Component(ICAL.parse(icsData));
            const events = cal.getAllSubcomponents('vevent') || [];
            if (!events.length) {
                statusDiv.textContent = 'No events found in the ICS file.';
                statusDiv.className = 'status error';
                return;
            }

            const blacklist = ['Yr7', 'Yr8', 'Yr9', 'Yr10', 'Yr11', 'Yr12'];
            const filter = input => input.split(' ').filter(word => !blacklist.includes(word)).join(' ');

            const allDates = events.map(event => {
                try {
                    return moment(event.getFirstPropertyValue('dtstart').toString()).clone().tz(window._99_95_utils.TZ);
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);

            allDates.sort((a, b) => a.valueOf() - b.valueOf());
            if (!allDates.length) {
                statusDiv.textContent = 'No valid event datetimes found in the ICS file.';
                statusDiv.className = 'status error';
                return;
            }

            const firstDate = allDates[0], lastDate = allDates[allDates.length - 1];
            const days = lastDate.diff(firstDate, 'days') + 1;
            const outputData = {};

            for (let i = 0; i < days; i++) {
                const currentDate = firstDate.clone().add(i, 'days');
                const dateString = currentDate.format('YYYY-MM-DD');
                outputData[dateString] = [];
                events.forEach(event => {
                    try {
                        const startDate = moment(event.getFirstPropertyValue('dtstart').toString()).clone().tz(window._99_95_utils.TZ);
                        if (startDate.format('YYYY-MM-DD') === dateString) {
                            const endDate = moment(event.getFirstPropertyValue('dtend').toString()).clone().tz(window._99_95_utils.TZ);
                            const summary = event.getFirstPropertyValue('summary') || '';
                            const [classInfo, name = ''] = summary.split(': ');
                            const location = event.getFirstPropertyValue('location') || '';
                            const [, locationValue = ''] = location.split(': ');
                            const description = event.getFirstPropertyValue('description') || '';
                            const descriptionLines = description.split('\n');
                            const [, teacher = ''] = (descriptionLines[0] || '').split(': ');
                            const [, period = ''] = (descriptionLines[1] || '').split(': ');
                            outputData[dateString].push({
                                c: classInfo,
                                n: filter(name),
                                l: locationValue,
                                t: teacher,
                                p: period,
                                s: startDate.format('HH:mm'),
                                e: endDate.format('HH:mm')
                            });
                        }
                    } catch (err) {
                        // ignore malformed events but keep parsing
                        console.debug('Skipping malformed event:', err && err.message);
                    }
                });
                outputData[dateString].sort((a, b) => a.s.localeCompare(b.s));
            }

            const outputText = JSON.stringify(outputData);
            chrome.storage.local.set({ parsedIcsData: outputText }, function () {
                statusDiv.textContent = 'ICS data successfully parsed and stored!';
                statusDiv.className = 'status success';
                chrome.runtime.sendMessage({ type: 'storageUpdated' });
                // Set tutorial flag for first upload
                localStorage.setItem('showTutorial', 'true');
                window.location.href = '../popup/popup.html';
            });
        } catch (error) {
            statusDiv.textContent = 'Error parsing ICS file: ' + (error && error.message);
            statusDiv.className = 'status error';
            console.error('Error parsing ICS file:', error);
        }
    }

    // Initial UI
    if (platform === 'mac' || platform === 'win') {
        hideModal();
        renderUI();
    } else {
        showModal();
    }
});