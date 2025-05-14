// Dependency checks
if (typeof moment === "undefined" || typeof ICAL === "undefined") {
    alert("Required libraries (moment.js, ical.js) are not loaded. Please check your extension setup.");
    throw new Error("Required libraries not loaded.");
}

// Utility: Combine date and time string into a Date object (Australia/Sydney)
function getDateTime(dateString, timeString) {
    // Use moment.tz for timezone consistency
    return moment.tz(`${dateString}T${timeString}:00`, "Australia/Sydney").toDate();
}

// Utility: Format time range
function formatTimeRange(date, start, end) {
    const opts = { hour: '2-digit', minute: '2-digit' };
    const startTime = getDateTime(date, start).toLocaleTimeString([], opts);
    const endTime = getDateTime(date, end).toLocaleTimeString([], opts);
    return `${startTime} – ${endTime}`;
}

// Utility: Get today's date in local ISO format (YYYY-MM-DD)
function getLocalISODateString(date) {
    return moment.tz(date, "Australia/Sydney").format("YYYY-MM-DD");
}

// Inject sidebar, hamburger, and embed viewer UI
function injectSidebarUI() {
    // Sidebar
    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";
    sidebar.setAttribute("role", "complementary");
    sidebar.setAttribute("aria-label", "Sidebar");
    sidebar.innerHTML = `
        <div class="sidebar-content">
            <div class="sidebar-section">
                <h2 class="sidebar-heading">Reference Sheets</h2>
                <div class="sidebar-divider">Maths</div>
                <button class="sidebar-btn" data-pdf="newadvmath.pdf">Maths Adv/Ext1/2</button>
                <button class="sidebar-btn" data-pdf="newstandardmath.pdf">Maths Standard</button>
                <div class="sidebar-divider">Science</div>
                <button class="sidebar-btn" data-pdf="newchem.pdf">Chemistry</button>
                <button class="sidebar-btn" data-pdf="newphys.pdf">Physics</button>
            </div>
            <div class="sidebar-section">
                <h2 class="sidebar-heading">Utilities</h2>
                <button class="sidebar-btn" data-url="https://www.desmos.com/calculator">Desmos</button>
            </div>
        </div>
        <div class="sidebar-footer" style="margin-top: 48px; position: relative;">
            <button class="scrollbar-toggle-btn" title="Toggle Scrollbar">Toggle Scrollbar</button>
            <button class="size-toggle-btn" title="Toggle Window Size">Small View</button>
            <button class="upload-btn">Upload New</button>
            <button class="toggle-btn">Toggle Theme</button>
            <span style="position: fixed; right: 16px; bottom: 5px; color: #aaa; font-size: 0.72rem; pointer-events: none; user-select: none; z-index: 1200;">By Aarav B, Sai P, Andy L.</span>
        </div>
    `;

    // Hamburger
    const hamburger = document.createElement("button");
    hamburger.className = "hamburger";
    hamburger.setAttribute("aria-label", "Toggle Sidebar");
    hamburger.textContent = "☰";

    // Embed Viewer
    const embedViewer = document.createElement("div");
    embedViewer.className = "embed-viewer hidden";
    embedViewer.setAttribute("role", "dialog");
    embedViewer.setAttribute("aria-modal", "true");
    embedViewer.innerHTML = `
        <button class="close-embed" aria-label="Close">×</button>
        <iframe class="embed-frame" frameborder="0"></iframe>
    `;

    document.body.append(hamburger, sidebar, embedViewer);

    // Sidebar toggle (only toggle .visible)
    hamburger.addEventListener("click", () => {
        sidebar.classList.toggle("visible");
    });

    // Restore theme
    if (localStorage.getItem("theme") === "light") {
        document.body.classList.add("light-mode");
    }

    // Background toggle
    sidebar.querySelector('.toggle-btn').addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
        localStorage.setItem("theme", document.body.classList.contains("light-mode") ? "light" : "dark");
    });

    // --- Upload timetable functionality ---
    if (!document.getElementById('ics-upload-input')) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.ics';
        fileInput.style.display = 'none';
        fileInput.id = 'ics-upload-input';
        document.body.appendChild(fileInput);

        const uploadBtn = sidebar.querySelector('.upload-btn');
        uploadBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const icsData = e.target.result;
                    const cal = new ICAL.Component(ICAL.parse(icsData));
                    const events = cal.getAllSubcomponents('vevent');
                    const blacklist = ["Yr7", "Yr8", "Yr9", "Yr10", "Yr11", "Yr12"];
                    const filter = input => input.split(' ').filter(word => !blacklist.includes(word)).join(' ');
                    const allDates = events.map(event => moment(event.getFirstPropertyValue('dtstart').toString()).tz('Australia/Sydney'));
                    allDates.sort((a, b) => a - b);
                    if (!allDates.length) throw new Error('No events found in the ICS file.');
                    const firstDate = allDates[0], lastDate = allDates[allDates.length - 1];
                    const days = lastDate.diff(firstDate, 'days') + 1;
                    const outputData = {};
                    for (let i = 0; i < days; i++) {
                        const currentDate = firstDate.clone().add(i, 'days').format('YYYY-MM-DD');
                        outputData[currentDate] = [];
                        events.forEach(event => {
                            const sydneyStart = moment(event.getFirstPropertyValue('dtstart').toString()).tz('Australia/Sydney');
                            if (sydneyStart.format('YYYY-MM-DD') === currentDate) {
                                const sydneyEnd = moment(event.getFirstPropertyValue('dtend').toString()).tz('Australia/Sydney');
                                const summary = event.getFirstPropertyValue('summary') || '';
                                const [classInfo, name = ''] = summary.split(': ');
                                const location = event.getFirstPropertyValue('location') || '';
                                const [, locationValue = ''] = location.split(': ');
                                const description = event.getFirstPropertyValue('description') || '';
                                const descriptionLines = description.split('\n');
                                const [, teacher = ''] = (descriptionLines[0] || '').split(': ');
                                const [, period = ''] = (descriptionLines[1] || '').split(': ');
                                outputData[currentDate].push({
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
                        outputData[currentDate].sort((a, b) => a.s.localeCompare(b.s));
                    }
                    chrome.storage.local.set({ parsedIcsData: JSON.stringify(outputData) }, () => {
                        chrome.runtime.sendMessage({ type: 'storageUpdated' }, () => {
                            window.location.reload();
                        });
                    });
                } catch (err) {
                    alert('Failed to parse ICS file: ' + err.message);
                }
            };
            reader.readAsText(file);
        });

        // Right-click to clear timetable
        uploadBtn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            chrome.storage.local.remove('parsedIcsData', () => {
                chrome.runtime.sendMessage({ type: 'storageUpdated' }, () => {
         
                    window.location.href = '../landing-page/landing.html';
                });
            });
        });
    }

    // Sidebar PDF/URL buttons
    sidebar.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const src = btn.getAttribute('data-pdf') || btn.getAttribute('data-url');
            const frame = embedViewer.querySelector('.embed-frame');
            frame.src = src;
            
     
            embedViewer.classList.remove('pdf-view', 'desmos-view');
            if (btn.getAttribute('data-pdf')) {
                embedViewer.classList.add('pdf-view');
            } else if (btn.getAttribute('data-url')) {
                embedViewer.classList.add('desmos-view');
            }
            
            embedViewer.classList.remove('hidden');
        });
    });

    // Close embed viewer
    embedViewer.querySelector('.close-embed').addEventListener('click', () => {
        embedViewer.classList.add('hidden');
        embedViewer.querySelector('.embed-frame').src = "";
    });

    // Scrollbar toggle
    const scrollbarToggleBtn = sidebar.querySelector('.scrollbar-toggle-btn');
    if (localStorage.getItem('scrollbar') === 'off') {
        document.body.classList.add('scrollbar-off');
    } else {
        document.body.classList.remove('scrollbar-off');
    }
    scrollbarToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('scrollbar-off');
        localStorage.setItem('scrollbar', document.body.classList.contains('scrollbar-off') ? 'off' : 'on');
    });

    // Size toggle functionality
    const sizeToggleBtn = sidebar.querySelector('.size-toggle-btn');
    // Set initial state from localStorage
    const savedSize = localStorage.getItem('windowSize');
    if (savedSize === 'compact') {
        document.documentElement.style.width = '630px';
        document.body.style.width = '630px';
        sizeToggleBtn.textContent = 'Full View';
    }

    sizeToggleBtn.addEventListener('click', () => {
        const isCompact = document.documentElement.style.width === '630px';
        const newWidth = isCompact ? '800px' : '630px';
        document.documentElement.style.width = newWidth;
        document.body.style.width = newWidth;
        sizeToggleBtn.textContent = isCompact ? 'Compact View' : 'Full View';
        localStorage.setItem('windowSize', isCompact ? 'full' : 'compact');
    });
}

