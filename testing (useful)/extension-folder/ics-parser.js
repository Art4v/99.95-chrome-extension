// Create a simple ICS parser
const ICSParser = {
    // Parse an ICS string and convert it to a structured object
    parseICS: function(icsString) {
      const lines = icsString.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
      
      const events = [];
      let currentEvent = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Handle event start/end
        if (line === 'BEGIN:VEVENT') {
          currentEvent = {};
          continue;
        }
        
        if (line === 'END:VEVENT') {
          if (currentEvent) {
            events.push(currentEvent);
            currentEvent = null;
          }
          continue;
        }
        
        // Skip if not in an event
        if (!currentEvent) continue;
        
        // Handle folded lines (lines that start with a space or tab)
        let currentLine = line;
        while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
          i++;
          currentLine += lines[i].trim();
        }
        
        // Parse the property
        const colonIndex = currentLine.indexOf(':');
        if (colonIndex > 0) {
          const propName = currentLine.substring(0, colonIndex).split(';')[0];
          const propValue = currentLine.substring(colonIndex + 1);
          
          // Store the property in the event
          currentEvent[propName] = propValue;
        }
      }
      
      return events;
    },
    
    // Parse a date string from ICS format to a JavaScript Date
    parseICSDate: function(dateString) {
      // Handle date only (YYYYMMDD)
      if (dateString.length === 8) {
        const year = parseInt(dateString.substring(0, 4), 10);
        const month = parseInt(dateString.substring(4, 6), 10) - 1; // months are 0-based in JS
        const day = parseInt(dateString.substring(6, 8), 10);
        return new Date(Date.UTC(year, month, day));
      }
      
      // Handle date with time (YYYYMMDDTHHmmssZ)
      if (dateString.includes('T')) {
        const year = parseInt(dateString.substring(0, 4), 10);
        const month = parseInt(dateString.substring(4, 6), 10) - 1;
        const day = parseInt(dateString.substring(6, 8), 10);
        const hour = parseInt(dateString.substring(9, 11), 10);
        const minute = parseInt(dateString.substring(11, 13), 10);
        const second = parseInt(dateString.substring(13, 15), 10);
        
        // Handle timezone (Z means UTC)
        if (dateString.endsWith('Z')) {
          return new Date(Date.UTC(year, month, day, hour, minute, second));
        } else {
          return new Date(year, month, day, hour, minute, second);
        }
      }
      
      return null;
    }
  };