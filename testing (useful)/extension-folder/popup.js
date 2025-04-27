// popup.js
document.addEventListener('DOMContentLoaded', function() {
  const fileInput = document.getElementById('fileInput');
  const parseButton = document.getElementById('parseButton');
  const statusDiv = document.getElementById('status');

  parseButton.addEventListener('click', function() {
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const icsData = e.target.result;
        parseIcsData(icsData);
      };
      
      reader.readAsText(file);
    } else {
      statusDiv.textContent = 'Please select an ICS file first.';
      statusDiv.style.color = 'red';
    }
  });

  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDatetime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  // Updated function to properly handle Sydney's daylight saving time
  function convertToSydneyTime(date) {
    // First create a date in UTC
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    
    // Create a new Date string in Sydney timezone format
    // We'll check if DST is in effect for Sydney at this date
    
    // Sydney DST starts on the first Sunday in October at 2:00 AM
    // Sydney DST ends on the first Sunday in April at 3:00 AM
    
    // Get the year from the date
    const year = utcDate.getUTCFullYear();
    const month = utcDate.getUTCMonth(); // 0-11 where 0 is January
    const day = utcDate.getUTCDate();
    
    // Determine if date is within DST period
    let isDST = false;
    
    // If month is between November and March, definitely in DST
    if (month > 9 || month < 3) {
      isDST = true;
    }
    // If in October, check if after first Sunday
    else if (month === 9) {
      // Find the first Sunday in October
      const firstSunday = new Date(Date.UTC(year, 9, 1));
      while (firstSunday.getUTCDay() !== 0) {
        firstSunday.setUTCDate(firstSunday.getUTCDate() + 1);
      }
      
      // If we're on or after the first Sunday, it's DST
      if (day > firstSunday.getUTCDate() || 
          (day === firstSunday.getUTCDate() && 
          utcDate.getUTCHours() >= 2)) {
        isDST = true;
      }
    }
    // If in April, check if before first Sunday
    else if (month === 3) {
      // Find the first Sunday in April
      const firstSunday = new Date(Date.UTC(year, 3, 1));
      while (firstSunday.getUTCDay() !== 0) {
        firstSunday.setUTCDate(firstSunday.getUTCDate() + 1);
      }
      
      // If we're before the first Sunday, it's DST
      if (day < firstSunday.getUTCDate() || 
          (day === firstSunday.getUTCDate() && 
          utcDate.getUTCHours() < 3)) {
        isDST = true;
      }
    }
  
  // Apply the correct offset: +11 for DST, +10 for standard time
  const offset = isDST ? 11 : 10;
  const sydneyDate = new Date(utcDate.getTime() + offset * 60 * 60000);
  
  return sydneyDate;
}

  function filter(input) {
    // Create blacklist to filter out redundant words
    const blacklist = ["Yr7", "Yr8", "Yr9", "Yr10", "Yr11", "Yr12"];
    
    if (!input) return '';
    return input.split(' ').filter(word => !blacklist.includes(word)).join(' ');
  }

  function parseIcsData(icsData) {
    try {
      // Parse the ICS data using our custom parser
      const events = ICSParser.parseICS(icsData);
      
      // Create master dictionary
      const masterDict = {};
      
      // Get all dates to find the range
      const allDates = [];
      
      events.forEach(event => {
        if (event.DTSTART) {
          const startDate = ICSParser.parseICSDate(event.DTSTART);
          if (startDate) {
            const sydneyStart = convertToSydneyTime(startDate);
            allDates.push(formatDate(sydneyStart));
          }
        }
      });
      
      // Sort dates
      allDates.sort();
      
      if (allDates.length === 0) {
        statusDiv.textContent = 'No events found in the ICS file.';
        statusDiv.style.color = 'red';
        return;
      }
      
      // Process each date
      const uniqueDates = [...new Set(allDates)];
      
      uniqueDates.forEach(dateString => {
        masterDict[dateString] = [];
        
        events.forEach(event => {
          if (!event.DTSTART) return;
          
          // Get start time
          const startDate = ICSParser.parseICSDate(event.DTSTART);
          if (!startDate) return;
          
          const sydneyStart = convertToSydneyTime(startDate);
          const eventDateString = formatDate(sydneyStart);
          
          if (eventDateString !== dateString) return;
          
          // Get end time
          const endDate = event.DTEND ? ICSParser.parseICSDate(event.DTEND) : 
                        new Date(startDate.getTime() + 60 * 60000); // Default to 1 hour later
          const sydneyEnd = convertToSydneyTime(endDate);
          
          // Get summary
          const summary = event.SUMMARY || '';
          const summaryParts = summary.split(': ');
          const classInfo = summaryParts[0] || '';
          const name = summaryParts.length > 1 ? summaryParts[1] : '';
          
          // Get location
          const location = event.LOCATION || '';
          const locationParts = location.split(': ');
          const locationValue = locationParts.length > 1 ? locationParts[1] : '';
          
          // Get description
          const description = event.DESCRIPTION || '';
          const descriptionLines = description.split('\\n');
          
          const teacherParts = descriptionLines[0] ? descriptionLines[0].split(': ') : ['', ''];
          const periodParts = descriptionLines.length > 1 && descriptionLines[1] ? descriptionLines[1].split(': ') : ['', ''];
          
          const teacher = teacherParts.length > 1 ? teacherParts[1] : '';
          const period = periodParts.length > 1 ? periodParts[1] : '';
          
          masterDict[dateString].push({
            "class": classInfo,
            "name": filter(name),
            "location": locationValue,
            "teacher": teacher,
            "period": period,
            "start_time": formatDatetime(sydneyStart),
            "end_time": formatDatetime(sydneyEnd)
          });
        });
      });
      
      // Store the parsed data in Chrome storage
      chrome.storage.local.set({ 'parsedIcsData': masterDict }, function() {
        statusDiv.textContent = 'ICS data successfully parsed and stored!';
        statusDiv.style.color = 'green';
        console.log('Parsed data:', masterDict);
      });
      
    } catch (error) {
      statusDiv.textContent = 'Error parsing ICS file: ' + error.message;
      statusDiv.style.color = 'red';
      console.error('Error parsing ICS file:', error);
    }
  }
});
  consoleButton.addEventListener('click', function() {
    // Retrieve the parsed data from Chrome storage
    chrome.storage.local.get('parsedIcsData', function(result) {
      const data = result.parsedIcsData;
      console.log('Parsed ICS Data:', data);
    });
  });