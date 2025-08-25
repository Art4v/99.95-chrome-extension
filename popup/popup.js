// Dependency checks
if (typeof moment === 'undefined' || typeof ICAL === 'undefined' || !window._99_95_utils) {
    alert('Required libraries (moment.js, ical.js) or shared utilities are not loaded. Please check your extension setup.');
    throw new Error('Required libraries or utilities not loaded.');
}

const TZ = window._99_95_utils.TZ;

// Local wrappers that delegate to shared utils (keeps callsites unchanged)
function getDateTime(dateString, timeString) {
    return window._99_95_utils.getDateTime(dateString, timeString);
}

function formatTimeRange(date, start, end) {
    return window._99_95_utils.formatTimeRange(date, start, end);
}

function getLocalISODateString(date) {
    return window._99_95_utils.getLocalISODateString(date);
}

let notifElem, blocksElem, navDateElem, sidebarBtns = [];
let progressBar, progressBarContainer, displayedDate = null;
let rafId = null;
let lastNotifHTML = '';
let lastAnimUpdate = 0;
const ANIM_THROTTLE_MS = 250; // throttle updates to this interval

// CountdownController: encapsulates requestAnimationFrame loop and exposes start/stop
const CountdownController = (function () {
    let _rafId = null;
    let _lastTs = 0;

        function _step(targetTime, countdownStartTime, onTick, onFinish) {
            _rafId = requestAnimationFrame(function frame(ts) {
            try {
                if (!_lastTs || ts - _lastTs >= ANIM_THROTTLE_MS) {
                    const now = window._99_95_utils.now();
                    const timeDiff = Math.max(0, targetTime - now);
                    const total = targetTime - countdownStartTime;
                    const percent = total > 0 ? Math.max(0, Math.min(1, (now - countdownStartTime) / total)) : 0;
                    onTick && onTick({ now, timeDiff, percent });
                    _lastTs = ts;
                }

                        if (window._99_95_utils.now() >= targetTime) {
                            // finished
                            stop();
                            onTick && onTick({ now: window._99_95_utils.now(), timeDiff: 0, percent: 1 });
                            onFinish && onFinish();
                            return;
                        }

                        _step(targetTime, countdownStartTime, onTick, onFinish);
            } catch (err) {
                console.error('CountdownController loop error:', err);
                stop();
            }
        });
    }

        function start(targetTime, countdownStartTime, onTick, onFinish) {
            stop();
            _lastTs = 0;
            _step(targetTime, countdownStartTime, onTick, onFinish);
        }

    function stop() {
        try {
            if (_rafId) cancelAnimationFrame(_rafId);
        } catch (e) {
            console.debug('Error cancelling RAF in CountdownController', e && e.message);
        }
        _rafId = null;
        _lastTs = 0;
    }

    return { start, stop };
})();

// Make stopCountdown delegate to CountdownController as well
function stopCountdown() {
    try {
        CountdownController.stop();
    } catch (e) {
        console.debug('Error in stopCountdown:', e && e.message);
    }
    // backward compatibility: clear any local rafId
    try { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } } catch(e){}
    lastAnimUpdate = 0;
}

