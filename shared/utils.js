// Shared utilities for 99.95 extension (timezone & date helpers)
(function () {
  const TZ = 'Australia/Sydney';

  function now() {
    return moment.tz(TZ).toDate();
  }

  function getDateTime(dateString, timeString) {
    // dateString: YYYY-MM-DD, timeString: HH:mm
    return moment.tz(dateString + 'T' + timeString + ':00', TZ).toDate();
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
  };
})();
