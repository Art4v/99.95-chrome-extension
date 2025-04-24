// Utility to format time range
function formatTimeRange(start, end) {
    const startTime = new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${startTime} – ${endTime}`;
}

// Function to fetch data from the JSON file
async function fetchSchedule(date, filePath = 'output.json') {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error('Failed to load schedule data.');
        const data = await response.json();
        return data[date] || [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

// Function to find the next class
function getNextClass(schedule, now) {
    return [...schedule].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .find((entry) => new Date(entry.start_time) > now) || null;
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

// Countdown function with progress bar
function startCountdown(target, isCurrentClass, schedule) {
    const notif = document.querySelector('.notif');
    const progressContainer = document.querySelector('.progress-container');
    const progressBar = document.querySelector('.progress-bar');

    if (!target) {
        notif.innerHTML = '<h1>No more classes today</h1>';
        progressContainer.style.display = 'none';
        return;
    }

    const targetTime = isCurrentClass 
        ? new Date(target.end_time) 
        : new Date(target.start_time);

    const countdownStartTime = isCurrentClass
        ? new Date(target.start_time)
        : new Date();

    progressContainer.style.display = 'block';

    if (globalTimer) clearInterval(globalTimer);

    const updateCountdown = () => {
        const currentTime = new Date();
        const timeDiff = Math.max(0, targetTime - currentTime);

        const totalDuration = targetTime - countdownStartTime;
        const elapsed = currentTime - countdownStartTime;
        const percentage = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

        progressBar.style.width = `${Math.min(percentage, 100)}%`;

        const hours = String(Math.floor(timeDiff / 3.6e6)).padStart(2, '0');
        const minutes = String(Math.floor((timeDiff % 3.6e6) / 6e4)).padStart(2, '0');
        const seconds = String(Math.floor((timeDiff % 6e4) / 1000)).padStart(2, '0');

        notif.innerHTML = `
            <h1>${isCurrentClass ? `${target.name} ends in` : `${target.name} in`} ${hours}:${minutes}:${seconds}</h1>
            ${target.teacher ? `<h2>With ${target.teacher} in ${target.location}</h2>` : ''}
        `;

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

// Render the schedule
function renderSchedule(schedule, date) {
    const blocksContainer = document.querySelector('.blocks');
    blocksContainer.innerHTML = '';

    if (schedule.length === 0) {
        blocksContainer.innerHTML = '<h1>No classes today!</h1>';
        return;
    }

    schedule.forEach((entry) => {
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
    const currentDate = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000
    ).toISOString().split('T')[0];

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

    const toggleButton = document.createElement("button");
    toggleButton.innerText = "Toggle Background";
    toggleButton.classList.add("toggle-btn");
    toggleButton.setAttribute("aria-label", "Toggle light/dark mode");
    document.body.appendChild(toggleButton);

    toggleButton.addEventListener("click", function () {
        document.body.classList.toggle("light-mode");
    });
});
