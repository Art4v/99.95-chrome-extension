export class ValidationUtils {
  static sanitizeHTML(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  static sanitizeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  static validateICSFile(file) {
    if (!file) return { valid: false, error: 'No file provided' };
    
    if (!file.name.toLowerCase().endsWith('.ics')) {
      return { valid: false, error: 'File must be an .ics file' };
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return { valid: false, error: 'File size must be less than 5MB' };
    }
    
    return { valid: true };
  }

  static sanitizeICSData(icsContent) {
    // Remove potentially dangerous content
    const sanitized = icsContent
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
    
    return sanitized;
  }

  static validateEventData(event) {
    const required = ['c', 'n', 's', 'e'];
    const missing = required.filter(field => !event[field]);
    
    if (missing.length > 0) {
      return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
    }
    
    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(event.s) || !timeRegex.test(event.e)) {
      return { valid: false, error: 'Invalid time format' };
    }
    
    return { valid: true };
  }
}