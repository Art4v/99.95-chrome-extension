// Function to fetch data from the JSON file
async function fetchSchedule(date) {
    try {
        const response = await fetch('output.json'); // Path to your JSON file
        if (!response.ok) {
            throw new Error('Failed to load schedule data.');
        }
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

// Function to start the countdown for the next class
function startCountdown(nextClass, now) {
    const notif = document.querySelector('.notif');
    if (!nextClass) {
        notif.innerHTML = '<h1>No more classes today</h1>';
        return;
    }

    const nextClassTime = new Date(nextClass.start_time);
    let timer;

    const updateCountdown = () => {
        const currentTime = new Date(); // Use real current time
        const timeDiff = Math.max(0, nextClassTime - currentTime);
        const hours = String(Math.floor(timeDiff / (1000 * 60 * 60))).padStart(2, '0');
        const minutes = String(Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
        const seconds = String(Math.floor((timeDiff % (1000 * 60)) / 1000)).padStart(2, '0');

        notif.innerHTML = `
            <h1>${nextClass.name} in ${hours}:${minutes}:${seconds}</h1>
            <h2>With ${nextClass.teacher} in ${nextClass.location}</h2>
        `;

        if (timeDiff <= 0) {
            clearInterval(timer);
            notif.innerHTML = `<h1>${nextClass.name} is starting now!</h1>`;

            setTimeout(() => {
                const nextNextClass = getNextClass(schedule, currentTime);
                startCountdown(nextNextClass, currentTime);
            }, 10000);
        }
    };

    updateCountdown();
    timer = setInterval(updateCountdown, 1000);
}

// Function to render the schedule for a specific date
function renderSchedule(schedule) {
    const blocksContainer = document.querySelector('.blocks');
    blocksContainer.innerHTML = ''; // Clear existing content

    // Sort the schedule by start time
    schedule.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    schedule.forEach((entry) => {
        const block = document.createElement('div');
        block.className = 'b';

        // Period
        const period = document.createElement('div');
        period.className = 'bp';
        const periodText = document.createElement('h1');
        periodText.textContent = entry.period;
        period.appendChild(periodText);

        // Details
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

        // Room
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

// Function to initialize with the current date and time
async function initialize() {
    const now = new Date(); // Use the current date and time
    const currentDate = now.toISOString().split('T')[0]; // Get the current date in YYYY-MM-DD format
    const schedule = await fetchSchedule(currentDate);
    renderSchedule(schedule);

    const nextClass = getNextClass(schedule, now);
    startCountdown(nextClass, now);
}

// Set up event listeners and initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initialize(); // Initialize with the current date and time
});