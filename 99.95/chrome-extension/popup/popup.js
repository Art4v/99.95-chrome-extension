// Utility to combine date and time string into a Date object
function getDateTime(dateString, timeString) {
    // dateString: "2025-04-30", timeString: "08:50"
    return new Date(`${dateString}T${timeString}:00`);
}

// Utility to format time range
function formatTimeRange(date, start, end) {
    const startTime = getDateTime(date, start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = getDateTime(date, end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${startTime} – ${endTime}`;
}

// Utility to get today's date in local ISO format (YYYY-MM-DD)
function getLocalISODateString(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString().split('T')[0];
}

// Inject sidebar and hamburger button (unchanged)
function injectSidebarUI() {
    const sidebar = document.createElement("div");
    sidebar.className = "sidebar hidden";
    sidebar.innerHTML = `
        <div class="sidebar-content">
            <div class="sidebar-section">
                <h2 class="sidebar-heading">Reference Sheets</h2>
                <button class="sidebar-btn" data-pdf="mathematics.pdf">Mathematics Reference Sheet</button>
                <button class="sidebar-btn" data-pdf="chemistry.pdf">Chemistry Reference Sheet</button>
                <button class="sidebar-btn" data-pdf="physics.pdf">Physics Reference Sheet</button>
            </div>
            <div class="sidebar-section">
                <h2 class="sidebar-heading">Utilities</h2>
                <button class="sidebar-btn" data-url="https://www.desmos.com/calculator">Desmos</button>
            </div>
        </div>
        <div class="sidebar-footer">
            <button class="upload-btn">Upload New Timetable</button>
            <button class="toggle-btn">Toggle Background</button>
        </div>
    `;

    const hamburger = document.createElement("button");
    hamburger.className = "hamburger";
    hamburger.setAttribute("aria-label", "Toggle Sidebar");
    hamburger.textContent = "☰";

    const embedViewer = document.createElement("div");
    embedViewer.className = "embed-viewer hidden";
    embedViewer.innerHTML = `
        <button class="close-embed">×</button>
        <iframe class="embed-frame" frameborder="0"></iframe>
    `;

    document.body.appendChild(hamburger);
    document.body.appendChild(sidebar);
    document.body.appendChild(embedViewer);

    hamburger.addEventListener("click", () => {
        sidebar.classList.toggle("hidden");
        sidebar.classList.toggle("visible");
    });

    // Restore saved theme
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
        document.body.classList.add("light-mode");
    }

    // Background toggle
    const toggleButton = sidebar.querySelector('.toggle-btn');
    toggleButton.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
        localStorage.setItem("theme", document.body.classList.contains("light-mode") ? "light" : "dark");
    });

    // --- Upload timetable functionality ---

    // Create a hidden file input for uploading .ics files
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.ics';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    const uploadBtn = sidebar.querySelector('.upload-btn');
    uploadBtn.addEventListener('click', () => {
        fileInput.value = ''; // Reset file input
        fileInput.click();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const icsData = e.target.result;
            try {
                // Parse ICS using ICAL.js and moment.js
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
                allDates.sort((a, b) => a - b);
                if (allDates.length === 0) throw new Error('No events found in the ICS file.');
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
                chrome.storage.local.set({ parsedIcsData: outputText }, () => {
                    chrome.runtime.sendMessage({ type: 'storageUpdated' }, () => {
                        alert('Timetable uploaded!');
                        window.close();
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
        chrome.storage.local.remove('ical', () => {
            chrome.runtime.sendMessage({ type: 'storageUpdated' }, () => {
                alert('Timetable removed!');
                window.close();
            });
        });
    });

    // Handle button clicks for PDFs or URLs
    sidebar.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const src = btn.getAttribute('data-pdf') || btn.getAttribute('data-url');
            const frame = embedViewer.querySelector('.embed-frame');
            frame.src = src;
            embedViewer.classList.remove('hidden');
        });
    });

    // Close embed viewer
    embedViewer.querySelector('.close-embed').addEventListener('click', () => {
        embedViewer.classList.add('hidden');
        embedViewer.querySelector('.embed-frame').src = "";
    });
}

// Function to find the next class (assumes sorted input)
function getNextClass(schedule, now, date) {
    return schedule.find((entry) => getDateTime(date, entry.s) > now) || null;
}

// Function to find current class
function getCurrentClass(schedule, now, date) {
    return schedule.find(entry => {
        const start = getDateTime(date, entry.s);
        const end = getDateTime(date, entry.e);
        return now >= start && now <= end;
    }) || null;
}

let globalTimer; // Ensures only one timer at a time
let lastNotifHTML = '';

// Countdown function
function startCountdown(target, isCurrentClass, schedule, date) {
    const notif = document.querySelector('.notif');

    if (!target) {
        notif.innerHTML = '<h1>No more classes today</h1>';
        return;
    }

    const targetTime = isCurrentClass 
        ? getDateTime(date, target.e)
        : getDateTime(date, target.s);

    const countdownStartTime = isCurrentClass
        ? getDateTime(date, target.s)
        : new Date();

    if (globalTimer) clearInterval(globalTimer);

    const updateCountdown = () => {
        const currentTime = new Date();
        const timeDiff = Math.max(0, targetTime - currentTime);

        const hours = String(Math.floor(timeDiff / 3.6e6)).padStart(2, '0');
        const minutes = String(Math.floor((timeDiff % 3.6e6) / 6e4)).padStart(2, '0');
        const seconds = String(Math.floor((timeDiff % 6e4) / 1000)).padStart(2, '0');

        const newHTML = `
            <h1>${isCurrentClass ? `${target.n} ends in` : `${target.n} in`} ${hours}:${minutes}:${seconds}</h1>
            ${target.t ? `<h2>With ${target.t} in ${target.l}</h2>` : ''}
        `;

        if (newHTML !== lastNotifHTML) {
            notif.innerHTML = newHTML;
            lastNotifHTML = newHTML;
        }

        if (timeDiff <= 0) {
            clearInterval(globalTimer);
            if (isCurrentClass) {
                const nextClass = getNextClass(schedule, currentTime, date);
                startCountdown(nextClass, false, schedule, date);
            } else {
                const current = getCurrentClass(schedule, currentTime, date);
                if (current) {
                    startCountdown(current, true, schedule, date);
                } else {
                    notif.innerHTML = `<h1>${target.n} is starting now!</h1>`;
                    setTimeout(() => {
                        const nextClass = getNextClass(schedule, currentTime, date);
                        startCountdown(nextClass, false, schedule, date);
                    }, 10000);
                }
            }
        }
    };

    updateCountdown();
    globalTimer = setInterval(updateCountdown, 1000);
}

// Render block element
function createScheduleBlock(entry, date) {
    const block = document.createElement('div');
    block.className = 'b';

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
    teacherDetails.textContent = formatTimeRange(date, entry.s, entry.e);
    if (entry.t) {
        teacherDetails.textContent += `: ${entry.t}`;
    }
    details.appendChild(className);
    details.appendChild(teacherDetails);

    const room = document.createElement('div');
    room.className = 'br';
    const roomText = document.createElement('h1');
    roomText.textContent = entry.l;
    room.appendChild(roomText);

    block.appendChild(period);
    block.appendChild(details);
    block.appendChild(room);

    return block;
}

// Render the schedule
function renderSchedule(schedule, date) {
    const blocksContainer = document.querySelector('.blocks');
    blocksContainer.innerHTML = '';

    if (schedule.length === 0) {
        blocksContainer.innerHTML = '<h1>No classes today!</h1>';
        return;
    }

    schedule.forEach((entry) => {
        const block = createScheduleBlock(entry, date);
        blocksContainer.appendChild(block);
    });
}

// Check if weekend
function isWeekend(date) {
    return date.getDay() === 0 || date.getDay() === 6;
}

// Function to fetch schedule from chrome.storage.local instead of output.json
async function fetchSchedule(date) {
    return new Promise((resolve) => {
        chrome.storage.local.get('parsedIcsData', (data) => {
            if (!data.parsedIcsData) {
                resolve([]);
                return;
            }
            try {
                const allData = JSON.parse(data.parsedIcsData);
                resolve(allData[date] || []);
            } catch (e) {
                console.error('Failed to parse timetable data:', e);
                resolve([]);
            }
        });
    });
}

// Main initialization
async function initialize() {
    const now = new Date();
    const currentDate = getLocalISODateString(now);

    if (isWeekend(now)) {
        document.querySelector('.blocks').innerHTML = '<h1>No classes today! It\'s a weekend.</h1>';
        document.querySelector('.notif').innerHTML = '<h1>Enjoy your day off!</h1>';
        return;
    }

    const schedule = await fetchSchedule(currentDate);
    renderSchedule(schedule, currentDate);

    if (schedule.length === 0) {
        document.querySelector('.notif').innerHTML = '<h1>No classes today!</h1>';
        return;
    }

    const currentClass = getCurrentClass(schedule, now, currentDate);
    if (currentClass) {
        startCountdown(currentClass, true, schedule, currentDate);
    } else {
        const nextClass = getNextClass(schedule, now, currentDate);
        startCountdown(nextClass, false, schedule, currentDate);
    }
}

// Unified DOMContentLoaded handler
document.addEventListener('DOMContentLoaded', async () => {
    injectSidebarUI();
    await initialize();
});