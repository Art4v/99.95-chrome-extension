import { format, parseISO, isAfter, isBefore, addDays, subDays } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime, format as formatTz } from 'date-fns-tz';

const TIMEZONE = 'Australia/Sydney';

export class DateUtils {
  static formatDateTime(date, formatStr = 'yyyy-MM-dd HH:mm') {
    const zonedDate = utcToZonedTime(date, TIMEZONE);
    return formatTz(zonedDate, formatStr, { timeZone: TIMEZONE });
  }

  static parseDateTime(dateString, timeString) {
    const combined = `${dateString}T${timeString}:00`;
    const utcDate = zonedTimeToUtc(parseISO(combined), TIMEZONE);
    return utcDate;
  }

  static getCurrentTime() {
    return utcToZonedTime(new Date(), TIMEZONE);
  }

  static formatTimeRange(date, startTime, endTime) {
    const start = this.parseDateTime(date, startTime);
    const end = this.parseDateTime(date, endTime);
    
    const startFormatted = this.formatDateTime(start, 'HH:mm');
    const endFormatted = this.formatDateTime(end, 'HH:mm');
    
    return `${startFormatted} – ${endFormatted}`;
  }

  static getLocalISODateString(date = new Date()) {
    return this.formatDateTime(date, 'yyyy-MM-dd');
  }

  static addDays(date, days) {
    return addDays(date, days);
  }

  static subtractDays(date, days) {
    return subDays(date, days);
  }

  static isAfter(date1, date2) {
    return isAfter(date1, date2);
  }

  static isBefore(date1, date2) {
    return isBefore(date1, date2);
  }
}