// Find the next class (assumes sorted input)
function getNextClass(schedule, now, date) {
    return schedule.find(entry => getDateTime(date, entry.s) > now) || null;
}

// Find current class
function getCurrentClass(schedule, now, date) {
    return schedule.find(entry => {
        const start = getDateTime(date, entry.s);
        const end = getDateTime(date, entry.e);
        return now >= start && now <= end;
    }) || null;
}

let globalTimer, lastNotifHTML = '', progressBar, progressBarContainer;

// Countdown function
function startCountdown(target, isCurrentClass, schedule, date) {
    const notif = document.querySelector('.notif');
    if (!target) {
        notif.innerHTML = '<h1>No more classes today</h1>';
        if (progressBarContainer) progressBarContainer.remove();
        return;
    }
    const targetTime = getDateTime(date, isCurrentClass ? target.e : target.s);
    const countdownStartTime = isCurrentClass ? getDateTime(date, target.s) : moment.tz("Australia/Sydney").toDate();
    if (globalTimer) clearInterval(globalTimer);

    if (!progressBarContainer) {
        progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'progress-bar-container';
        progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBarContainer.appendChild(progressBar);
        notif.appendChild(progressBarContainer);
    } else if (!notif.contains(progressBarContainer)) {
        notif.appendChild(progressBarContainer);
    }

    function updateCountdown() {
        const currentTime = moment.tz("Australia/Sydney").toDate();
        const timeDiff = Math.max(0, targetTime - currentTime);
        const total = targetTime - countdownStartTime;
        const percent = total > 0 ? Math.max(0, Math.min(1, (currentTime - countdownStartTime) / total)) : 0;
        progressBar.style.width = (percent * 100) + '%';
        progressBar.setAttribute('aria-valuenow', (percent * 100));

        const hours = String(Math.floor(timeDiff / 3.6e6)).padStart(2, '0');
        const minutes = String(Math.floor((timeDiff % 3.6e6) / 6e4)).padStart(2, '0');
        const seconds = String(Math.floor((timeDiff % 6e4) / 1000)).padStart(2, '0');

        let detailsLine = '';
        if (target.t && target.l) {
            detailsLine = `<h2>With ${target.t} in Room ${target.l}</h2>`;
        } else if (target.t) {
            detailsLine = `<h2>With ${target.t}</h2>`;
        } else if (target.l) {
            detailsLine = `<h2>In Room ${target.l}</h2>`;
        }

        const newHTML = `
            <h1>${isCurrentClass ? `${target.n} ends in` : `${target.n} in`} ${hours}:${minutes}:${seconds}</h1>
            ${detailsLine}
        `;

        if (newHTML !== lastNotifHTML) {
            notif.innerHTML = newHTML;
            notif.appendChild(progressBarContainer);
            lastNotifHTML = newHTML;
        }

        if (timeDiff <= 0) {
            clearInterval(globalTimer);
            if (isCurrentClass) {
                startCountdown(getNextClass(schedule, currentTime, date), false, schedule, date);
            } else {
                const current = getCurrentClass(schedule, currentTime, date);
                if (current) {
                    startCountdown(current, true, schedule, date);
                } else {
                    notif.innerHTML = `<h1>${target.n} is starting now!</h1>`;
                    if (progressBarContainer) progressBarContainer.remove();
                    setTimeout(() => {
                        startCountdown(getNextClass(schedule, currentTime, date), false, schedule, date);
                    }, 10000);
                }
            }
        }
    }

    updateCountdown();
    globalTimer = setInterval(updateCountdown, 1000);
}

