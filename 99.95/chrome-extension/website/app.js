// Function to fetch data from the JSON file
async function fetchSchedule(date) {
    try {
        const response = await fetch('output.json');
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

    // Determine start time for progress calculation
    let countdownStartTime;
    if (isCurrentClass) {
        countdownStartTime = new Date(target.start_time);
    } else {
        countdownStartTime = new Date();
    }

    progressContainer.style.display = 'block';

    let timer;

    const updateCountdown = () => {
        const currentTime = new Date();
        const timeDiff = Math.max(0, targetTime - currentTime);

        // Calculate progress
        const totalDuration = targetTime - countdownStartTime;
        const elapsed = currentTime - countdownStartTime;
        const percentage = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;

        progressBar.style.width = `${Math.min(percentage, 100)}%`;

        // Update countdown display
        const hours = String(Math.floor(timeDiff / 3.6e6)).padStart(2, '0');
        const minutes = String(Math.floor((timeDiff % 3.6e6) / 6e4)).padStart(2, '0');
        const seconds = String(Math.floor((timeDiff % 6e4) / 1000)).padStart(2, '0');

        // Only show "With teacher in room" if teacher is specified
        notif.innerHTML = `
            <h1>${isCurrentClass ? `${target.name} ends in` : `${target.name} in`} ${hours}:${minutes}:${seconds}</h1>
            ${target.teacher ? `<h2>With ${target.teacher} in ${target.location}</h2>` : ''}
        `;

        if (timeDiff <= 0) {
            clearInterval(timer);
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
    timer = setInterval(updateCountdown, 1000);
}

// Insert Recess and Lunch automatically
function addRecessAndLunch(schedule, date) {
    const recess = {
        period: 'R',
        name: 'Recess',
        start_time: `${date}T11:00:00`,
        end_time: `${date}T11:25:00`,
        teacher: '',
        location: ''
    };
    const lunch = {
        period: 'L',
        name: 'Lunch',
        start_time: `${date}T13:25:00`,
        end_time: `${date}T14:05:00`,
        teacher: '',
        location: ''
    };

    schedule.push(recess, lunch);
    schedule.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

// Render the schedule
function renderSchedule(schedule, date) {
    const blocksContainer = document.querySelector('.blocks');
    blocksContainer.innerHTML = '';

    if (schedule.length === 0) {
        blocksContainer.innerHTML = '<h1>No classes today!</h1>';
        return;
    }

    addRecessAndLunch(schedule, date);

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
        const startTime = new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTime = new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        teacherDetails.textContent = `${startTime} – ${endTime}`;
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

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    await initialize();
});

// Toggle button for switching background + text color
document.addEventListener("DOMContentLoaded", function () {
    const toggleButton = document.createElement("button");
    toggleButton.innerText = "Toggle Background";
    toggleButton.classList.add("toggle-btn");
    document.body.appendChild(toggleButton);

    toggleButton.addEventListener("click", function () {
        document.body.classList.toggle("light-mode");
    });
});