// Timetable Preview JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const scheduleTypeElement = document.getElementById('schedule-type');
    const proceedBtn = document.getElementById('proceed-btn');
    
    // Time slots mapping (period to time)
    const timeSlots = [
        '8:45 AM', '9:30 AM', '10:15 AM', '11:00 AM', '11:45 AM',
        '12:30 PM', '1:15 PM', '2:00 PM', '2:45 PM', '3:30 PM', '4:15 PM'
    ];
    
    // Day mapping
    const dayMapping = {
        'monday': 0,
        'tuesday': 1,
        'wednesday': 2,
        'thursday': 3,
        'friday': 4
    };
    
    let isBiWeekly = false;
    let firstWeekDatesSet = new Set();
    let secondWeekDatesSet = new Set();
    
    // Initialize the preview
    async function initializePreview() {
        try {
            // Show loading state
            scheduleTypeElement.innerHTML = '<span class="loading"></span> Analyzing...';
            
            // Get parsed ICS data from storage
            const data = await getParsedIcsData();
            if (!data) {
                showError('No timetable data found. Please upload a timetable first.');
                return;
            }
            
            // Analyze the schedule type
            analyzeScheduleType(data);
            
            // Generate week tables
            generateWeekTables(data);
            
            // Update info display
            updateInfoDisplay();

            // Defer a tick to allow DOM to paint, then sync heights
            setTimeout(() => {
                const weeks = document.querySelectorAll('.week-schedule');
                weeks.forEach(week => synchronizeRowHeightsForWeek(week));
            }, 0);
            
        } catch (error) {
            console.error('Error initializing preview:', error);
            showError('Error loading timetable data. Please try uploading again.');
        }
    }
    
    // Get parsed ICS data from Chrome storage
    function getParsedIcsData() {
        return new Promise((resolve) => {
            chrome.storage.local.get('parsedIcsData', (data) => {
                if (data.parsedIcsData) {
                    try {
                        const parsedData = JSON.parse(data.parsedIcsData);
                        resolve(parsedData);
                    } catch (error) {
                        console.error('Error parsing stored data:', error);
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        });
    }
    
    // Analyze if the schedule is bi-weekly or weekly by comparing first two weeks
    function analyzeScheduleType(data) {
        const allDates = Object.keys(data)
            .filter(d => Array.isArray(data[d]) && data[d].length > 0)
            .sort();

        // Filter to weekdays only
        const weekdayDates = allDates.filter(d => {
            const day = new Date(d).getDay();
            return day >= 1 && day <= 5; // Mon..Fri
        });

        // Take first two weeks (first 5 weekdays, next 5 weekdays)
        const firstWeek = weekdayDates.slice(0, 5);
        const secondWeek = weekdayDates.slice(5, 10);

        firstWeekDatesSet = new Set(firstWeek);
        secondWeekDatesSet = new Set(secondWeek);

        if (firstWeek.length < 5 || secondWeek.length < 5) {
            isBiWeekly = false;
            return;
        }

        // Compare by weekday index (Mon..Fri) to be robust against calendar dates
        function normalizeWeek(weekDates) {
            return weekDates.map(date => {
                const events = (data[date] || []).slice().sort((a, b) => (a.s || '').localeCompare(b.s || ''));
                return events.map(e => ({ name: e.n || '', time: e.s || '', teacher: e.t || '', room: e.l || '' }));
            });
        }

        const aWeek = normalizeWeek(firstWeek);
        const bWeek = normalizeWeek(secondWeek);

        const weeksAreIdentical = aWeek.every((dayA, idx) => {
            const dayB = bWeek[idx] || [];
            if (dayA.length !== dayB.length) return false;
            return dayA.every((evA, j) => {
                const evB = dayB[j];
                return evA.name === evB.name && evA.time === evB.time && evA.teacher === evB.teacher && evA.room === evB.room;
            });
        });

        isBiWeekly = !weeksAreIdentical;
    }
    
    // Generate week tables based on the data
    function generateWeekTables(data) {
        if (isBiWeekly) {
            generateBiWeeklyTables(data);
        } else {
            generateWeeklyTable(data);
        }
    }
    
    // Generate bi-weekly tables (Week A and Week B)
    function generateBiWeeklyTables(data) {
        const weekAEvents = {};
        const weekBEvents = {};
        
        // Process each day's events
        Object.entries(data).forEach(([date, events]) => {
            if (!Array.isArray(events)) return;
            
            events.forEach(event => {
                if (!event.n || !event.s || !event.e) return;
                // Skip Roll Call from table (not a class block)
                if (String(event.p || '').toUpperCase() === 'RC') return;
                
                const dayOfWeek = getDayOfWeek(date);
                if (dayOfWeek === null) return;
                
                const period = getPeriodFromEvent(event);
                if (period === null) return;
                
                // Use first two weeks buckets determined earlier
                const targetEvents = firstWeekDatesSet.has(date) ? weekAEvents : (secondWeekDatesSet.has(date) ? weekBEvents : null);
                if (!targetEvents) return;
                
                if (!targetEvents[dayOfWeek]) {
                    targetEvents[dayOfWeek] = {};
                }
                
                targetEvents[dayOfWeek][period] = {
                    name: cleanClassName(event.n),
                    teacher: extractTeacher(event.t),
                    room: extractRoom(event.l),
                    period: period
                };
            });
        });
        
        // Populate Week A table
        populateWeekTable('week-a', weekAEvents);
        
        // Populate Week B table
        populateWeekTable('week-b', weekBEvents);
    }
    
    // Generate single weekly table
    function generateWeeklyTable(data) {
        const weekEvents = {};
        
        // Process each day's events
        Object.entries(data).forEach(([date, events]) => {
            if (!Array.isArray(events)) return;
            
            events.forEach(event => {
                if (!event.n || !event.s || !event.e) return;
                if (String(event.p || '').toUpperCase() === 'RC') return;
                
                const dayOfWeek = getDayOfWeek(date);
                if (dayOfWeek === null) return;
                
                const period = getPeriodFromEvent(event);
                if (period === null) return;
                
                if (!weekEvents[dayOfWeek]) {
                    weekEvents[dayOfWeek] = {};
                }
                
                weekEvents[dayOfWeek][period] = {
                    name: cleanClassName(event.n),
                    teacher: extractTeacher(event.t),
                    room: extractRoom(event.l),
                    period: period
                };
            });
        });
        
        // Populate Week A table (use same data for both)
        populateWeekTable('week-a', weekEvents);
        
        // Hide Week B for weekly schedules
        document.getElementById('week-b').style.display = 'none';
    }
    
    // Populate a week table with events
    function populateWeekTable(weekId, weekEvents) {
        const weekElement = document.getElementById(weekId);
        const classSlots = weekElement.querySelectorAll('.class-slot');
        
        classSlots.forEach(slot => {
            const day = slot.dataset.day;
            const period = parseInt(slot.dataset.period);
            
            if (weekEvents[day] && weekEvents[day][period]) {
                const event = weekEvents[day][period];
                slot.innerHTML = `
                    <div class="class-content">
                        <div class="class-period">P${period}</div>
                        <div class="class-name">${event.name}</div>
                        <div class="class-teacher">${event.teacher}</div>
                        <div class="class-room">${event.room}</div>
                    </div>
                `;
            } else {
                slot.classList.add('empty');
            }
        });

        // After filling, normalize row heights for this week table
        synchronizeRowHeightsForWeek(weekElement);
    }
    
    // Get day of week from date string
    function getDayOfWeek(dateString) {
        const date = new Date(dateString);
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = days[date.getDay()];
        
        // Only return weekdays
        if (dayName === 'sunday' || dayName === 'saturday') {
            return null;
        }
        
        return dayName;
    }

    // Ensure time column and all day columns have equal heights per period row
    function synchronizeRowHeightsForWeek(weekElement) {
        try {
            const timeSlots = Array.from(weekElement.querySelectorAll('.time-column .time-slot'));
            // Periods 0..10
            for (let period = 0; period <= 10; period++) {
                const rowCells = [];
                // gather time cell for this period
                const timeCell = timeSlots.find(ts => parseInt(ts.getAttribute('data-period')) === period);
                if (timeCell) rowCells.push(timeCell);
                // gather all class cells for this period across days
                const dayCells = Array.from(weekElement.querySelectorAll(`.class-slot[data-period="${period}"]`));
                rowCells.push(...dayCells);

                // reset heights to natural for measurement
                rowCells.forEach(el => {
                    el.style.height = '';
                    el.style.minHeight = '';
                });
                // compute max height
                let maxH = 0;
                rowCells.forEach(el => { maxH = Math.max(maxH, el.offsetHeight); });
                // apply uniform height
                rowCells.forEach(el => { el.style.height = maxH + 'px'; });
            }
        } catch (e) {
            // non-fatal
        }
    }

    // Re-sync on window resize and after a short delay post-render
    function synchronizeAllWeeks() {
        const weeks = document.querySelectorAll('.week-schedule');
        weeks.forEach(week => synchronizeRowHeightsForWeek(week));
    }

    window.addEventListener('resize', () => {
        synchronizeAllWeeks();
    });
    
    // Get period number from time string
    function getPeriodFromTime(timeString) {
        // Convert time string to period (0-10)
        // This is a simplified mapping - you may need to adjust based on your school's schedule
        const time = timeString.split(':');
        const hour = parseInt(time[0]);
        const minute = parseInt(time[1]);
        
        // Map times to periods (adjust these based on your school's actual schedule)
        // Based on the example ICS file, the times are in UTC and need to be converted
        if (hour === 8 && minute === 45) return 0;  // 8:45 AM
        if (hour === 9 && minute === 30) return 1;  // 9:30 AM
        if (hour === 10 && minute === 15) return 2; // 10:15 AM
        if (hour === 11 && minute === 0) return 3;  // 11:00 AM
        if (hour === 11 && minute === 45) return 4; // 11:45 AM
        if (hour === 12 && minute === 30) return 5; // 12:30 PM
        if (hour === 13 && minute === 15) return 6; // 1:15 PM
        if (hour === 14 && minute === 0) return 7;  // 2:00 PM
        if (hour === 14 && minute === 45) return 8; // 2:45 PM
        if (hour === 15 && minute === 30) return 9; // 3:30 PM
        if (hour === 16 && minute === 15) return 10; // 4:15 PM
        
        // Additional mappings for different time formats
        if (hour === 22 && minute === 45) return 0; // 10:45 PM UTC = 8:45 AM local (AEST)
        if (hour === 23 && minute === 0) return 1;  // 11:00 PM UTC = 9:00 AM local
        if (hour === 23 && minute === 50) return 2; // 11:50 PM UTC = 9:50 AM local
        if (hour === 0 && minute === 0) return 3;   // 12:00 AM UTC = 10:00 AM local
        if (hour === 0 && minute === 45) return 4;  // 12:45 AM UTC = 10:45 AM local
        if (hour === 1 && minute === 30) return 5;  // 1:30 AM UTC = 11:30 AM local
        if (hour === 2 && minute === 15) return 6;  // 2:15 AM UTC = 12:15 PM local
        if (hour === 3 && minute === 0) return 7;   // 3:00 AM UTC = 1:00 PM local
        if (hour === 3 && minute === 45) return 8;  // 3:45 AM UTC = 1:45 PM local
        if (hour === 4 && minute === 30) return 9;  // 4:30 AM UTC = 2:30 PM local
        if (hour === 5 && minute === 15) return 10; // 5:15 AM UTC = 3:15 PM local
        
        return null;
    }

    function getPeriodFromEvent(event) {
        const p = String(event.p || '').trim();
        if (/^\d+$/.test(p)) {
            const num = parseInt(p, 10);
            if (num >= 0 && num <= 10) return num;
        }
        return getPeriodFromTime(event.s || '');
    }
    
    // Clean class name by removing week indicators and other formatting
    function cleanClassName(className) {
        return className
            .replace(/MonA|MonB|TueA|TueB|WedA|WedB|ThuA|ThuB|FriA|FriB/g, '')
            .replace(/Study\./g, 'Study ')
            .replace(/Yr\d+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    // Extract teacher name from description
    function extractTeacher(description) {
        if (!description) return '';
        const match = description.match(/Teacher:\s*([^\n]+)/);
        return match ? match[1].trim() : '';
    }
    
    // Extract room number from location
    function extractRoom(location) {
        if (!location) return '';
        const match = location.match(/Room:\s*(\d+)/);
        return match ? match[1] : location;
    }
    
    // Update info display
    function updateInfoDisplay() {
        scheduleTypeElement.textContent = isBiWeekly ? 'Bi-weekly Schedule' : 'Weekly Schedule';
    }
    
    // Show error message
    function showError(message) {
        scheduleTypeElement.textContent = 'Error';
        
        // Create error message
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid rgba(244, 67, 54, 0.3);
            color: #f44336;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
        `;
        errorDiv.textContent = message;
        
        document.querySelector('.timetable-info').appendChild(errorDiv);
    }
    
    // Proceed button click handler
    proceedBtn.addEventListener('click', function() {
        // Navigate to the main popup interface
        window.location.href = 'popup/popup.html';
    });
    
    // Initialize the preview when the page loads
    initializePreview();
});
