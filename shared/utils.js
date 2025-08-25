// Shared utilities for 99.95 extension (timezone & date helpers)
(function () {
  const TZ = 'Australia/Sydney';

  // Return epoch milliseconds (Number) for consistent comparisons across the codebase
  function now() {
    return moment.tz(TZ).valueOf();
  }

  function getDateTime(dateString, timeString) {
    // dateString: YYYY-MM-DD, timeString: HH:mm
    // Returns epoch ms (Number)
    return moment.tz(dateString + 'T' + timeString + ':00', TZ).valueOf();
  }

  function formatTimeRange(dateString, start, end) {
    // Return HH:mm – HH:mm (uses timezone)
    return (
      moment.tz(dateString + 'T' + start + ':00', TZ).format('HH:mm') +
      ' – ' +
      moment.tz(dateString + 'T' + end + ':00', TZ).format('HH:mm')
    );
  }

  function getLocalISODateString(date) {
    return moment.tz(date, TZ).format('YYYY-MM-DD');
  }

  // Convert a variety of inputs to epoch ms.
  // Accepts: Number (ms), Date, moment, or ISO string.
  function toTs(input) {
    if (typeof input === 'number') return input;
    if (!input) return NaN;
    if (moment.isMoment(input)) return input.valueOf();
    if (input instanceof Date) return input.getTime();
    // Fallback: let moment parse it in the configured TZ
    return moment.tz(input, TZ).valueOf();
  }

  function isWeekend(dateInput) {
    const day = moment.tz(dateInput, TZ).day();
    return day === 0 || day === 6;
  }

  // Expose a small API
  window._99_95_utils = {
    TZ,
    now,
    getDateTime,
    formatTimeRange,
    getLocalISODateString,
    isWeekend,
    toTs,
  };
})();
