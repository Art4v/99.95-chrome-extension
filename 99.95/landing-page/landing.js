document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('ics-upload'); // matches your input ID
    const fileNameDisplay = document.getElementById('file-name');
    const parseButton = document.getElementById('upload-button'); // matches your button ID
    const statusDiv = document.getElementById('file-name'); // matches your status display

    // Initially disable the upload button
    parseButton.disabled = true;

    // Show selected file name under the choose file button
    fileInput.addEventListener('change', function() {
        if (fileInput.files.length > 0) {
          fileNameDisplay.textContent = `Selected file: ${fileInput.files[0].name}`;
          fileNameDisplay.classList.remove('hidden', 'error');
          parseButton.disabled = false;
        } else {
          fileNameDisplay.textContent = '';
          fileNameDisplay.classList.add('hidden');
          parseButton.disabled = true;
        }
    });
  
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
        statusDiv.classList.remove('hidden');
        statusDiv.classList.add('error');
      }
    });
  
    function parseIcsData(icsData) {
      try {
        // Parse the ICS data
        const cal = new ICAL.Component(ICAL.parse(icsData));
        const events = cal.getAllSubcomponents('vevent');
  
        // Create blacklist to filter out redundant words
        const blacklist = ["Yr7", "Yr8", "Yr9", "Yr10", "Yr11", "Yr12"];
  
        // Create function to filter out redundant words in string
        function filter(input) {
          return input.split(' ').filter(word => !blacklist.includes(word)).join(' ');
        }
  
        // Get all event dates to determine first date and days covered
        const allDates = [];
        events.forEach(event => {
          const start = moment(event.getFirstPropertyValue('dtstart').toString());
          const sydneyStart = start.clone().tz('Australia/Sydney');
          allDates.push(sydneyStart);
        });
  
        // Sort dates
        allDates.sort((a, b) => a - b);
  
        if (allDates.length === 0) {
          statusDiv.textContent = 'No events found in the ICS file.';
          statusDiv.classList.remove('hidden');
          statusDiv.classList.add('error');
          return;
        }
  
        // Determine first date and number of days
        const firstDate = allDates[0];
        const lastDate = allDates[allDates.length - 1];
        const days = lastDate.diff(firstDate, 'days') + 1;
  
        // Initialize output text as JSON string that will be converted to text
        const outputData = {};
  
        // Process each day
        for (let i = 0; i < days; i++) {
          const currentDate = firstDate.clone().add(i, 'days');
          const dateString = currentDate.format('YYYY-MM-DD');
          outputData[dateString] = [];
  
          // Process events for this day
          events.forEach(event => {
            const startDate = moment(event.getFirstPropertyValue('dtstart').toString());
            const sydneyStart = startDate.clone().tz('Australia/Sydney');
  
            if (sydneyStart.format('YYYY-MM-DD') === dateString) {
              const endDate = moment(event.getFirstPropertyValue('dtend').toString());
              const sydneyEnd = endDate.clone().tz('Australia/Sydney');
  
              const summary = event.getFirstPropertyValue('summary') || '';
              const summaryParts = summary.split(': ');
              const classInfo = summaryParts[0];
              const name = summaryParts.length > 1 ? summaryParts[1] : '';
  
              const location = event.getFirstPropertyValue('location') || '';
              const locationParts = location.split(': ');
              const locationValue = locationParts.length > 1 ? locationParts[1] : '';
  
              const description = event.getFirstPropertyValue('description') || '';
              const descriptionLines = description.split('\n');
  
              const teacherParts = descriptionLines[0] ? descriptionLines[0].split(': ') : ['', ''];
              const periodParts = descriptionLines.length > 1 && descriptionLines[1] ? descriptionLines[1].split(': ') : ['', ''];
  
              const teacher = teacherParts.length > 1 ? teacherParts[1] : '';
              const period = periodParts.length > 1 ? periodParts[1] : '';
  
              // Add this event to the day's events array
              outputData[dateString].push({
                "c": classInfo,                                     // class
                "n": filter(name),                                  // name
                "l": locationValue,                                 // location
                "t": teacher,                                       // teacher
                "p": period,                                        // period
                "s": sydneyStart.format('HH:mm'),                   // start_time
                "e": sydneyEnd.format('HH:mm')                      // end_time
              });
            }
          });
  
          // Sort events by start time
          outputData[dateString].sort((a, b) => {
            return a.s.localeCompare(b.s);
          });
        }
  
        // Convert the data object to a JSON string
        const outputText = JSON.stringify(outputData);
  
        // Store the parsed data in Chrome storage as text
        chrome.storage.local.set({ 'parsedIcsData': outputText }, function() {
          statusDiv.textContent = 'ICS data successfully parsed and stored!';
          statusDiv.classList.remove('error', 'hidden');
          statusDiv.classList.add('success');
          chrome.runtime.sendMessage({ type: 'storageUpdated' }); // Notify background if needed
          console.log(`Parsed ICS data stored (${outputText.length} characters)`);
          alert('Timetable uploaded successfully!');
          window.close();
        });
  
      } catch (error) {
        statusDiv.textContent = 'Error parsing ICS file: ' + error.message;
        statusDiv.classList.remove('hidden');
        statusDiv.classList.add('error');
        console.error('Error parsing ICS file:', error);
      }
    }
  });