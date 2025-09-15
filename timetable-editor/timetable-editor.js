// Timetable Editor - 99.95 Extension
// Handles visual editing of ICS timetables with weekly/biweekly/triweekly support

// Dependency checks
if (typeof moment === 'undefined' || typeof ICAL === 'undefined' || !window._99_95_utils) {
    alert('Required libraries (moment.js, ical.js) or shared utilities are not loaded. Please check your extension setup.');
    throw new Error('Required libraries or utilities not loaded.');
}

const TZ = window._99_95_utils.TZ;

// Local wrappers that delegate to shared utils
function getDateTime(dateString, timeString) {
    return window._99_95_utils.getDateTime(dateString, timeString);
}

function getLocalISODateString(date) {
    return window._99_95_utils.getLocalISODateString(date);
}

// Global state
let timetableData = {};
let availableClasses = new Set();
let scheduleType = 'weekly';
let currentEditingCell = null;
let weekPattern = [];

// DOM elements
let timetableGrid, classList, scheduleTypeSelect, statusMessage;
let backBtn, confirmBtn, addClassBtn, newClassInput;

// Initialize the editor
document.addEventListener('DOMContentLoaded', async function() {
    try {
        initializeElements();
        setupEventListeners();
        showStatus('Loading timetable data...', 'success');
        await loadTimetableData();
        generateClassList();
        renderTimetable();
        showStatus('Timetable loaded successfully! Click on any cell to edit.', 'success');
    } catch (error) {
        console.error('Error initializing editor:', error);
        showStatus('Error initializing editor. Please refresh the page.', 'error');
    }
});

function initializeElements() {
    timetableGrid = document.getElementById('timetable-grid');
    classList = document.getElementById('class-list');
    scheduleTypeSelect = document.getElementById('schedule-type');
    statusMessage = document.getElementById('status-message');
    backBtn = document.getElementById('back-btn');
    confirmBtn = document.getElementById('confirm-btn');
    addClassBtn = document.getElementById('add-class-btn');
    newClassInput = document.getElementById('new-class-input');
}

function setupEventListeners() {
    scheduleTypeSelect.addEventListener('change', handleScheduleTypeChange);
    backBtn.addEventListener('click', handleBackToUpload);
    confirmBtn.addEventListener('click', handleConfirmTimetable);
    addClassBtn.addEventListener('click', handleAddClass);
    newClassInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddClass();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        
        switch (e.key.toLowerCase()) {
            case 'enter':
                if (document.getElementById('class-edit-modal').classList.contains('hidden')) {
                    handleConfirmTimetable();
                }
                break;
            case 'escape':
                closeEditModal();
                break;
            case 'n':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    newClassInput.focus();
                }
                break;
        }
    });
}

async function loadTimetableData() {
    try {
        // Get the parsed ICS data from storage
        const data = await new Promise(resolve => {
            chrome.storage.local.get('parsedIcsData', resolve);
        });
        
        if (!data.parsedIcsData) {
            showStatus('No timetable data found. Please upload a timetable first.', 'error');
            return;
        }
        
        timetableData = JSON.parse(data.parsedIcsData);
        
        // Extract unique classes from the data
        Object.values(timetableData).forEach(daySchedule => {
            daySchedule.forEach(entry => {
                if (entry.n && entry.n.trim()) {
                    availableClasses.add(entry.n.trim());
                }
            });
        });
        
        // Determine schedule type based on data patterns
        determineScheduleType();
        
    } catch (error) {
        console.error('Error loading timetable data:', error);
        showStatus('Error loading timetable data. Please try uploading again.', 'error');
    }
}