// Render block element
function createScheduleBlock(entry, date, isActive) {
    const block = document.createElement('div');
    block.className = 'b' + (isActive ? ' active' : '');

    const period = document.createElement('div');
    period.className = 'bp';
    const periodText = document.createElement('h1');
    periodText.textContent = entry.p;
    period.appendChild(periodText);

    const details = document.createElement('div');
    details.className = 'bt';
    const className = document.createElement('p');
    className.textContent = entry.n;
    const teacherDetails = document.createElement('h4');
    teacherDetails.textContent = formatTimeRange(date, entry.s, entry.e) + (entry.t ? `: ${entry.t}` : '');
    details.append(className, teacherDetails);

    const room = document.createElement('div');
    room.className = 'br';
    const roomText = document.createElement('h1');
    roomText.textContent = entry.l;
    room.appendChild(roomText);

    block.append(period, details, room);
    return block;
}

// Render the schedule
function renderSchedule(schedule, date) {
    const blocksContainer = document.querySelector('.blocks');
    blocksContainer.innerHTML = schedule.length
        ? ''
        : '<h1>No classes today!</h1>';

    schedule.forEach(entry => {
        const start = getDateTime(date, entry.s);
        const end = getDateTime(date, entry.e);
        // Use moment.tz for current time
        const now = moment.tz("Australia/Sydney").toDate();
        const isActive = now >= start && now <= end;
        blocksContainer.appendChild(createScheduleBlock(entry, date, isActive));
    });
}

