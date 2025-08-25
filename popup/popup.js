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
    wolframBtn.className = 'reference-btn wolfram-btn';
    wolframBtn.setAttribute('title', 'Wolfram Alpha');
    wolframBtn.innerHTML = '<img src="../assets/wolfram.png" alt="Wolfram" class="reference-icon">';
    wolframBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openWolframPage();
    });

    // Create Desmos button (positioned below wolfram button)
    const desmosBtn = document.createElement('button');
    desmosBtn.className = 'reference-btn desmos-btn';
    desmosBtn.setAttribute('title', 'Desmos Calculator');
    desmosBtn.innerHTML = '<img src="../assets/desmos.png" alt="Desmos" class="reference-icon">';
    desmosBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openDesmosPage();
    });

    // Create Integral Calculator button (positioned below desmos button)
    const integralBtn = document.createElement('button');
    integralBtn.className = 'reference-btn integral-btn';
    integralBtn.setAttribute('title', 'Integral Calculator');
    integralBtn.innerHTML = '<img src="../assets/integral.png" alt="Integral" class="reference-icon">';
    integralBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openIntegralPage();
    });

    // Create Derivative Calculator button (positioned below integral button)
    const derivativeBtn = document.createElement('button');
    derivativeBtn.className = 'reference-btn derivative-btn';
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
    referenceButtons.forEach(({ pdf, label, shortcut, icon }) => {
        const btn = document.createElement('button');
        btn.className = 'reference-btn';
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
            <div class="todo-input-container">
                <input type="text" class="todo-input" placeholder="Add a new task..." maxlength="84">
                <button class="todo-add-btn" aria-label="Add Task">+</button>
            </div>
            <div class="todo-list-container">
                <ul class="todo-list" id="todoList">
                    <!-- Tasks will be populated here -->
                </ul>
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
        const todoList = document.getElementById('todoList');
        if (!todoList) return;
        
        todoList.innerHTML = '';
        
        todos.forEach((todo, index) => {
            const li = document.createElement('li');
            li.className = 'todo-item';
            li.draggable = true;
            li.dataset.index = index;
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
                e.stopPropagation(); // Prevent event bubbling
                todos[index].completed = checkbox.checked;
                saveTodos();
                renderTodos();
            });
            
            // Delete button event
            const deleteBtn = li.querySelector('.todo-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent event bubbling
                todos.splice(index, 1);
                saveTodos();
                renderTodos();
            });
            
            // Drag and drop events
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', index);
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
                const dropIndex = index;

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
            
            todoList.appendChild(li);
        });
        
        updateClearButtons();
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
        { id: 'toggle-btn', title: 'Toggle Theme', icon: '../assets/light or dark.svg', shortcut: 'T', isImage: true }
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
    if (localStorage.getItem("theme") === "light") document.body.classList.add("light-mode");
    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle("light-mode");
        localStorage.setItem("theme", document.body.classList.contains("light-mode") ? "light" : "dark");
    });

    // Append elements in order: calendar, todo, wolfram, desmos, integral, derivative, reference buttons
    document.body.appendChild(calendarIcon);
    document.body.appendChild(todoBtn);
    
    // Add dividing line between todo and wolfram
    const todoWolframDivider = document.createElement('div');
    todoWolframDivider.className = 'todo-wolfram-divider';
    document.body.appendChild(todoWolframDivider);
    
    document.body.appendChild(wolframBtn);
    document.body.appendChild(desmosBtn);
    document.body.appendChild(integralBtn);
    document.body.appendChild(derivativeBtn);
    
    // Add dividing line between websites and reference sheets
    const dividingLine = document.createElement('div');
    dividingLine.className = 'dividing-line';
    document.body.appendChild(dividingLine);
    
    document.body.appendChild(referenceButtonsContainer);
    document.body.appendChild(settingsButtonsContainer);


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
    // Keyboard shortcuts for day navigation
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        const key = e.key.toLowerCase();
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