function determineScheduleType() {
    const dates = Object.keys(timetableData).sort();
    if (dates.length === 0) return;
    
    // Check if we have data for multiple weeks
    const firstDate = moment.tz(dates[0], TZ);
    const lastDate = moment.tz(dates[dates.length - 1], TZ);
    const totalDays = lastDate.diff(firstDate, 'days') + 1;
    
    if (totalDays <= 7) {
        scheduleType = 'weekly';
        scheduleTypeSelect.value = 'weekly';
    } else if (totalDays <= 14) {
        scheduleType = 'biweekly';
        scheduleTypeSelect.value = 'biweekly';
    } else {
        scheduleType = 'triweekly';
        scheduleTypeSelect.value = 'triweekly';
    }
    
    generateWeekPattern();
}

function generateWeekPattern() {
    weekPattern = [];
    const dates = Object.keys(timetableData).sort();
    if (dates.length === 0) return;
    
    const firstDate = moment.tz(dates[0], TZ);
    
    if (scheduleType === 'weekly') {
        // Single week pattern
        for (let i = 0; i < 7; i++) {
            const date = firstDate.clone().add(i, 'days');
            weekPattern.push({
                date: date.format('YYYY-MM-DD'),
                dayName: date.format('ddd'),
                week: 'A'
            });
        }
    } else if (scheduleType === 'biweekly') {
        // Two week pattern (A/B)
        for (let week = 0; week < 2; week++) {
            for (let day = 0; day < 7; day++) {
                const date = firstDate.clone().add(week * 7 + day, 'days');
                weekPattern.push({
                    date: date.format('YYYY-MM-DD'),
                    dayName: date.format('ddd'),
                    week: week === 0 ? 'A' : 'B'
                });
            }
        }
    } else if (scheduleType === 'triweekly') {
        // Three week pattern (A/B/C)
        for (let week = 0; week < 3; week++) {
            for (let day = 0; day < 7; day++) {
                const date = firstDate.clone().add(week * 7 + day, 'days');
                weekPattern.push({
                    date: date.format('YYYY-MM-DD'),
                    dayName: date.format('ddd'),
                    week: week === 0 ? 'A' : week === 1 ? 'B' : 'C'
                });
            }
        }
    }
}

function handleScheduleTypeChange() {
    scheduleType = scheduleTypeSelect.value;
    generateWeekPattern();
    renderTimetable();
}

function renderTimetable() {
    if (weekPattern.length === 0) return;
    
    // Clear existing grid
    timetableGrid.innerHTML = '';
    
    // Set schedule type data attribute for CSS
    timetableGrid.setAttribute('data-schedule-type', scheduleType);
    
    // Get unique time slots
    const timeSlots = getUniqueTimeSlots();
    
    // Create grid structure
    const gridTemplateColumns = `80px repeat(${weekPattern.length}, 120px)`;
    timetableGrid.style.gridTemplateColumns = gridTemplateColumns;
    
    // Create header section with week indicators
    createHeaderSection(timeSlots);
    
    // Create data rows
    timeSlots.forEach(timeSlot => {
        createDataRow(timeSlot);
    });
}

function createHeaderSection(timeSlots) {
    // Create week indicators first
    if (scheduleType !== 'weekly') {
        createWeekIndicators();
    }
    
    // Create day headers
    createDayHeaders();
}

function createWeekIndicators() {
    let currentWeek = null;
    let weekStartIndex = 0;
    
    weekPattern.forEach((day, index) => {
        if (day.week !== currentWeek) {
            if (currentWeek !== null) {
                // Add week separator
                const separator = document.createElement('div');
                separator.className = 'week-separator';
                separator.style.gridColumn = `${weekStartIndex + 2} / span ${index - weekStartIndex}`;
                separator.style.gridRow = '1';
                timetableGrid.appendChild(separator);
            }
            
            // Add week indicator
            const weekIndicator = document.createElement('div');
            weekIndicator.className = 'week-indicator';
            weekIndicator.style.gridColumn = `${weekStartIndex + 2} / span ${index - weekStartIndex}`;
            weekIndicator.style.gridRow = '2';
            weekIndicator.textContent = `Week ${day.week}`;
            timetableGrid.appendChild(weekIndicator);
            
            currentWeek = day.week;
            weekStartIndex = index;
        }
    });
    
    // Handle the last week
    if (currentWeek !== null) {
        const weekIndicator = document.createElement('div');
        weekIndicator.className = 'week-indicator';
        weekIndicator.style.gridColumn = `${weekStartIndex + 2} / span ${weekPattern.length - weekStartIndex}`;
        weekIndicator.style.gridRow = '2';
        weekIndicator.textContent = `Week ${currentWeek}`;
        timetableGrid.appendChild(weekIndicator);
    }
}

