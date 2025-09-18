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

let countdownContainer, scheduleContainer, navDateElem, sidebarBtns = [];
let progressBar, progressBarContainer, displayedDate = null;
const ANIM_THROTTLE_MS = 250; // throttle updates to this interval (ms)

// CountdownController: encapsulates requestAnimationFrame loop and exposes start/stop
const CountdownController = (function () {
    let _rafId = null;
    let _lastTs = 0;

    function _step(targetTs, startTs, onTick, onFinish) {
        _rafId = requestAnimationFrame(function frame(ts) {
            try {
                const nowTs = window._99_95_utils.now();
                if (!_lastTs || ts - _lastTs >= ANIM_THROTTLE_MS) {
                    const timeDiff = Math.max(0, targetTs - nowTs);
                    const total = Math.max(0, targetTs - startTs);
                    const percent = total > 0 ? Math.max(0, Math.min(1, (nowTs - startTs) / total)) : 0;
                    onTick && onTick({ nowTs, timeDiff, percent });
                    _lastTs = ts;
                }

                if (nowTs >= targetTs) {
                    // finished
                    stop();
                    onTick && onTick({ nowTs: window._99_95_utils.now(), timeDiff: 0, percent: 1 });
                    onFinish && onFinish();
                    return;
                }

                _step(targetTs, startTs, onTick, onFinish);
            } catch (err) {
                console.error('CountdownController loop error:', err);
                stop();
            }
        });
    }

    function start(targetTs, startTs, onTick, onFinish) {
        stop();
        _lastTs = 0;
        _step(targetTs, startTs, onTick, onFinish);
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

/**
 * stopCountdown - stop any running countdown.
 */
function stopCountdown() {
    try { CountdownController.stop(); } catch (e) { console.debug('Error in stopCountdown:', e && e.message); }
}

// Inject embed viewer UI
function injectEmbedViewerUI() {


    // Embed Viewer
    const embedViewer = document.createElement("div");
    embedViewer.className = "embed-viewer hidden";
    embedViewer.setAttribute("role", "dialog");
    embedViewer.setAttribute("aria-modal", "true");
    embedViewer.innerHTML = `
        <button class="close-embed" aria-label="Close">×</button>
        <iframe class="embed-frame" frameborder="0"></iframe>
    `;

    document.body.append(embedViewer);

    // Restore theme
    if (localStorage.getItem("theme") === "light") document.body.classList.add("light-mode");







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


}

// Find the next class (assumes schedule times are sorted). All times are epoch ms.
function getNextClass(schedule, nowTs, date) {
    return schedule.find(entry => getDateTime(date, entry.s) > nowTs) || null;
}

// Find current class
function getCurrentClass(schedule, nowTs, date) {
    return schedule.find(entry => {
        const start = getDateTime(date, entry.s);
        const end = getDateTime(date, entry.e);
        return nowTs >= start && nowTs <= end;
    }) || null;
}

// Countdown function
/**
 * startCountdown - begin the visual countdown for a target entry.
 * @param {object} target - schedule entry
 * @param {boolean} isCurrentClass
 * @param {Array} schedule
 * @param {string} date - YYYY-MM-DD
 */
function startCountdown(target, isCurrentClass, schedule, date) {
    const notif = countdownContainer;
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
        // Accessibility: role and basic aria attributes
        progressBar.setAttribute('role', 'progressbar');
        progressBar.setAttribute('aria-valuemin', '0');
        progressBar.setAttribute('aria-valuemax', '100');
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
    CountdownController.start(targetTime, countdownStartTime, ({ nowTs, timeDiff, percent }) => {
        try {
            // Use transform for smoother, GPU-composited updates
            progressBar.style.transform = 'scaleX(' + percent + ')';
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
        // When countdown finishes, re-fetch schedule to avoid stale objects
        (async () => {
            try {
                const fresh = await fetchSchedule(date);
                const nowTs = window._99_95_utils.now();
                const current = getCurrentClass(fresh, nowTs, date);
                if (current) {
                    renderSchedule(fresh, date);
                    startCountdown(current, true, fresh, date);
                    return;
                }
                const next = getNextClass(fresh, nowTs, date);
                if (next) {
                    renderSchedule(fresh, date);
                    startCountdown(next, false, fresh, date);
                    return;
                }
                // No more classes
                const h1 = countdownContainer.querySelector('h1'); if (h1) h1.textContent = 'No more classes today';
                const details = countdownContainer.querySelector('h2'); if (details) details.textContent = '';
                progressBarContainer && progressBarContainer.remove();
            } catch (e) {
                console.error('Error advancing schedule after finish:', e);
                stopCountdown();
            }
        })();
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

    // Responsive font size: shrink if text is too long
    // Use a temporary span to measure width
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.fontSize = '1.1rem';
    tempSpan.style.fontWeight = '500';
    tempSpan.textContent = entry.n;
    document.body.appendChild(tempSpan);
    const maxWidth = window.innerWidth * 0.47; // match max-width in CSS
    if (tempSpan.offsetWidth > maxWidth) {
        className.classList.add('shrink');
    }
    if (tempSpan.offsetWidth > maxWidth * 1.15) {
        className.classList.add('shrink2');
    }
    if (tempSpan.offsetWidth > maxWidth * 1.35) {
        className.classList.add('shrink3');
    }
    document.body.removeChild(tempSpan);

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
    const container = scheduleContainer;
    if (!schedule.length) {
        container.innerHTML = '<h1>No classes today!</h1>';
        return;
    }
    // Build fragment to minimize reflows
    const frag = document.createDocumentFragment();
    const nowTs = window._99_95_utils.now();
    for (let i = 0; i < schedule.length; i++) {
        const entry = schedule[i];
        const start = getDateTime(date, entry.s);
        const end = getDateTime(date, entry.e);
        const isActive = nowTs >= start && nowTs <= end;
        frag.appendChild(createScheduleBlock(entry, date, isActive));
    }
    // Replace children in one operation
    container.innerHTML = '';
    container.appendChild(frag);
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
                const day = allData[date] || [];
                // Basic validation: ensure array of objects with s/e
                if (!Array.isArray(day)) return resolve([]);
                const filtered = day.filter(d => d && d.s && d.e && d.n);
                resolve(filtered);
            } catch (err) {
                console.error('Failed to read parsedIcsData from storage:', err);
                // Show a user-facing message to repair timetable
                if (countdownContainer) {
                    countdownContainer.innerHTML = '<h1>Timetable data is corrupted.</h1><p>Please re-upload your timetable.</p><button class="repair-btn">Re-upload timetable</button>';
                    const btn = countdownContainer.querySelector('.repair-btn');
                    btn && btn.addEventListener('click', () => window.location.href = '../landing-page/landing.html');
                }
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
    scheduleContainer.parentNode.insertBefore(navContainer, scheduleContainer);
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

    // Always stop previous countdown while (re)initializing
    stopCountdown();
    updateNavDate(currentDate);

    if (isWeekend(currentDate)) {
        scheduleContainer.innerHTML = '<h1>No classes today! It\'s a weekend.</h1>';
        if (currentDate === todayDate) {
            countdownContainer.innerHTML = '<h1>Enjoy your day off!</h1>';
            stopCountdown();
            if (progressBarContainer) progressBarContainer.remove();
        }
        return;
    }

    const schedule = await fetchSchedule(currentDate);
    renderSchedule(schedule, currentDate);

    if (!schedule.length) {
        if (currentDate === todayDate) {
            countdownContainer.innerHTML = '<h1>No classes today!</h1>';
            stopCountdown();
            if (progressBarContainer) progressBarContainer.remove();
        }
        return;
    }

    if (currentDate === todayDate) {
        const nowTs = window._99_95_utils.now();
        const currentClass = getCurrentClass(schedule, nowTs, currentDate);
        if (currentClass) {
            startCountdown(currentClass, true, schedule, currentDate);
        } else {
            startCountdown(getNextClass(schedule, nowTs, currentDate), false, schedule, currentDate);
        }
    }
}

// Calendar UI
function injectCalendarUI() {

    const calendarIcon = document.createElement('button');
    calendarIcon.className = 'calendar-icon';
    calendarIcon.innerHTML = '📅';
    calendarIcon.setAttribute('aria-label', 'Open Calendar');

    // Create to-do list button (positioned between calendar and wolfram)
    const todoBtn = document.createElement('button');
    todoBtn.className = 'reference-btn todo-btn';
    todoBtn.setAttribute('title', 'To-Do List (T)');
    todoBtn.innerHTML = '<img src="../assets/checkmarktodo.png" alt="To-Do" class="todo-icon">';
    todoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTodoSidebar();
    });

    // Create Wolfram button (positioned between todo and reference buttons)
    const wolframBtn = document.createElement('button');
    wolframBtn.className = 'reference-btn wolfram-btn utilities-btn';
    wolframBtn.setAttribute('title', 'Wolfram Alpha');
    wolframBtn.innerHTML = '<img src="../assets/wolfram.png" alt="Wolfram" class="reference-icon">';
    wolframBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openWolframPage();
    });

    // Create Desmos button (positioned below wolfram button)
    const desmosBtn = document.createElement('button');
    desmosBtn.className = 'reference-btn desmos-btn utilities-btn';
    desmosBtn.setAttribute('title', 'Desmos Calculator');
    desmosBtn.innerHTML = '<img src="../assets/desmos.png" alt="Desmos" class="reference-icon">';
    desmosBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openDesmosPage();
    });

    // Create Integral Calculator button (positioned below desmos button)
    const integralBtn = document.createElement('button');
    integralBtn.className = 'reference-btn integral-btn utilities-btn';
    integralBtn.setAttribute('title', 'Integral Calculator');
    integralBtn.innerHTML = '<img src="../assets/integral.png" alt="Integral" class="reference-icon">';
    integralBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openIntegralPage();
    });

    // Create Derivative Calculator button (positioned below integral button)
    const derivativeBtn = document.createElement('button');
    derivativeBtn.className = 'reference-btn derivative-btn utilities-btn';
    derivativeBtn.setAttribute('title', 'Derivative Calculator');
    derivativeBtn.innerHTML = '<img src="../assets/derivitive.png" alt="Derivative" class="reference-icon">';
    derivativeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openDerivativePage();
    });

    // Create reference sheet buttons container
    const referenceButtonsContainer = document.createElement('div');
    referenceButtonsContainer.className = 'reference-buttons-container';
    
    // Create reference sheet buttons
    const referenceButtons = [
        { pdf: 'advmath.pdf', label: 'Math Advanced', shortcut: '1', icon: '../assets/ma.png' },
        { pdf: 'standardmath.pdf', label: 'Math Standard', shortcut: '2', icon: '../assets/ms.png' },
        { pdf: 'chem.pdf', label: 'flask', shortcut: '3', icon: '../assets/flask-with-liquid.svg' },
        { pdf: 'phys.pdf', label: 'atom', shortcut: '4', icon: '../assets/atom.svg' }
    ];

    // Create and append reference sheet buttons
    referenceButtons.forEach(({ pdf, label, shortcut, icon }, idx) => {
        const btn = document.createElement('button');
        btn.className = 'reference-btn';
        if (idx === 0) btn.classList.add('refsheet-btn'); // Unique class for tutorial
        btn.setAttribute('data-pdf', pdf);
        btn.setAttribute('title', `${label} (${shortcut})`);
        btn.innerHTML = `<img src="${icon}" alt="${label}" class="reference-icon">`;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openReferenceSheet(pdf);
        });
        referenceButtonsContainer.appendChild(btn);
    });

    // Function to open reference sheet
    function openReferenceSheet(pdfName) {
        const embedViewer = document.querySelector('.embed-viewer');
        if (!embedViewer) return;
        
        const src = chrome.runtime.getURL('popup/' + pdfName);
        embedViewer.innerHTML = `
            <button class="close-embed" aria-label="Close">×</button>
            <iframe class="embed-frame" frameborder="0"></iframe>
        `;
        const newFrame = embedViewer.querySelector('.embed-frame');
        newFrame.src = src;
        embedViewer.classList.remove('hidden');
        embedViewer.classList.add('pdf-view');
        
        // Re-wire close
        embedViewer.querySelector('.close-embed').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            embedViewer.classList.add('hidden');
            embedViewer.querySelector('.embed-frame') && (embedViewer.querySelector('.embed-frame').src = '');
        });
        
        // Load/error handling
        newFrame.addEventListener('error', () => {
            embedViewer.classList.remove('pdf-view');
            embedViewer.classList.remove('hidden');
            embedViewer.innerHTML = `<div class="embed-error"><p>Failed to load PDF.</p><button class="open-new-tab">Open in new tab</button></div>`;
            const btn = embedViewer.querySelector('.open-new-tab');
            btn && btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try { chrome.tabs.create({ url: src }); } catch (e) { window.open(src, '_blank'); }
            });
        });
    }

    // Function to open Wolfram Alpha in new tab
    function openWolframPage() {
        const wolframUrl = 'https://www.wolframalpha.com/';
        try { 
            chrome.tabs.create({ url: wolframUrl }); 
        } catch (e) { 
            window.open(wolframUrl, '_blank'); 
        }
    }

    // Function to open Desmos in iframe (retaining iframe functionality)
    function openDesmosPage() {
        const embedViewer = document.querySelector('.embed-viewer');
        if (!embedViewer) return;
        
        const desmosUrl = 'https://www.desmos.com/calculator';
        embedViewer.innerHTML = `
            <button class="close-embed" aria-label="Close">×</button>
            <iframe class="embed-frame" frameborder="0"></iframe>
        `;
        const newFrame = embedViewer.querySelector('.embed-frame');
        newFrame.src = desmosUrl;
        embedViewer.classList.remove('hidden');
        embedViewer.classList.add('desmos-view');
        
        // Re-wire close
        embedViewer.querySelector('.close-embed').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            embedViewer.classList.add('hidden');
            embedViewer.querySelector('.embed-frame') && (embedViewer.querySelector('.embed-frame').src = '');
        });
        
        // Load/error handling
        newFrame.addEventListener('error', () => {
            embedViewer.classList.remove('desmos-view');
            embedViewer.classList.remove('hidden');
            embedViewer.innerHTML = `<div class="embed-error"><p>Desmos could not be embedded in the popup. Open in a new tab instead?</p><button class="open-new-tab">Open in new tab</button></div>`;
            const btn = embedViewer.querySelector('.open-new-tab');
            btn && btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try { chrome.tabs.create({ url: desmosUrl }); } catch (e) { window.open(desmosUrl, '_blank'); }
            });
        });
    }

    // Function to open Integral Calculator in new tab
    function openIntegralPage() {
        const integralUrl = 'https://www.integral-calculator.com/';
        try { 
            chrome.tabs.create({ url: integralUrl }); 
        } catch (e) { 
            window.open(integralUrl, '_blank'); 
        }
    }

    // Function to open Derivative Calculator in new tab
    function openDerivativePage() {
        const derivativeUrl = 'https://www.derivative-calculator.net/';
        try { 
            chrome.tabs.create({ url: derivativeUrl }); 
        } catch (e) { 
            window.open(derivativeUrl, '_blank'); 
        }
    }

    // Create todo sidebar
    const todoSidebar = document.createElement("div");
    todoSidebar.className = "todo-sidebar";
    todoSidebar.setAttribute("role", "complementary");
    todoSidebar.innerHTML = `
        <div class="todo-sidebar-content">
            <div class="todo-sidebar-header">
                <h2 class="todo-sidebar-heading">To-Do List</h2>
                <button class="todo-close-btn" aria-label="Close To-Do List">×</button>
            </div>
            
            <!-- Middle content area - scrollable -->
            <div class="todo-sections-container">
                <!-- Active Tasks Section -->
                <div class="todo-section active-tasks-section">
                    <div class="todo-section-header">
                        <h3 class="todo-section-title">Active Tasks</h3>
                        <span class="todo-count" id="activeTaskCount">0</span>
                    </div>
                    <div class="todo-input-container">
                        <input type="text" class="todo-input" placeholder="Add a new task..." maxlength="84">
                        <button class="todo-add-btn" aria-label="Add Task">+</button>
                    </div>
                    <div class="todo-list-container">
                        <ul class="todo-list active-tasks" id="activeTodoList">
                            <!-- Active tasks will be populated here -->
                        </ul>
                    </div>
                </div>
                
                <!-- Completed Tasks Section -->
                <div class="todo-section completed-tasks-section">
                    <div class="todo-section-header collapsible" id="completedTasksHeader">
                        <h3 class="todo-section-title">Completed Tasks</h3>
                        <div class="todo-section-controls">
                            <span class="todo-count" id="completedTaskCount">0</span>
                            <button class="todo-section-toggle" aria-label="Toggle Completed Tasks">
                                <span class="toggle-icon">▼</span>
                            </button>
                        </div>
                    </div>
                    <div class="todo-list-container completed-tasks-container collapsed" id="completedTasksContainer">
                        <ul class="todo-list completed-tasks" id="completedTodoList">
                            <!-- Completed tasks will be populated here -->
                        </ul>
                    </div>
                </div>
            </div>
            
            <div class="todo-sidebar-footer">
                <button class="todo-clear-btn" id="clearCompletedBtn">Clear Completed</button>
                <button class="todo-clear-all-btn" id="clearAllBtn">Clear All</button>
            </div>
        </div>
    `;
    document.body.appendChild(todoSidebar);

    // Todo list functionality
    let todos = [];
    
    function loadTodos() {
        const saved = localStorage.getItem('todos');
        todos = saved ? JSON.parse(saved) : [];
    }
    
    function saveTodos() {
        localStorage.setItem('todos', JSON.stringify(todos));
    }
    
    function renderTodos() {
        const activeTodoList = document.getElementById('activeTodoList');
        const completedTodoList = document.getElementById('completedTodoList');
        const activeTaskCount = document.getElementById('activeTaskCount');
        const completedTaskCount = document.getElementById('completedTaskCount');
        
        if (!activeTodoList || !completedTodoList) return;
        
        // Clear both lists
        activeTodoList.innerHTML = '';
        completedTodoList.innerHTML = '';
        
        // Separate active and completed tasks
        const activeTodos = todos.filter(todo => !todo.completed);
        const completedTodos = todos.filter(todo => todo.completed);
        
        // Update task counts
        if (activeTaskCount) activeTaskCount.textContent = activeTodos.length;
        if (completedTaskCount) completedTaskCount.textContent = completedTodos.length;
        
        // Render active tasks
        activeTodos.forEach((todo, index) => {
            const li = createTodoItem(todo, todos.indexOf(todo));
            activeTodoList.appendChild(li);
        });
        
        // Render completed tasks
        completedTodos.forEach((todo, index) => {
            const li = createTodoItem(todo, todos.indexOf(todo));
            completedTodoList.appendChild(li);
        });
        
        updateClearButtons();
    }
    
    function createTodoItem(todo, originalIndex) {
        const li = document.createElement('li');
        li.className = 'todo-item';
        li.draggable = true;
        li.dataset.index = originalIndex;
        li.innerHTML = `
            <label class="todo-checkbox-container">
                <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                <span class="todo-text ${todo.completed ? 'completed' : ''}" title="${todo.text}">${todo.text}</span>
            </label>
            <button class="todo-delete-btn" aria-label="Delete Task">×</button>
        `;
        
        // Checkbox event
        const checkbox = li.querySelector('.todo-checkbox');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            todos[originalIndex].completed = checkbox.checked;
            saveTodos();
            renderTodos();
        });
        
        // Delete button event
        const deleteBtn = li.querySelector('.todo-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            todos.splice(originalIndex, 1);
            saveTodos();
            renderTodos();
        });
        
        // Drag and drop events (only for active tasks)
        if (!todo.completed) {
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', originalIndex);
                li.classList.add('dragging');
            });

            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
            });

            li.addEventListener('dragover', (e) => {
                e.preventDefault();
                li.classList.add('drag-over');
            });

            li.addEventListener('dragleave', () => {
                li.classList.remove('drag-over');
            });

            li.addEventListener('drop', (e) => {
                e.preventDefault();
                li.classList.remove('drag-over');

                const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const dropIndex = originalIndex;

                if (draggedIndex !== dropIndex) {
                    // Reorder the todos array
                    const draggedTodo = todos[draggedIndex];
                    todos.splice(draggedIndex, 1);
                    todos.splice(dropIndex, 0, draggedTodo);

                    // Save and re-render
                    saveTodos();
                    renderTodos();
                }
            });
        }
        
        return li;
    }
    
    function updateClearButtons() {
        const clearCompletedBtn = document.getElementById('clearCompletedBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');
        
        if (clearCompletedBtn) {
            clearCompletedBtn.disabled = !todos.some(todo => todo.completed);
        }
        
        if (clearAllBtn) {
            clearAllBtn.disabled = todos.length === 0;
        }
    }
    
    function addTodo(text) {
        if (todos.length >= 10) {
            alert('Maximum 10 tasks allowed!');
            return;
        }
        
        if (text.trim().length === 0) {
            return;
        }
        
        todos.push({
            text: text.trim(),
            completed: false
        });
        
        saveTodos();
        renderTodos();
    }
    
    function clearCompletedTodos() {
        todos = todos.filter(todo => !todo.completed);
        saveTodos();
        renderTodos();
    }
    
    function clearAllTodos() {
        if (confirm('Are you sure you want to clear all tasks?')) {
            todos = [];
            saveTodos();
            renderTodos();
        }
    }
    
    function toggleTodoSidebar() {
        const todoSidebar = document.querySelector('.todo-sidebar');
        if (todoSidebar) {
            todoSidebar.classList.toggle('visible');
        }
    }
    
    function initTodoFunctionality() {
        loadTodos();
        renderTodos();
        
        // Input and add button
        const todoInput = document.querySelector('.todo-input');
        const todoAddBtn = document.querySelector('.todo-add-btn');
        
        if (todoInput && todoAddBtn) {
            todoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    addTodo(todoInput.value);
                    todoInput.value = '';
                }
            });
            
            todoAddBtn.addEventListener('click', () => {
                addTodo(todoInput.value);
                todoInput.value = '';
            });
        }
        
        // Clear buttons
        const clearCompletedBtn = document.getElementById('clearCompletedBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');
        
        if (clearCompletedBtn) {
            clearCompletedBtn.addEventListener('click', clearCompletedTodos);
        }
        
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', clearAllTodos);
        }
        
        // Collapsible completed tasks section
        const completedTasksHeader = document.getElementById('completedTasksHeader');
        const completedTasksContainer = document.getElementById('completedTasksContainer');
        
        if (completedTasksHeader && completedTasksContainer) {
            completedTasksHeader.addEventListener('click', () => {
                completedTasksContainer.classList.toggle('collapsed');
                const toggleIcon = completedTasksHeader.querySelector('.toggle-icon');
                if (toggleIcon) {
                    toggleIcon.textContent = completedTasksContainer.classList.contains('collapsed') ? '▼' : '▲';
                }
            });
        }
        
        // Close button
        const todoCloseBtn = document.querySelector('.todo-close-btn');
        if (todoCloseBtn) {
            todoCloseBtn.addEventListener('click', toggleTodoSidebar);
        }
        
        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            const todoSidebar = document.querySelector('.todo-sidebar');
            if (todoSidebar && todoSidebar.classList.contains('visible')) {
                // Don't close if clicking on todo elements or buttons
                if (!todoSidebar.contains(e.target) && 
                    !e.target.classList.contains('todo-btn') &&
                    !e.target.closest('.todo-item') &&
                    !e.target.closest('.todo-delete-btn') &&
                    !e.target.closest('.todo-checkbox')) {
                    todoSidebar.classList.remove('visible');
                }
            }
        });
        
        // Keyboard shortcut for todo list
        document.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            if (e.key.toLowerCase() === 't') {
                toggleTodoSidebar();
            }
        });
    }
    
    // Initialize todo functionality
    initTodoFunctionality();

    // Create settings buttons container (right side)
    const settingsButtonsContainer = document.createElement('div');
    settingsButtonsContainer.className = 'settings-buttons-container';
    
    // Create settings buttons
    const settingsButtons = [
        { id: 'scrollbar-toggle-btn', title: 'Toggle Scrollbar', icon: '../assets/scroll toggle.png', shortcut: 'S', isImage: true },
        { id: 'size-toggle-btn', title: 'Toggle Window Size', icon: '⛶', shortcut: 'V', isImage: false },
        { id: 'upload-btn', title: 'Upload New Timetable', icon: '../assets/upload.svg', shortcut: 'U', isImage: true },
        { id: 'toggle-btn', title: 'Toggle Theme', icon: '../assets/light or dark.svg', shortcut: 'T', isImage: true },
        { id: 'cherry-toggle-btn', title: 'Cherry Blossom Theme', icon: '', shortcut: 'C', isImage: false },
        { id: 'navy-toggle-btn', title: 'Navy Blue Theme', icon: '', shortcut: 'N', isImage: false }
    ];

    // Create and append settings buttons
    settingsButtons.forEach(({ id, title, icon, shortcut, isImage }) => {
        const btn = document.createElement('button');
        btn.className = 'settings-btn';
        btn.id = id;
        btn.setAttribute('title', `${title} (${shortcut})`);
        
        if (isImage) {
            const img = document.createElement('img');
            img.src = icon;
            img.alt = title;
            img.className = 'settings-icon';
            btn.appendChild(img);
        } else {
            btn.innerHTML = icon;
        }
        
        settingsButtonsContainer.appendChild(btn);
    });

    // Add event listeners for settings buttons
    const scrollbarToggleBtn = settingsButtonsContainer.querySelector('#scrollbar-toggle-btn');
    const sizeToggleBtn = settingsButtonsContainer.querySelector('#size-toggle-btn');
    const uploadBtn = settingsButtonsContainer.querySelector('#upload-btn');
    const toggleBtn = settingsButtonsContainer.querySelector('#toggle-btn');
    const cherryToggleBtn = settingsButtonsContainer.querySelector('#cherry-toggle-btn');
    const navyToggleBtn = settingsButtonsContainer.querySelector('#navy-toggle-btn');

    // Scrollbar toggle
    document.body.classList.toggle('scrollbar-off', localStorage.getItem('scrollbar') === 'off');
    scrollbarToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('scrollbar-off');
        localStorage.setItem('scrollbar', document.body.classList.contains('scrollbar-off') ? 'off' : 'on');
    });

    // Size toggle
    const savedSize = localStorage.getItem('windowSize');
    if (savedSize === 'compact') {
        document.documentElement.style.width = '630px';
        document.body.style.width = '630px';
        sizeToggleBtn.textContent = '⛶';
    } else {
        sizeToggleBtn.textContent = '⛶';
    }
    sizeToggleBtn.addEventListener('click', () => {
        const isCompact = document.documentElement.style.width === '630px';
        const newWidth = isCompact ? '800px' : '630px';
        document.documentElement.style.width = newWidth;
        document.body.style.width = newWidth;
        localStorage.setItem('windowSize', isCompact ? 'full' : 'compact');
    });

    // Upload timetable
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

    // Theme toggle
    const theme = localStorage.getItem("theme");
    if (theme === "light") {
        document.body.classList.add("light-mode");
        document.body.classList.remove("cherry-blossom-mode", "navy-blue-mode");
    } else if (theme === "cherry") {
        document.body.classList.add("cherry-blossom-mode");
        document.body.classList.remove("light-mode", "navy-blue-mode");
    } else if (theme === "navy") {
        document.body.classList.add("navy-blue-mode");
        document.body.classList.remove("light-mode", "cherry-blossom-mode");
    } else {
        document.body.classList.remove("light-mode", "cherry-blossom-mode", "navy-blue-mode");
    }
    toggleBtn.addEventListener('click', () => {
        if (document.body.classList.contains("light-mode")) {
            document.body.classList.remove("light-mode");
            localStorage.setItem("theme", "dark");
        } else {
            document.body.classList.remove("cherry-blossom-mode", "navy-blue-mode");
            document.body.classList.add("light-mode");
            localStorage.setItem("theme", "light");
        }
    });
    // Cherry blossom theme toggle
    cherryToggleBtn.textContent = '🌸';
    cherryToggleBtn.addEventListener('click', () => {
        if (document.body.classList.contains("cherry-blossom-mode")) {
            document.body.classList.remove("cherry-blossom-mode");
            localStorage.setItem("theme", "dark");
        } else {
            document.body.classList.remove("light-mode", "navy-blue-mode");
            document.body.classList.add("cherry-blossom-mode");
            localStorage.setItem("theme", "cherry");
        }
    });
    // Navy blue theme toggle
    navyToggleBtn.textContent = '🌑';
    navyToggleBtn.addEventListener('click', () => {
        if (document.body.classList.contains("navy-blue-mode")) {
            document.body.classList.remove("navy-blue-mode");
            localStorage.setItem("theme", "dark");
        } else {
            document.body.classList.remove("light-mode", "cherry-blossom-mode");
            document.body.classList.add("navy-blue-mode");
            localStorage.setItem("theme", "navy");
        }
    });

    // Create left-side container for all buttons and dividers
    const leftSideContainer = document.createElement('div');
    leftSideContainer.className = 'left-side-container';
    
    // Append elements in order: calendar, todo, wolfram, desmos, integral, derivative, reference buttons
    leftSideContainer.appendChild(calendarIcon);
    leftSideContainer.appendChild(todoBtn);
    
    // Add dividing line between todo and wolfram
    const todoWolframDivider = document.createElement('div');
    todoWolframDivider.className = 'todo-wolfram-divider';
    leftSideContainer.appendChild(todoWolframDivider);
    
    leftSideContainer.appendChild(wolframBtn);
    leftSideContainer.appendChild(desmosBtn);
    leftSideContainer.appendChild(integralBtn);
    leftSideContainer.appendChild(derivativeBtn);
    
    // Add dividing line between websites and reference sheets
    const dividingLine = document.createElement('div');
    dividingLine.className = 'dividing-line';
    leftSideContainer.appendChild(dividingLine);
    
    leftSideContainer.appendChild(referenceButtonsContainer);
    
    // Append the container to body
    document.body.appendChild(leftSideContainer);
    
    // Create settings toggle button
    const settingsToggleBtn = document.createElement('button');
    settingsToggleBtn.className = 'settings-toggle-btn';
    settingsToggleBtn.setAttribute('title', 'Settings (S)');
    settingsToggleBtn.innerHTML = '<img src="../assets/temporary settings tag.png" alt="Settings" class="settings-icon">';
    settingsToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSettingsSidebar();
    });
    document.body.appendChild(settingsToggleBtn);

    // --- NEW: Create utilities toggle button for click-only mode ---
    const utilitiesToggleBtn = document.createElement('button');
    utilitiesToggleBtn.className = 'utilities-toggle-btn';
    utilitiesToggleBtn.setAttribute('title', 'Toggle Utilities (U)');
    utilitiesToggleBtn.innerHTML = '<img src="../assets/utilities_button.png" alt="Utilities" class="utilities-icon">';
    utilitiesToggleBtn.style.display = 'none';
    utilitiesToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleUtilitiesPanel();
    });
    document.body.appendChild(utilitiesToggleBtn);

    function toggleUtilitiesPanel() {
        const leftContainer = document.querySelector('.left-side-container');
        leftContainer.classList.toggle('visible');
    }

    // Proximity detection for utilities button (like settings button)
    let utilitiesButtonTimeout;
    let isUtilitiesButtonVisible = false;

    document.addEventListener('mousemove', (e) => {
        const currentUtilities = localStorage.getItem('utilities') || 'always';
        if (currentUtilities !== 'click') return;

        const buttonRect = utilitiesToggleBtn.getBoundingClientRect();
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const buttonCenterX = buttonRect.left + buttonRect.width / 2;
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;
        const distance = Math.sqrt(
            Math.pow(mouseX - buttonCenterX, 2) +
            Math.pow(mouseY - buttonCenterY, 2)
        );

        if (distance <= 100 && !isUtilitiesButtonVisible) {
            showUtilitiesButton();
        } else if (distance > 100 && isUtilitiesButtonVisible) {
            clearTimeout(utilitiesButtonTimeout);
            utilitiesButtonTimeout = setTimeout(() => {
                hideUtilitiesButton();
            }, 500);
        }
    });

    function showUtilitiesButton() {
        isUtilitiesButtonVisible = true;
        utilitiesToggleBtn.classList.add('visible');
        clearTimeout(utilitiesButtonTimeout);
    }

    function hideUtilitiesButton() {
        isUtilitiesButtonVisible = false;
        utilitiesToggleBtn.classList.remove('visible');
    }

    // Create settings sidebar
    const settingsSidebar = document.createElement('div');
    settingsSidebar.className = 'settings-sidebar';
    settingsSidebar.innerHTML = `
        <div class="settings-sidebar-header">
            <h2 class="settings-sidebar-heading">Settings</h2>
        </div>
        
        <div class="settings-sidebar-content">
            <!-- Settings buttons will be moved here -->
            <div class="settings-group">
                <label class="settings-group-label">Theme</label>
                <div class="radio-group">
                    <label class="radio-item">
                        <input type="radio" name="theme" value="dark" id="theme-dark">
                        <span class="radio-button"></span>
                        <span class="radio-text">Dark</span>
                    </label>
                    <label class="radio-item">
                        <input type="radio" name="theme" value="light" id="theme-light">
                        <span class="radio-button"></span>
                        <span class="radio-text">Light</span>
                    </label>
                </div>
            </div>
            
            <div class="settings-group">
                <label class="settings-group-label">Layout</label>
                <div class="radio-group">
                    <label class="radio-item">
                        <input type="radio" name="size" value="full" id="size-full">
                        <span class="radio-button"></span>
                        <span class="radio-text">Full Size</span>
                    </label>
                    <label class="radio-item">
                        <input type="radio" name="size" value="compact" id="size-compact">
                        <span class="radio-button"></span>
                        <span class="radio-text">Compact</span>
                    </label>
                </div>
            </div>
            
            <div class="settings-group">
                <label class="settings-group-label">Scrollbar</label>
                <div class="radio-group">
                    <label class="radio-item">
                        <input type="radio" name="scrollbar" value="on" id="scrollbar-on">
                        <span class="radio-button"></span>
                        <span class="radio-text">Show</span>
                    </label>
                    <label class="radio-item">
                        <input type="radio" name="scrollbar" value="off" id="scrollbar-off">
                        <span class="radio-button"></span>
                        <span class="radio-text">Hide</span>
                    </label>
                </div>
            </div>
            
            <div class="settings-group">
                <label class="settings-group-label">Utilities Panel</label>
                <div class="radio-group">
                    <label class="radio-item">
                        <input type="radio" name="utilities" value="always" id="utilities-always">
                        <span class="radio-button"></span>
                        <span class="radio-text">Always Show</span>
                    </label>
                    <label class="radio-item">
                        <input type="radio" name="utilities" value="hover" id="utilities-hover">
                        <span class="radio-button"></span>
                        <span class="radio-text">Show on Hover</span>
                    </label>
                    <label class="radio-item">
                        <input type="radio" name="utilities" value="click" id="utilities-click">
                        <span class="radio-button"></span>
                        <span class="radio-text">Show on Click</span>
                    </label>
                </div>
            </div>
            
            <div class="settings-group">
                <label class="settings-group-label">Timetable</label>
                <button class="upload-btn" id="upload-timetable-btn">
                    <img src="../assets/upload.svg" alt="Upload" class="toggle-icon">
                    Upload New Timetable
                </button>
            </div>
        </div>
        
        <div class="settings-sidebar-footer">
            <p class="settings-credit">Made with love by the team behind <a href="#" class="credit-link">99.95</a></p>
        </div>
    `;
    document.body.appendChild(settingsSidebar);

    // Initialize settings radio buttons and logic
    function initSettingsToggles() {
        const uploadBtn = document.getElementById('upload-timetable-btn');
        
        // Set initial states
        const currentTheme = localStorage.getItem('theme') || 'dark';
        const currentSize = localStorage.getItem('windowSize') || 'full';
        const currentScrollbar = localStorage.getItem('scrollbar') || 'on';
        const currentUtilities = localStorage.getItem('utilities') || 'always';
        
        const themeRadio = document.getElementById(`theme-${currentTheme}`);
        if (themeRadio) themeRadio.checked = true;
        const sizeRadio = document.getElementById(`size-${currentSize}`);
        if (sizeRadio) sizeRadio.checked = true;
        const scrollbarRadio = document.getElementById(`scrollbar-${currentScrollbar}`);
        if (scrollbarRadio) scrollbarRadio.checked = true;
        const utilitiesRadio = document.getElementById(`utilities-${currentUtilities}`);
        if (utilitiesRadio) utilitiesRadio.checked = true;
        
        // Theme radio buttons
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const isLight = e.target.value === 'light';
                document.body.classList.toggle('light-mode', isLight);
                document.body.classList.remove('cherry-blossom-mode', 'navy-blue-mode');
                localStorage.setItem('theme', e.target.value);
            });
        });
        
        // Size radio buttons
        document.querySelectorAll('input[name="size"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const newWidth = e.target.value === 'compact' ? '630px' : '800px';
                document.documentElement.style.width = newWidth;
                document.body.style.width = newWidth;
                localStorage.setItem('windowSize', e.target.value);
            });
        });
        
        // Scrollbar radio buttons
        document.querySelectorAll('input[name="scrollbar"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.body.classList.toggle('scrollbar-off', e.target.value === 'off');
                localStorage.setItem('scrollbar', e.target.value);
            });
        });
        
        // Utilities radio buttons
        document.querySelectorAll('input[name="utilities"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const leftContainer = document.querySelector('.left-side-container');
                const utilitiesToggleBtn = document.querySelector('.utilities-toggle-btn');
                if (e.target.value === 'click') {
                    leftContainer.classList.add('click-only');
                    leftContainer.classList.remove('hover-only');
                    utilitiesToggleBtn.style.display = 'block';
                } else {
                    leftContainer.classList.remove('click-only');
                    leftContainer.classList.remove('hover-only');
                    leftContainer.classList.remove('visible');
                    utilitiesToggleBtn.style.display = 'none';
                }
                localStorage.setItem('utilities', e.target.value);
            });
        });
        
        // Apply initial utilities setting
        const leftContainer = document.querySelector('.left-side-container');
        const utilitiesToggleBtn = document.querySelector('.utilities-toggle-btn');
        if (currentUtilities === 'click') {
            leftContainer.classList.add('click-only');
            leftContainer.classList.remove('hover-only');
            utilitiesToggleBtn.style.display = 'block';
        } else {
            leftContainer.classList.remove('click-only');
            leftContainer.classList.remove('hover-only');
            leftContainer.classList.remove('visible');
            utilitiesToggleBtn.style.display = 'none';
        }
        
        if (uploadBtn) {
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
        }
    }

    initSettingsToggles();

    // Add event listeners for settings sidebar
    // Close button removed - sidebar can be closed by clicking outside or pressing S key
    
    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (settingsSidebar.classList.contains('visible') && 
            !settingsSidebar.contains(e.target) && 
            !settingsToggleBtn.contains(e.target)) {
            settingsSidebar.classList.remove('visible');
            // Remove sidebar-open immediately so button starts moving
            document.body.classList.remove('sidebar-open');
            // Keep blur during sidebar closing animation, then remove it
            setTimeout(() => {
                // Blur effect is already removed with sidebar-open class
            }, 300); // Keep timing for blur transition
        }
    });
    
    // Keyboard shortcut for settings
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        if (e.key.toLowerCase() === 's') {
            toggleSettingsSidebar();
        }
    });
    
    function toggleSettingsSidebar() {
        const isVisible = settingsSidebar.classList.toggle('visible');
        // Add/remove blur effect on the body
        if (isVisible) {
            document.body.classList.add('sidebar-open');
            // Keep button visible when sidebar opens
            showSettingsButton();
        } else {
            // Remove sidebar-open immediately so button starts moving
            document.body.classList.remove('sidebar-open');
            // Keep blur during sidebar closing animation, then remove it
            setTimeout(() => {
                // Blur effect is already removed with sidebar-open class
            }, 300); // Keep timing for blur transition
        }
    }


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

    let currentMonth = moment.tz(TZ);
    let selectedDate = moment.tz(displayedDate, TZ);


    const now = moment.tz(TZ);
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
                        selectedDate = moment.tz(clickedDate, TZ);
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
    currentMonth = moment.tz(displayedDate, TZ);
    selectedDate = moment.tz(displayedDate, TZ);

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
// Update DOMContentLoaded handler
document.addEventListener('DOMContentLoaded', async () => {
    countdownContainer = document.querySelector('.notif');
    scheduleContainer = document.querySelector('.blocks');
    injectEmbedViewerUI();
    injectNavigationUI();
    injectCalendarUI();


    // Step-by-step tutorial tooltips logic
    const tutorialSteps = [
        {
            selector: '.notif',
            title: 'Next Class Countdown',
            message: 'This area shows a live countdown to your next class, including details like teacher and room.',
        },
        {
            selector: '.blocks',
            title: 'Today\'s Schedule',
            message: 'Scroll here to see your full schedule for today. Each block shows class, time, teacher, and room.',
        },
        {
            selector: '.timetable-nav',
            title: 'Navigate Days',
            message: 'Use these arrows to move between days. You can also use the calendar or keyboard shortcuts.',
        },
        {
            selector: '.calendar-icon',
            title: 'Calendar',
            message: 'Click the calendar icon to quickly jump to any date.',
        },
        {
            selector: '.todo-btn',
            title: 'To-Do List',
            message: 'Open your to-do list to keep track of homework and tasks.',
        },
        {
            selector: '.utilities-btn',
            title: 'Utilities',
            message: 'Use the utilities for graphing (Desmos), calculations (Wolfram), and integral/derivative calculators. Great for quick problem solving!',
        },
        {
            selector: '.refsheet-btn',
            title: 'Reference Sheets',
            message: 'Access quick reference sheets for advanced math, standard math, chemistry, and physics.',
        },
    ];

    function showTutorialStep(stepIdx) {
        const container = document.getElementById('tutorial-tooltip-container');
        container.innerHTML = '';
        if (stepIdx < 0 || stepIdx >= tutorialSteps.length) {
            container.style.display = 'none';
            return;
        }
    const step = tutorialSteps[stepIdx];
        // Remove highlight from any previously highlighted element and remove highlight box if present
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        const oldBox = document.getElementById('tutorial-highlight-box');
        if (oldBox) oldBox.remove();

        let target = document.querySelector(step.selector);
        // Special group highlight for Reference Sheets and Utilities
        if (step.title === 'Navigate Days') {
            // Highlight the nav bar and arrows as a group
            const nav = document.querySelector('.timetable-nav');
            const navArrows = Array.from(document.querySelectorAll('.timetable-nav .nav-quick-nav'));
            if (nav) {
                const navRect = nav.getBoundingClientRect();
                let minTop = navRect.top;
                let maxBottom = navRect.bottom;
                let minLeft = navRect.left;
                let maxRight = navRect.right;
                navArrows.forEach(arrow => {
                    const r = arrow.getBoundingClientRect();
                    minTop = Math.min(minTop, r.top);
                    maxBottom = Math.max(maxBottom, r.bottom);
                    minLeft = Math.min(minLeft, r.left);
                    maxRight = Math.max(maxRight, r.right);
                });
                const box = document.createElement('div');
                box.id = 'tutorial-highlight-box';
                box.className = 'tutorial-highlight-group';
                box.style.position = 'absolute';
                box.style.pointerEvents = 'none';
                box.style.zIndex = '2101';
                box.style.top = `${minTop + window.scrollY - 4}px`;
                box.style.left = `${minLeft + window.scrollX - 4}px`;
                box.style.width = `${maxRight - minLeft + 8}px`;
                box.style.height = `${maxBottom - minTop + 8}px`;
                document.body.appendChild(box);
            }
        } else if (step.title === 'Reference Sheets' || step.title === 'Utilities') {
            // Get all relevant buttons
            let btns;
            if (step.title === 'Reference Sheets') {
                btns = Array.from(document.querySelectorAll('.refsheet-btn, .refsheet-btn ~ .reference-btn'));
            } else {
                btns = Array.from(document.querySelectorAll('.utilities-btn'));
            }
            // Get nav arrows
            const navArrows = Array.from(document.querySelectorAll('.nav-quick-nav'));
            if (btns.length) {
                const btnRects = btns.map(btn => btn.getBoundingClientRect());
                let minTop = Math.min(...btnRects.map(r => r.top));
                let maxBottom = Math.max(...btnRects.map(r => r.bottom));
                let minLeft = Math.min(...btnRects.map(r => r.left));
                let maxRight = Math.max(...btnRects.map(r => r.right));
                // Expand to include nav arrows if they overlap vertically
                navArrows.forEach(arrow => {
                    const r = arrow.getBoundingClientRect();
                    // Check for vertical overlap
                    if (r.bottom > minTop && r.top < maxBottom) {
                        minTop = Math.min(minTop, r.top);
                        maxBottom = Math.max(maxBottom, r.bottom);
                        minLeft = Math.min(minLeft, r.left);
                        maxRight = Math.max(maxRight, r.right);
                    }
                });
                const box = document.createElement('div');
                box.id = 'tutorial-highlight-box';
                box.className = 'tutorial-highlight-group';
                box.style.position = 'absolute';
                box.style.pointerEvents = 'none';
                box.style.zIndex = '2101';
                box.style.top = `${minTop + window.scrollY - 4}px`;
                box.style.left = `${minLeft + window.scrollX - 4}px`;
                box.style.width = `${maxRight - minLeft + 8}px`;
                box.style.height = `${maxBottom - minTop + 8}px`;
                document.body.appendChild(box);
            }
        } else {
            // Add highlight to the current target
            if (target) target.classList.add('tutorial-highlight');
        }
        // Special: force nav arrows visible for Navigate Days step
        if (step.title === 'Navigate Days') {
            document.body.classList.add('tutorial-nav-arrows');
        } else {
            document.body.classList.remove('tutorial-nav-arrows');
        }
        if (!target) {
            // If the element is not found, skip to next
            showTutorialStep(stepIdx + 1);
            return;
        }
        // Get bounding rect for positioning
        const rect = target.getBoundingClientRect();
        // Tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'tutorial-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.pointerEvents = 'auto';
        tooltip.style.background = '#222';
        tooltip.style.color = '#fff';
        tooltip.style.padding = '20px 24px 16px 24px';
        tooltip.style.borderRadius = '14px';
        tooltip.style.boxShadow = '0 4px 32px #0008';
        tooltip.style.maxWidth = '320px';
        tooltip.style.zIndex = '2100';
        tooltip.style.fontFamily = "'Varela',sans-serif";
        tooltip.innerHTML = `
            <h3 style="margin-top:0;margin-bottom:10px;">${step.title}</h3>
            <p style="margin:0 0 16px 0;">${step.message}</p>
            <div style="text-align:right;">
                <button id="tutorial-next-btn" style="padding:7px 18px;font-size:1rem;border:none;border-radius:6px;background:#e53935;color:#fff;cursor:pointer;">${stepIdx === tutorialSteps.length-1 ? 'Finish' : 'Next'}</button>
            </div>
        `;
        // Custom positioning for sidebar steps
        let top = 0, left = 0;
        if (step.title === 'Reference Sheets' || step.title === 'Utilities') {
            // Place to the right of the sidebar, vertically centered on the button group
            top = rect.top + window.scrollY;
            // Ensure the tooltip is vertically centered relative to the sidebar button group
            const sidebarHeight = rect.height;
            const tooltipHeight = 160; // Approximate height of the tooltip
            top = top + (sidebarHeight / 2) - (tooltipHeight / 2);
            // Clamp to viewport
            top = Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12 + window.scrollY));
            left = rect.right + 18 + window.scrollX;
            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        } else {
            // Default: above or below
            const topSpace = rect.top;
            const bottomSpace = window.innerHeight - rect.bottom;
            if (bottomSpace > 180) {
                // Place below
                top = rect.bottom + 12;
            } else {
                // Place above
                top = Math.max(0, rect.top - 180);
            }
            left = Math.max(12, rect.left + (rect.width/2) - 160);
            tooltip.style.top = `${top + window.scrollY}px`;
            tooltip.style.left = `${left + window.scrollX}px`;
        }
        container.appendChild(tooltip);
        container.style.display = 'block';
        // Next/Finish button
        tooltip.querySelector('#tutorial-next-btn').onclick = () => {
            // Remove highlight from all on finish/next
            document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
            const oldBox = document.getElementById('tutorial-highlight-box');
            if (oldBox) oldBox.remove();
            if (stepIdx === tutorialSteps.length-1) {
                // Only clear the flag after the user finishes the tutorial
                localStorage.removeItem('showTutorial');
                container.style.display = 'none';
                document.body.classList.remove('tutorial-nav-arrows');
            } else {
                showTutorialStep(stepIdx+1);
            }
        };
    }

    // Start tutorial if flag is set
    if (localStorage.getItem('showTutorial') === 'true') {
        // Wait for DOM and features to render
        setTimeout(() => {
            showTutorialStep(0);
        }, 400);
        // Do not remove flag here; it will be removed after Finish is pressed
    }

    // Keyboard shortcuts for day navigation
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        const key = e.key.toLowerCase();
        if (key === 'q' || e.key === 'arrowleft') {
            initialize(moment.tz(displayedDate, TZ).subtract(1, 'day').format('YYYY-MM-DD'));
            return;
        }
        if (key === 'e' || e.key === 'arrowright') {
            initialize(moment.tz(displayedDate, TZ).add(1, 'day').format('YYYY-MM-DD'));
            return;
        }
        if (key === 'w' || e.key === 'arrowup') {
            initialize(getLocalISODateString(window._99_95_utils.now()));
            return;
        }
    });

    await initialize();
    let lastDate = getLocalISODateString(moment.tz(TZ).toDate());
    let lastDateCheck = getLocalISODateString(window._99_95_utils.now());
    const DATE_CHECK_INTERVAL_MS = 30000; // 30s
    const dateInterval = setInterval(() => {
        const now = window._99_95_utils.now();
        const currentDate = getLocalISODateString(now);
        if (displayedDate === lastDateCheck && currentDate !== lastDateCheck) initialize(currentDate);
        lastDateCheck = currentDate;
    }, DATE_CHECK_INTERVAL_MS);

    // Listen for storage changes (e.g., user uploads new timetable in another page)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (changes.parsedIcsData) {
            initialize(displayedDate);
        }
    });

    // Cancel countdown and intervals on unload to avoid leaks
    window.addEventListener('unload', () => {
        stopCountdown();
        clearInterval(dateInterval);
    });
});