// Check if weekend
function isWeekend(date) {
    const day = moment.tz(date, "Australia/Sydney").day();
    return day === 0 || day === 6;
}

// Fetch schedule from chrome.storage.local
function fetchSchedule(date) {
    return new Promise(resolve => {
        chrome.storage.local.get('parsedIcsData', data => {
            if (!data.parsedIcsData) return resolve([]);
            try {
                const allData = JSON.parse(data.parsedIcsData);
                resolve(allData[date] || []);
            } catch {
                resolve([]);
            }
        });
    });
}

// Main initialization
async function initialize() {
    const now = moment.tz("Australia/Sydney").toDate();
    const currentDate = getLocalISODateString(now);

    if (isWeekend(now)) {
        document.querySelector('.blocks').innerHTML = '<h1>No classes today! It\'s a weekend.</h1>';
        document.querySelector('.notif').innerHTML = '<h1>Enjoy your day off!</h1>';
        return;
    }

    const schedule = await fetchSchedule(currentDate);
    renderSchedule(schedule, currentDate);

    if (!schedule.length) {
        document.querySelector('.notif').innerHTML = '<h1>No classes today!</h1>';
        return;
    }

    const currentClass = getCurrentClass(schedule, now, currentDate);
    if (currentClass) {
        startCountdown(currentClass, true, schedule, currentDate);
    } else {
        startCountdown(getNextClass(schedule, now, currentDate), false, schedule, currentDate);
    }
}

// DOMContentLoaded handler
document.addEventListener('DOMContentLoaded', async () => {
    injectSidebarUI();
    await initialize();
});