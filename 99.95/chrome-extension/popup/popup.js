// Utility to format time range
function formatTimeRange(start, end) {
    const startTime = new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${startTime} – ${endTime}`;
}

// Utility to get today's date in local ISO format (YYYY-MM-DD)
function getLocalISODateString(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString().split('T')[0];
}

// Inject sidebar and hamburger button
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
            <button class="upload-btn">Upload Timetable</button>
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

    // Placeholder: Upload timetable functionality
    const uploadButton = sidebar.querySelector('.upload-btn');
    uploadButton.addEventListener("click", () => {
        alert('Upload Timetable feature coming soon!');
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

// Cached schedule to avoid re-fetching
let cachedSchedule = {};

// Function to fetch data from the JSON file
async function fetchSchedule(date, filePath = 'output.json') {
    if (cachedSchedule[date]) return cachedSchedule[date];
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error('Failed to load schedule data.');
        const data = await response.json();
        cachedSchedule[date] = data[date] || [];
        return cachedSchedule[date];
    } catch (error) {
        console.error(error);
        return [];
    }
}

// Function to find the next class (assumes sorted input)
function getNextClass(schedule, now) {
    return schedule.find((entry) => new Date(entry.start_time) > now) || null;
}

// Function to find current class
function getCurrentClass(schedule, now) {
    return schedule.find(entry => {
        const start = new Date(entry.start_time);
        const end = new Date(entry.end_time);
        return now >= start && now <= end;
    }) || null;
}

let globalTimer; // Ensures only one timer at a time
let lastNotifHTML = '';

// Countdown function
function startCountdown(target, isCurrentClass, schedule) {
    const notif = document.querySelector('.notif');

    if (!target) {
        notif.innerHTML = '<h1>No more classes today</h1>';
        return;
    }

    const targetTime = isCurrentClass 
        ? new Date(target.end_time) 
        : new Date(target.start_time);

    const countdownStartTime = isCurrentClass
        ? new Date(target.start_time)
        : new Date();

    if (globalTimer) clearInterval(globalTimer);

    const updateCountdown = () => {
        const currentTime = new Date();
        const timeDiff = Math.max(0, targetTime - currentTime);

        const hours = String(Math.floor(timeDiff / 3.6e6)).padStart(2, '0');
        const minutes = String(Math.floor((timeDiff % 3.6e6) / 6e4)).padStart(2, '0');
        const seconds = String(Math.floor((timeDiff % 6e4) / 1000)).padStart(2, '0');

        const newHTML = `
            <h1>${isCurrentClass ? `${target.name} ends in` : `${target.name} in`} ${hours}:${minutes}:${seconds}</h1>
            ${target.teacher ? `<h2>With ${target.teacher} in ${target.location}</h2>` : ''}
        `;

        if (newHTML !== lastNotifHTML) {
            notif.innerHTML = newHTML;
            lastNotifHTML = newHTML;
        }

        if (timeDiff <= 0) {
            clearInterval(globalTimer);
            if (isCurrentClass) {
                const nextClass = getNextClass(schedule, currentTime);
                startCountdown(nextClass, false, schedule);
            } else {
                const current = getCurrentClass(schedule, currentTime);
                if (current) {
                    startCountdown(current, true, schedule);
                } else {
                    notif.innerHTML = `<h1>${target.name} is starting now!</h1>`;
                    setTimeout(() => {
                        const nextClass = getNextClass(schedule, currentTime);
                        startCountdown(nextClass, false, schedule);
                    }, 10000);
                }
            }
        }
    };

    updateCountdown();
    globalTimer = setInterval(updateCountdown, 1000);
}

// Render block element
function createScheduleBlock(entry) {
    const block = document.createElement('div');
    block.className = 'b';

    const period = document.createElement('div');
    period.className = 'bp';
    const periodText = document.createElement('h1');
    periodText.textContent = entry.period;
    period.appendChild(periodText);

    const details = document.createElement('div');
    details.className = 'bt';
    const className = document.createElement('p');
    className.textContent = entry.name;
    const teacherDetails = document.createElement('h4');
    teacherDetails.textContent = formatTimeRange(entry.start_time, entry.end_time);
    if (entry.teacher) {
        teacherDetails.textContent += `: ${entry.teacher}`;
    }
    details.appendChild(className);
    details.appendChild(teacherDetails);

    const room = document.createElement('div');
    room.className = 'br';
    const roomText = document.createElement('h1');
    roomText.textContent = entry.location;
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
        const block = createScheduleBlock(entry);
        blocksContainer.appendChild(block);
    });
}

// Check if weekend
function isWeekend(date) {
    return date.getDay() === 0 || date.getDay() === 6;
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

    const currentClass = getCurrentClass(schedule, now);
    if (currentClass) {
        startCountdown(currentClass, true, schedule);
    } else {
        const nextClass = getNextClass(schedule, now);
        startCountdown(nextClass, false, schedule);
    }
}

// Unified DOMContentLoaded handler
document.addEventListener('DOMContentLoaded', async () => {
    await initialize();
    injectSidebarUI();
});