function createDayHeaders() {
    const headerRow = document.createElement('div');
    headerRow.className = 'grid-header';
    headerRow.style.gridRow = scheduleType === 'weekly' ? '1' : '3';
    
    // Empty cell for day names
    const emptyCell = document.createElement('div');
    emptyCell.textContent = 'Time';
    headerRow.appendChild(emptyCell);
    
    // Day headers
    weekPattern.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.innerHTML = `
            <div>${day.dayName}</div>
            <div style="font-size: 0.7rem; color: #888; margin-top: 2px;">${day.date}</div>
        `;
        headerRow.appendChild(dayHeader);
    });
    
    timetableGrid.appendChild(headerRow);
}

function getUniqueTimeSlots() {
    const timeSlots = new Set();
    Object.values(timetableData).forEach(daySchedule => {
        daySchedule.forEach(entry => {
            if (entry.s && entry.e) {
                timeSlots.add(`${entry.s}-${entry.e}`);
            }
        });
    });
    
    return Array.from(timeSlots).sort((a, b) => {
        const timeA = a.split('-')[0];
        const timeB = b.split('-')[0];
        return timeA.localeCompare(timeB);
    });
}

function createHeaderRow(timeSlots) {
    const headerRow = document.createElement('div');
    headerRow.className = 'grid-header';
    
    // Empty cell for day names
    const emptyCell = document.createElement('div');
    emptyCell.textContent = 'Time';
    headerRow.appendChild(emptyCell);
    
    // Day headers with week indicators
    let currentWeek = null;
    weekPattern.forEach((day, index) => {
        // Add week indicator if this is a new week
        if (day.week !== currentWeek) {
            if (currentWeek !== null && scheduleType !== 'weekly') {
                // Add week separator
                const separator = document.createElement('div');
                separator.className = 'week-separator';
                separator.style.gridColumn = `1 / span ${weekPattern.length + 1}`;
                headerRow.appendChild(separator);
            }
            
            // Add week indicator
            if (scheduleType !== 'weekly') {
                const weekIndicator = document.createElement('div');
                weekIndicator.className = 'week-indicator';
                weekIndicator.style.gridColumn = `1 / span ${weekPattern.length + 1}`;
                weekIndicator.textContent = `Week ${day.week}`;
                headerRow.appendChild(weekIndicator);
            }
            
            currentWeek = day.week;
        }
        
        const dayHeader = document.createElement('div');
        dayHeader.innerHTML = `
            <div>${day.dayName}</div>
            <div style="font-size: 0.7rem; color: #888; margin-top: 2px;">${day.date}</div>
        `;
        headerRow.appendChild(dayHeader);
    });
    
    timetableGrid.appendChild(headerRow);
}

function createDataRow(timeSlot) {
    const [startTime, endTime] = timeSlot.split('-');
    const row = document.createElement('div');
    row.className = 'grid-row';
    
    // Calculate the grid row number
    const timeSlotIndex = getUniqueTimeSlots().indexOf(timeSlot);
    const gridRowNumber = (scheduleType === 'weekly' ? 2 : 4) + timeSlotIndex;
    row.style.gridRow = gridRowNumber;
    
    // Time column
    const timeCell = document.createElement('div');
    timeCell.textContent = `${startTime} - ${endTime}`;
    row.appendChild(timeCell);
    
    // Day columns
    weekPattern.forEach(day => {
        const cell = createGridCell(day, timeSlot);
        row.appendChild(cell);
    });
    
    timetableGrid.appendChild(row);
}

