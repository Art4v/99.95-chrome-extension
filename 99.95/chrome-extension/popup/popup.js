// Function to fetch data from the JSON file
async function fetchSchedule(date) {
    try {
        const response = await fetch('output.json'); // Path to your JSON file
        if (!response.ok) {
            throw new Error('Failed to load schedule data.');
        }
        const data = await response.json();
        console.log("Fetched Schedule for", date, ":", data[date]); // Debugging
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

// Function to add recess and lunch to the schedule
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

    // Add recess and lunch to the schedule
    schedule.push(recess, lunch);

    // Sort the schedule by start time
    schedule.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

// Function to render the schedule for a specific date
function renderSchedule(schedule, date) {
    const blocksContainer = document.querySelector('.blocks');
    blocksContainer.innerHTML = ''; // Clear existing content

    if (schedule.length === 0) {
        blocksContainer.innerHTML = '<h1>No classes today!</h1>';
        return;
    }

    // Add recess and lunch to the schedule
    addRecessAndLunch(schedule, date);

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

// Function to check if the current day is a weekend
function isWeekend(date) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    return dayOfWeek === 0 || dayOfWeek === 6;
}

// Function to initialize with the current date and time
async function initialize() {
    const now = new Date();
    const currentDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]; // Adjust for time zone
    console.log("Current Date:", currentDate); // Debugging

    // Check if it's a weekend
    if (isWeekend(now)) {
        const blocksContainer = document.querySelector('.blocks');
        blocksContainer.innerHTML = '<h1>No classes today! It\'s a weekend.</h1>';
        const notif = document.querySelector('.notif');
        notif.innerHTML = '<h1>Enjoy your day off!</h1>';
        return;
    }

    const schedule = await fetchSchedule(currentDate);
    renderSchedule(schedule, currentDate);

    // If there are no classes today, update the notification
    if (schedule.length === 0) {
        const notif = document.querySelector('.notif');
        notif.innerHTML = '<h1>No classes today!</h1>';
        return;
    }

    const nextClass = getNextClass(schedule, now);
    startCountdown(nextClass, now);
}

// Set up event listeners and initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initialize(); // Initialize with the current date and time
});