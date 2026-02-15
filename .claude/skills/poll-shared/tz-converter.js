/**
 * Time Zone Conversion Utilities
 *
 * Handles conversion of date/times between time zones.
 * All conversions follow the rules in tz-conversion.md
 */

// Supported time zones with UTC offsets
// Offsets are in hours (can be fractional like IST = 5.5)
const TZ_OFFSETS = {
  'HST':  -10,      // Hawaii Standard Time
  'AKST': -9,       // Alaska Standard Time
  'PST':  -8,       // Pacific Standard Time
  'PDT':  -7,       // Pacific Daylight Time
  'MST':  -7,       // Mountain Standard Time
  'MDT':  -6,       // Mountain Daylight Time
  'CST':  -6,       // Central Standard Time
  'CDT':  -5,       // Central Daylight Time
  'EST':  -5,       // Eastern Standard Time
  'EDT':  -4,       // Eastern Daylight Time
  'AST':  -4,       // Atlantic Standard Time
  'NST':  -3.5,     // Newfoundland Standard Time
  'NDT':  -2.5,     // Newfoundland Daylight Time
  'GMT':  0,        // Greenwich Mean Time
  'UTC':  0,        // Coordinated Universal Time
  'IST':  5.5,      // Indian Standard Time
  'AEST': 10,       // Australian Eastern Standard Time
  'AWST': 8,        // Australian Western Standard Time
};

/**
 * Get UTC offset for a time zone abbreviation
 * @param {string} tzAbbr - Time zone abbreviation (e.g., 'EST')
 * @returns {number} UTC offset in hours (negative for west of UTC)
 * @throws {Error} If time zone not found
 */
function getTZOffset(tzAbbr) {
  if (!(tzAbbr in TZ_OFFSETS)) {
    throw new Error(`Unsupported time zone: ${tzAbbr}. Supported zones: ${Object.keys(TZ_OFFSETS).join(', ')}`);
  }
  return TZ_OFFSETS[tzAbbr];
}

/**
 * Check if a time zone abbreviation is valid
 * @param {string} tzAbbr - Time zone abbreviation
 * @returns {boolean} True if valid, false otherwise
 */
function isValidTZ(tzAbbr) {
  return tzAbbr in TZ_OFFSETS;
}

/**
 * Parse a date/time string in format "Mon DD, YYYY, HH:MM"
 * @param {string} dateTimeStr - Date/time string
 * @returns {object} {month, day, year, hours, minutes}
 * @throws {Error} If format is invalid
 */
function parseDateTime(dateTimeStr) {
  // Format: "Feb 16, 2026, 13:00"
  const regex = /^(\w+)\s+(\d+),\s+(\d+),\s+(\d+):(\d+)$/;
  const match = dateTimeStr.trim().match(regex);

  if (!match) {
    throw new Error(`Invalid date/time format: "${dateTimeStr}". Expected "Mon DD, YYYY, HH:MM"`);
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = match[1];
  const day = parseInt(match[2]);
  const year = parseInt(match[3]);
  const hours = parseInt(match[4]);
  const minutes = parseInt(match[5]);

  const month = monthNames.indexOf(monthStr);
  if (month === -1) {
    throw new Error(`Invalid month: ${monthStr}`);
  }

  return { month, day, year, hours, minutes };
}

/**
 * Format parsed date/time back to string
 * @param {object} dt - {month, day, year, hours, minutes}
 * @returns {string} Formatted date/time string
 */
function formatDateTime(dt) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = monthNames[dt.month];
  const hoursStr = String(dt.hours).padStart(2, '0');
  const minutesStr = String(dt.minutes).padStart(2, '0');
  return `${monthStr} ${dt.day}, ${dt.year}, ${hoursStr}:${minutesStr}`;
}

/**
 * Get number of days in a month
 * @param {number} month - Month (0-11)
 * @param {number} year - Year
 * @returns {number} Number of days
 */
function getDaysInMonth(month, year) {
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Handle leap years for February
  if (month === 1) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }

  return daysPerMonth[month];
}

/**
 * Convert a date/time from one time zone to another
 *
 * @param {string} dateTimeStr - Date/time in format "Mon DD, YYYY, HH:MM"
 * @param {string} fromTZ - Source time zone abbreviation
 * @param {string} toTZ - Target time zone abbreviation
 * @returns {string} Converted date/time in same format
 *
 * @example
 * convertDateTime("Feb 16, 2026, 10:00", "PST", "EST")
 * // Returns: "Feb 16, 2026, 13:00"
 */
function convertDateTime(dateTimeStr, fromTZ, toTZ) {
  if (fromTZ === toTZ) {
    return dateTimeStr; // No conversion needed
  }

  const dt = parseDateTime(dateTimeStr);

  // Get UTC offsets
  const fromOffset = getTZOffset(fromTZ);
  const toOffset = getTZOffset(toTZ);

  // Calculate the time difference
  const hourDiff = toOffset - fromOffset;

  // Convert hours (handle fractional hours like IST)
  const wholeDiff = Math.floor(hourDiff);
  const fractionalDiff = (hourDiff - wholeDiff) * 60; // Convert fractional hour to minutes

  // Apply the time difference
  let newHours = dt.hours + wholeDiff;
  let newMinutes = dt.minutes + fractionalDiff;
  let newDay = dt.day;
  let newMonth = dt.month;
  let newYear = dt.year;

  // Normalize minutes
  if (newMinutes >= 60) {
    newHours += Math.floor(newMinutes / 60);
    newMinutes = newMinutes % 60;
  } else if (newMinutes < 0) {
    newHours -= Math.ceil(-newMinutes / 60);
    newMinutes = ((newMinutes % 60) + 60) % 60;
  }

  // Normalize hours and days
  while (newHours >= 24) {
    newHours -= 24;
    newDay += 1;
  }

  while (newHours < 0) {
    newHours += 24;
    newDay -= 1;
  }

  // Normalize days
  while (newDay > getDaysInMonth(newMonth, newYear)) {
    newDay -= getDaysInMonth(newMonth, newYear);
    newMonth += 1;
    if (newMonth >= 12) {
      newMonth = 0;
      newYear += 1;
    }
  }

  while (newDay <= 0) {
    newMonth -= 1;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    newDay += getDaysInMonth(newMonth, newYear);
  }

  return formatDateTime({
    month: newMonth,
    day: newDay,
    year: newYear,
    hours: newHours,
    minutes: Math.round(newMinutes)
  });
}

module.exports = {
  convertDateTime,
  getTZOffset,
  isValidTZ
};