function createGridCell(day, timeSlot) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    
    // Find existing class data for this day and time
    const existingClass = findExistingClass(day.date, timeSlot);
    
    if (existingClass) {
        cell.innerHTML = `
            <div class="cell-class">${existingClass.n || 'No Class'}</div>
            <div class="cell-details">
                ${existingClass.t ? `Teacher: ${existingClass.t}` : ''}
                ${existingClass.l ? `Room: ${existingClass.l}` : ''}
            </div>
        `;
        cell.dataset.classData = JSON.stringify(existingClass);
    } else {
        cell.classList.add('empty');
        cell.textContent = 'No Class';
        cell.dataset.classData = JSON.stringify({
            n: '',
            t: '',
            l: '',
            s: timeSlot.split('-')[0],
            e: timeSlot.split('-')[1]
        });
    }
    
    // Add click event for editing
    cell.addEventListener('click', () => openEditModal(cell, day, timeSlot));
    
    return cell;
}

function findExistingClass(date, timeSlot) {
    const [startTime, endTime] = timeSlot.split('-');
    const daySchedule = timetableData[date] || [];
    
    return daySchedule.find(entry => 
        entry.s === startTime && entry.e === endTime
    ) || null;
}

function openEditModal(cell, day, timeSlot) {
    currentEditingCell = cell;
    
    const modal = document.getElementById('class-edit-modal');
    const modalTime = document.getElementById('modal-time');
    const classSelect = document.getElementById('class-select');
    const teacherInput = document.getElementById('teacher-input');
    const roomInput = document.getElementById('room-input');
    
    // Set modal time
    const [startTime, endTime] = timeSlot.split('-');
    modalTime.textContent = `${day.dayName} ${startTime} - ${endTime}`;
    
    // Populate class select
    classSelect.innerHTML = '<option value="">No Class</option>';
    Array.from(availableClasses).sort().forEach(className => {
        const option = document.createElement('option');
        option.value = className;
        option.textContent = className;
        classSelect.appendChild(option);
    });
    
    // Set current values
    const currentData = JSON.parse(cell.dataset.classData);
    classSelect.value = currentData.n || '';
    teacherInput.value = currentData.t || '';
    roomInput.value = currentData.l || '';
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Setup modal event listeners
    setupModalEventListeners();
}

function setupModalEventListeners() {
    const modal = document.getElementById('class-edit-modal');
    const closeModal = modal.querySelector('.close-modal');
    const saveBtn = modal.querySelector('#save-class-btn');
    const cancelBtn = modal.querySelector('#cancel-class-btn');
    
    // Remove existing listeners
    closeModal.replaceWith(closeModal.cloneNode(true));
    saveBtn.replaceWith(saveBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    
    // Add new listeners
    modal.querySelector('.close-modal').addEventListener('click', closeEditModal);
    modal.querySelector('#save-class-btn').addEventListener('click', saveClassChanges);
    modal.querySelector('#cancel-class-btn').addEventListener('click', closeEditModal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeEditModal();
    });
}

function closeEditModal() {
    const modal = document.getElementById('class-edit-modal');
    modal.classList.add('hidden');
    currentEditingCell = null;
}

function saveClassChanges() {
    if (!currentEditingCell) return;
    
    const classSelect = document.getElementById('class-select');
    const teacherInput = document.getElementById('teacher-input');
    const roomInput = document.getElementById('room-input');
    
    const selectedClass = classSelect.value;
    const teacher = teacherInput.value.trim();
    const room = roomInput.value.trim();
    
    // Update cell data
    const cellData = JSON.parse(currentEditingCell.dataset.classData);
    cellData.n = selectedClass;
    cellData.t = teacher;
    cellData.l = room;
    
    // Update cell display
    if (selectedClass) {
        currentEditingCell.innerHTML = `
            <div class="cell-class">${selectedClass}</div>
            <div class="cell-details">
                ${teacher ? `Teacher: ${teacher}` : ''}
                ${room ? `Room: ${room}` : ''}
            </div>
        `;
        currentEditingCell.classList.remove('empty');
    } else {
        currentEditingCell.innerHTML = 'No Class';
        currentEditingCell.classList.add('empty');
    }
    
    currentEditingCell.dataset.classData = JSON.stringify(cellData);
    
    // Update timetable data
    updateTimetableData(cellData);
    
    closeEditModal();
}