// Inject sidebar, hamburger, and embed viewer UI
function injectSidebarUI() {
    // Sidebar
    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";
    sidebar.setAttribute("role", "complementary");
    sidebar.innerHTML = `
        <div class="sidebar-content">
            <div class="sidebar-section">
                <h2 class="sidebar-heading">Reference Sheets</h2>
                <div class="sidebar-divider">Maths</div>
                <button class="sidebar-btn" data-pdf="advmath.pdf">Maths Adv/Ext1/2</button>
                <button class="sidebar-btn" data-pdf="standardmath.pdf">Maths Standard</button>
                <div class="sidebar-divider">Science</div>
                <button class="sidebar-btn" data-pdf="chem.pdf">Chemistry</button>
                <button class="sidebar-btn" data-pdf="phys.pdf">Physics</button>
            </div>
            <div class="sidebar-section">
                <h2 class="sidebar-heading">Utilities</h2>
                <button class="sidebar-btn" data-url="https://www.desmos.com/calculator">Desmos</button>
        </div>
        <div class="sidebar-footer" style="margin-top: 48px; position: relative; flex-direction: column;">
            <div class="sidebar-footer-buttons" style="display: flex; gap: 8px; width: 100%;">
                <button class="scrollbar-toggle-btn" title="Toggle Scrollbar">Toggle Scrollbar</button>
                <button class="size-toggle-btn" title="Toggle Window Size">Small View</button>
                <button class="upload-btn">Upload New</button>
                <button class="toggle-btn">Toggle Theme</button>
            </div>
            <div class="sidebar-footer-info">
                <span class="sidebar-footer-instructions">1-4/D for Utilities, Q/W/E or ←/↑/→ for Navigation</span>
                <span class="sidebar-footer-credits">By Aarav B, Sai P, Andy L.</span>
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
    hamburger.addEventListener("click", () => sidebar.classList.toggle("visible"));

    // Restore theme
    if (localStorage.getItem("theme") === "light") document.body.classList.add("light-mode");

    // Background toggle
    sidebar.querySelector('.toggle-btn').addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
        localStorage.setItem("theme", document.body.classList.contains("light-mode") ? "light" : "dark");
    });

    // --- Upload timetable functionality ---
    const uploadBtn = sidebar.querySelector('.upload-btn');
    uploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to remove your timetable and upload a new one?')) {
            chrome.storage.local.remove('parsedIcsData', () => {
                chrome.runtime.sendMessage({ type: 'storageUpdated' }, () => {
                    window.location.href = '../landing-page/landing.html';
                }); 
            });
        }
    });

    // Sidebar PDF/URL buttons (accessibility: keyboard + roles)
    sidebar.querySelectorAll('.sidebar-btn').forEach((btn, idx) => {
        btn.setAttribute('role', 'button');
        btn.tabIndex = 0;
        btn.addEventListener('click', () => openSidebarItem(btn));
        btn.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                openSidebarItem(btn);
            }
            // quick keys: 1-4, d
            if (/^[1-4]$/.test(ev.key)) {
                const n = Number(ev.key) - 1;
                const target = sidebar.querySelectorAll('.sidebar-btn')[n];
                if (target) openSidebarItem(target);
            }
        });
    });

    function openSidebarItem(btn) {
        const src = btn.getAttribute('data-pdf') || btn.getAttribute('data-url');
        const frame = embedViewer.querySelector('.embed-frame');
        frame.src = src;
        embedViewer.classList.remove('pdf-view', 'desmos-view');
        if (btn.getAttribute('data-pdf')) embedViewer.classList.add('pdf-view');
        else if (btn.getAttribute('data-url')) embedViewer.classList.add('desmos-view');
        const isCompact = localStorage.getItem('windowSize') === 'compact';
        if (isCompact) {
            document.documentElement.style.width = '800px';
            document.body.style.width = '800px';
        }
        embedViewer.classList.remove('hidden');
        frame.focus && frame.focus();
    }

    // Close embed viewer
    embedViewer.querySelector('.close-embed').addEventListener('click', () => {
        embedViewer.classList.add('hidden');
        embedViewer.querySelector('.embed-frame').src = "";
        const isCompact = localStorage.getItem('windowSize') === 'compact';
        if (isCompact) {
            document.documentElement.style.width = '630px';
            document.body.style.width = '630px';
        }
    });

    const scrollbarToggleBtn = sidebar.querySelector('.scrollbar-toggle-btn');
    document.body.classList.toggle('scrollbar-off', localStorage.getItem('scrollbar') === 'off');
    scrollbarToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('scrollbar-off');
        localStorage.setItem('scrollbar', document.body.classList.contains('scrollbar-off') ? 'off' : 'on');
    });

    const sizeToggleBtn = sidebar.querySelector('.size-toggle-btn');
    const savedSize = localStorage.getItem('windowSize');
    if (savedSize === 'compact') {
        document.documentElement.style.width = '630px';
        document.body.style.width = '630px';
        sizeToggleBtn.textContent = 'Full View';
    } else {
        sizeToggleBtn.textContent = 'Compact View';
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

// Countdown function
function startCountdown(target, isCurrentClass, schedule, date) {
    const notif = notifElem;
    if (!target) {
        notif.innerHTML = '<h1>No more classes today</h1>';
        progressBarContainer && progressBarContainer.remove();
        return;
    }
    // Ensure previous countdown is stopped to avoid races
    stopCountdown();
    const targetTime = getDateTime(date, isCurrentClass ? target.e : target.s);
    const countdownStartTime = isCurrentClass ? getDateTime(date, target.s) : window._99_95_utils.now();

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

    // Ensure stable DOM nodes for title/details to avoid reflows
    let titleElem = notif.querySelector('h1');
    let detailsElem = notif.querySelector('h2');
    if (!titleElem) { titleElem = document.createElement('h1'); notif.appendChild(titleElem); }
    if (!detailsElem) { detailsElem = document.createElement('h2'); notif.appendChild(detailsElem); }

    // Use CountdownController to drive updates
    CountdownController.start(targetTime, countdownStartTime, ({ now, timeDiff, percent }) => {
        try {
            progressBar.style.width = (percent * 100) + '%';
            progressBar.setAttribute('aria-valuenow', Math.round(percent * 100));

            const hours = String(Math.floor(timeDiff / 3.6e6)).padStart(2, '0');
            const minutes = String(Math.floor((timeDiff % 3.6e6) / 6e4)).padStart(2, '0');
            const seconds = String(Math.floor((timeDiff % 6e4) / 1000)).padStart(2, '0');

            titleElem.textContent = `${isCurrentClass ? `${target.n} ends in` : `${target.n} in`} ${hours}:${minutes}:${seconds}`;
            let teacher = (target.t || '').trim();
            let room = (target.l || '').trim();
            if (teacher && room) detailsElem.textContent = `With ${teacher} in Room ${room}`;
            else if (teacher) detailsElem.textContent = `With ${teacher}`;
            else if (room) detailsElem.textContent = `In Room ${room}`;
            else detailsElem.textContent = '';
        } catch (err) {
            console.error('Tick handler failed:', err);
            stopCountdown();
        }
    }, function onFinish(err) {
        if (err) {
            console.error('Countdown finished with error:', err);
            return;
        }
        // When countdown finishes, attempt to advance schedule
        const current = getCurrentClass(schedule, window._99_95_utils.now(), date);
        if (current) {
            renderSchedule(schedule, date);
            startCountdown(current, true, schedule, date);
        } else {
            const next = getNextClass(schedule, window._99_95_utils.now(), date);
            if (next) {
                renderSchedule(schedule, date);
                startCountdown(next, false, schedule, date);
            } else {
                // No more classes
                notifElem.querySelector('h1').textContent = 'No more classes today';
                const details = notifElem.querySelector('h2'); if (details) details.textContent = '';
                progressBarContainer && progressBarContainer.remove();
            }
        }
    });
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
    const teacherName = (entry.t || '').trim();
    teacherDetails.textContent = formatTimeRange(date, entry.s, entry.e) + (teacherName ? `: ${teacherName}` : '');
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
    const blocksContainer = blocksElem;
    blocksContainer.innerHTML = schedule.length ? '' : '<h1>No classes today!</h1>';
    const now = moment.tz("Australia/Sydney").toDate();
    schedule.forEach(entry => {
        const start = getDateTime(date, entry.s);
        const end = getDateTime(date, entry.e);
        const isActive = now >= start && now <= end;
        blocksContainer.appendChild(createScheduleBlock(entry, date, isActive));
    });
}

// Check if weekend
function isWeekend(date) {
    return window._99_95_utils.isWeekend(date);
}

// Fetch schedule from chrome.storage.local
function fetchSchedule(date) {
    return new Promise(resolve => {
        chrome.storage.local.get('parsedIcsData', data => {
            if (!data.parsedIcsData) return resolve([]);
            try {
                const allData = JSON.parse(data.parsedIcsData);
                resolve(allData[date] || []);
            } catch (err) {
                console.error('Failed to read parsedIcsData from storage:', err);
                resolve([]);
            }
        });
    });
}

// --- Add navigation arrows and date display ---
function injectNavigationUI() {
    const navContainer = document.createElement('div');
    navContainer.className = 'timetable-nav';
    navContainer.style.display = 'flex';
    navContainer.style.alignItems = 'center';
    navContainer.style.justifyContent = 'center';
    navContainer.style.marginBottom = '12px';
    navContainer.innerHTML = `
        <div class="nav-quick-nav left">
            <button class="yesterday-btn" aria-label="Go to Yesterday">←</button>
        </div>
        <span class="nav-date" style="font-size:1.1rem;font-weight:600;"></span>
        <div class="nav-quick-nav right">
            <button class="tomorrow-btn" aria-label="Go to Tomorrow">→</button>
        </div>
    `;
    // Use cached blocksElem
    blocksElem.parentNode.insertBefore(navContainer, blocksElem);
    navDateElem = navContainer.querySelector('.nav-date');
    navContainer.querySelector('.yesterday-btn').addEventListener('click', () => {
        const d = moment.tz(displayedDate, TZ).subtract(1, 'day').format('YYYY-MM-DD');
        initialize(d);
    });
    navContainer.querySelector('.tomorrow-btn').addEventListener('click', () => {
        const d = moment.tz(displayedDate, TZ).add(1, 'day').format('YYYY-MM-DD');
        initialize(d);
    });
    return navContainer;
}

// --- Update date display ---
function updateNavDate(date) {
    // Use cached navDateElem
    navDateElem.textContent = moment.tz(date, TZ).format('dddd, D MMMM YYYY');
}

// --- Modified main initialization to accept a date ---
async function initialize(dateOverride) {
    const now = window._99_95_utils.now();
    const todayDate = getLocalISODateString(now);
    const currentDate = dateOverride || todayDate;
    displayedDate = currentDate;

    updateNavDate(currentDate);

    if (isWeekend(currentDate)) {
        blocksElem.innerHTML = '<h1>No classes today! It\'s a weekend.</h1>';
        if (currentDate === todayDate) {
            notifElem.innerHTML = '<h1>Enjoy your day off!</h1>';
            stopCountdown();
            if (progressBarContainer) progressBarContainer.remove();
        }
        return;
    }

    const schedule = await fetchSchedule(currentDate);
    renderSchedule(schedule, currentDate);

    if (!schedule.length) {
        if (currentDate === todayDate) {
            notifElem.innerHTML = '<h1>No classes today!</h1>';
            stopCountdown();
            if (progressBarContainer) progressBarContainer.remove();
        }
        return;
    }

    if (currentDate === todayDate) {
        const currentClass = getCurrentClass(schedule, now, currentDate);
        if (currentClass) {
            startCountdown(currentClass, true, schedule, currentDate);
        } else {
            startCountdown(getNextClass(schedule, now, currentDate), false, schedule, currentDate);
        }
    }
}

// Calendar UI
function injectCalendarUI() {

    const calendarIcon = document.createElement('button');
    calendarIcon.className = 'calendar-icon';
    calendarIcon.innerHTML = '📅';
    calendarIcon.setAttribute('aria-label', 'Open Calendar');

    document.body.appendChild(calendarIcon);


    const datePicker = document.createElement('div');
    datePicker.className = 'date-picker-popup';
    datePicker.innerHTML = `
        <div class="date-picker-header">
            <div class="date-picker-month-container">
                <div class="date-picker-month"></div>
                <button class="today-btn" aria-label="Go to Today">Today</button>
            </div>
            <div class="date-picker-nav">
                <button class="prev-month" aria-label="Previous Month">◀</button>
                <button class="next-month" aria-label="Next Month">▶</button>
            </div>
        </div>
        <div class="date-picker-grid">
            <div class="date-picker-weekday">Su</div>
            <div class="date-picker-weekday">Mo</div>
            <div class="date-picker-weekday">Tu</div>
            <div class="date-picker-weekday">We</div>
            <div class="date-picker-weekday">Th</div>
            <div class="date-picker-weekday">Fr</div>


            <div class="date-picker-weekday">Sa</div>
        </div>
    `;
    document.body.appendChild(datePicker);

    let currentMonth = moment.tz("Australia/Sydney");
    let selectedDate = moment.tz(displayedDate, "Australia/Sydney");


    const now = moment.tz("Australia/Sydney");
    const minDate = now.clone().subtract(2, 'years');
    const maxDate = now.clone().add(2, 'years');

    function isDateInRange(date) {
        return date.isSameOrAfter(minDate, 'day') && date.isSameOrBefore(maxDate, 'day');
    }

    function goToToday() {
        currentMonth = now.clone();
        selectedDate = now.clone();
        initialize(now.format('YYYY-MM-DD'));
        renderCalendar();
    }

    function renderCalendar() {
        const monthStart = currentMonth.clone().startOf('month');
        const monthEnd = currentMonth.clone().endOf('month');
        const startDate = monthStart.clone().startOf('week');
        const endDate = monthEnd.clone().endOf('week');
        datePicker.querySelector('.date-picker-month').textContent = currentMonth.format('MMMM YYYY');
        const grid = datePicker.querySelector('.date-picker-grid');
        while (grid.children.length > 7) grid.removeChild(grid.lastChild);
        let currentDate = startDate.clone();
        const fragment = document.createDocumentFragment();
        while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
            const dayElement = document.createElement('div');
            dayElement.className = 'date-picker-day';
            dayElement.textContent = currentDate.date();
            dayElement.dataset.date = currentDate.format('YYYY-MM-DD');
            if (currentDate.isSame(now, 'day')) dayElement.classList.add('today');
            if (currentDate.isSame(selectedDate, 'day')) dayElement.classList.add('selected');
            if (!currentDate.isSame(currentMonth, 'month') || !isDateInRange(currentDate)) dayElement.classList.add('disabled');
            dayElement.addEventListener('click', () => {
                if (!dayElement.classList.contains('disabled')) {
                    const clickedDate = dayElement.dataset.date;
                    selectedDate = moment.tz(clickedDate, "Australia/Sydney");
                    initialize(clickedDate);
                    grid.querySelectorAll('.date-picker-day').forEach(day => day.classList.remove('selected'));
                    dayElement.classList.add('selected');
                }
            });
            fragment.appendChild(dayElement);
            currentDate.add(1, 'day');
        }
        grid.appendChild(fragment);
        const prevMonthBtn = datePicker.querySelector('.prev-month');
        const nextMonthBtn = datePicker.querySelector('.next-month');
        prevMonthBtn.disabled = monthStart.isSameOrBefore(minDate, 'month');
        nextMonthBtn.disabled = monthEnd.isSameOrAfter(maxDate, 'month');
        prevMonthBtn.style.opacity = prevMonthBtn.disabled ? '0.5' : '1';
        nextMonthBtn.style.opacity = nextMonthBtn.disabled ? '0.5' : '1';
    }



    datePicker.querySelector('.today-btn').addEventListener('click', goToToday);

    calendarIcon.addEventListener('click', () => {
        currentMonth = moment.tz(displayedDate, "Australia/Sydney");
        selectedDate = moment.tz(displayedDate, "Australia/Sydney");

        renderCalendar();
        datePicker.classList.toggle('visible');
    });


    datePicker.querySelector('.prev-month').addEventListener('click', () => {
        if (!datePicker.querySelector('.prev-month').disabled) {
            currentMonth.subtract(1, 'month');
            renderCalendar();
        }
    });

    datePicker.querySelector('.next-month').addEventListener('click', () => {
        if (!datePicker.querySelector('.next-month').disabled) {
            currentMonth.add(1, 'month');
            renderCalendar();
        }
    });



    document.addEventListener('click', (event) => {
        if (!datePicker.contains(event.target) && !calendarIcon.contains(event.target)) {
            datePicker.classList.remove('visible');
        }
    });
}

// Keyboard shortcuts for datasheets, Desmos, and day navigation
document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const key = e.key.toLowerCase();
    if (e.key === '1' && sidebarBtns[0]) { sidebarBtns[0].click(); return; }
    if (e.key === '2' && sidebarBtns[1]) { sidebarBtns[1].click(); return; }
    if (e.key === '3' && sidebarBtns[2]) { sidebarBtns[2].click(); return; }
    if (e.key === '4' && sidebarBtns[3]) { sidebarBtns[3].click(); return; }
    if ((e.key === 'd' || e.key === 'D') && sidebarBtns[4]) { sidebarBtns[4].click(); return; }
    if (key === 'q' || e.key === 'ArrowLeft') {
    initialize(moment.tz(displayedDate, TZ).subtract(1, 'day').format('YYYY-MM-DD'));
        return;
    }
    if (key === 'e' || e.key === 'ArrowRight') {
    initialize(moment.tz(displayedDate, TZ).add(1, 'day').format('YYYY-MM-DD'));
        return;
    }
    if (key === 'w' || e.key === 'ArrowUp') {
    initialize(getLocalISODateString(window._99_95_utils.now()));
        return;
    }
});

// Update DOMContentLoaded handler
document.addEventListener('DOMContentLoaded', async () => {
    notifElem = document.querySelector('.notif');
    blocksElem = document.querySelector('.blocks');
    injectSidebarUI();
    injectNavigationUI();
    injectCalendarUI();
    sidebarBtns = [
        document.querySelector('.sidebar-btn[data-pdf="advmath.pdf"]'),
        document.querySelector('.sidebar-btn[data-pdf="standardmath.pdf"]'),
        document.querySelector('.sidebar-btn[data-pdf="chem.pdf"]'),
        document.querySelector('.sidebar-btn[data-pdf="phys.pdf"]'),
        document.querySelector('.sidebar-btn[data-url="https://www.desmos.com/calculator"]')
    ];
    await initialize();
    let lastDate = getLocalISODateString(moment.tz("Australia/Sydney").toDate());
    let lastDateCheck = getLocalISODateString(window._99_95_utils.now());
    const DATE_CHECK_INTERVAL_MS = 30000; // 30s
    const dateInterval = setInterval(() => {
        const now = window._99_95_utils.now();
        const currentDate = getLocalISODateString(now);
        if (displayedDate === lastDateCheck && currentDate !== lastDateCheck) initialize(currentDate);
        lastDateCheck = currentDate;
    }, DATE_CHECK_INTERVAL_MS);

    // Cancel countdown and intervals on unload to avoid leaks
    window.addEventListener('unload', () => {
        stopCountdown();
        clearInterval(dateInterval);
    });
});