function updateTimetableData(cellData) {
    // This function would update the actual timetable data structure
    // For now, we're just updating the visual representation
    // The actual data update happens when confirming the timetable
}

function generateClassList() {
    classList.innerHTML = '';
    
    Array.from(availableClasses).sort().forEach(className => {
        const classItem = document.createElement('div');
        classItem.className = 'class-item';
        classItem.innerHTML = `
            <span>${className}</span>
            <button class="remove-class" onclick="removeClass('${className}')">×</button>
        `;
        classList.appendChild(classItem);
    });
}

function handleAddClass() {
    const className = newClassInput.value.trim();
    if (!className) return;
    
    if (availableClasses.has(className)) {
        showStatus('Class already exists!', 'error');
        return;
    }
    
    availableClasses.add(className);
    generateClassList();
    newClassInput.value = '';
    showStatus(`Added class: ${className}`, 'success');
}

function removeClass(className) {
    if (availableClasses.size <= 1) {
        showStatus('Cannot remove the last class!', 'error');
        return;
    }
    
    availableClasses.delete(className);
    generateClassList();
    showStatus(`Removed class: ${className}`, 'success');
}

async function handleBackToUpload() {
    if (confirm('Are you sure you want to go back? All changes will be lost.')) {
        // Reset the confirmation flag and remove timetable data
        await new Promise(resolve => {
            chrome.storage.local.remove(['parsedIcsData', 'timetableConfirmed'], resolve);
        });
        window.location.href = '../landing-page/landing.html';
    }
}

async function handleConfirmTimetable() {
    try {
        // Collect all the edited data from the grid
        const updatedTimetableData = {};
        
        // Get all grid cells and extract their data
        const cells = document.querySelectorAll('.grid-cell');
        cells.forEach(cell => {
            const classData = JSON.parse(cell.dataset.classData);
            if (classData.n) { // Only include cells with actual classes
                // Find which day this cell represents
                const cellIndex = Array.from(cell.parentNode.children).indexOf(cell) - 1; // -1 for time column
                if (cellIndex >= 0 && cellIndex < weekPattern.length) {
                    const day = weekPattern[cellIndex];
                    const dateKey = day.date;
                    
                    if (!updatedTimetableData[dateKey]) {
                        updatedTimetableData[dateKey] = [];
                    }
                    
                    updatedTimetableData[dateKey].push({
                        ...classData,
                        c: classData.n, // Keep original format
                        p: `${classData.s}-${classData.e}` // Period format
                    });
                }
            }
        });
        
        // Sort each day's schedule by start time
        Object.keys(updatedTimetableData).forEach(date => {
            updatedTimetableData[date].sort((a, b) => a.s.localeCompare(b.s));
        });
        
        // Save the updated timetable and set confirmation flag
        const outputText = JSON.stringify(updatedTimetableData);
        await new Promise(resolve => {
            chrome.storage.local.set({ 
                parsedIcsData: outputText,
                timetableConfirmed: true 
            }, resolve);
        });
        
        // Set tutorial flag for first upload
        localStorage.setItem('showTutorial', 'true');
        
        showStatus('Timetable updated successfully! Redirecting...', 'success');
        
        // Redirect to main interface
        setTimeout(() => {
            window.location.href = '../popup/popup.html';
        }, 1500);
        
    } catch (error) {
        console.error('Error confirming timetable:', error);
        showStatus('Error saving timetable. Please try again.', 'error');
    }
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 3000);
    }
}

// Theme support (matching main popup)
function initializeTheme() {
    const theme = localStorage.getItem("theme");
    if (theme === "light") {
        document.body.classList.add("light-mode");
    }
}

// Initialize theme
initializeTheme();
