import { DateFormats } from "@core/constants/date-formats";
import { CoreUtils }   from "@core/utilities/core-utils";
import * as Moment     from "moment-timezone";


/*
---------------------------------------------------------------------------------------------
Interfaces
---------------------------------------------------------------------------------------------
*/

interface DateDiffNowFriendlyReturn {
    value: number;
    unit:  string;
}


/*
---------------------------------------------------------------------------------------------
Private Methods
---------------------------------------------------------------------------------------------
*/

const _dateDiff = (
    a:           string|number,
    b:           string|number,
    unitOftime:  Moment.unitOfTime.Diff = "hours",
    precise:     boolean                = false,
) => {
    const aDate = Moment(a);
    const diff = aDate.diff(b, unitOftime, precise);
    return diff;
};

const _dateDiffNow = (
    date:       string|number,
    unitOftime: Moment.unitOfTime.Diff = "hours",
    precise:    boolean                = false,
) => {
    const now = Date.now();
    return _dateDiff(now, date, unitOftime, precise);
};

const _dateDiffNowFriendly = (date: string|number): DateDiffNowFriendlyReturn => {
    let unit    = "hour";
    let timeAgo = _dateDiffNow(date, "hours");
    if (timeAgo < 1) {
        unit = "minute";
        timeAgo = _dateDiffNow(date, "minutes");
    }
    if (timeAgo > 24) {
        unit = "day";
        timeAgo = _dateDiffNow(date, "days");
    }

    const unitText = `${unit}${timeAgo !== 1 ? "s" : ""}`;
    return {
        unit:     unitText,
        value:    timeAgo,
    };
};

const _dateFromNow = (date: string|number|Moment.Moment, includeSuffix: boolean = false, shortFormat: boolean = false) => {
    if (CoreUtils.isNullOrUndefined(date)) {
        return null;
    }
    if (!Moment.isMoment(date)) {
        date = Moment(date);
    }
    const fromNow = date.fromNow(!includeSuffix);
    if (shortFormat) {
        const now = Moment();
        const minutesFromNow = now.diff(date, "minutes");
        if (minutesFromNow < 1) {
            return "Now";
        }

        if (minutesFromNow < 60) {
            return `${minutesFromNow}m`;
        }

        const hoursFromNow = now.diff(date, "hours");
        if (hoursFromNow >= 1 && hoursFromNow < 24) {
            return `${hoursFromNow}h`;
        }

        return `${now.diff(date, "days")}d`;
    }
    return fromNow;
};

/**
 *
 * @param timestamp String, number, or moment object of time being formatted
 * @param format See formats definied in DateFormat
 * @param showRelativeDate If "true", (1) yesterday will display "Yesterday" (2) today will display "Today" (3) tomorrow will display "Tomorrow"
 * @param timezone If specified, the timestamp will be formatted using Moment's timezone functionality for the specified timezone
 */
const _formatDate = (
    timestamp:               string|number|Moment.Moment,
    format?:                 keyof typeof DateFormats,
    showRelativeDates:       boolean = false,
    timezone?:               string) => {
    // Handle null or invalid date
    const invalidDateTime = CoreUtils.isNullOrUndefined(timestamp) ||
                            CoreUtils.isNullOrUndefined(Moment(timestamp)) ||
                            isNaN(Moment(timestamp).date());
    if ( invalidDateTime ){
        return null;
    }

    // Handle Custom Formatting for Relative Dates and Short Circuit
    if (showRelativeDates) {
        const todaysDate     = Moment().date();
        const yesterdaysDate = Moment().add(-1, "day").date();
        const tomorrowsDate  = Moment().add(1, "day").date();
        const givenDate      = Moment(timestamp).date();

        if (givenDate === yesterdaysDate) {
            return "Yesterday";
        }
        if (givenDate === todaysDate) {
            return "Today";
        }
        if (givenDate === tomorrowsDate) {
            return "Tomorrow";
        }
    }

    // Handle all other cases
    const useTimezone: boolean = CoreUtils.stringHasValue(timezone);
    let   moment:      Moment.Moment;

    // If the timestamp parameter is a Moment object, we use it and set the timezone
    // If not we need to instantiate a new Moment object with the appropriate timezone if required
    if (Moment.isMoment(timestamp)) {
        moment = useTimezone ? timestamp.tz(timezone) : timestamp;
    } else  {
        moment = useTimezone ? Moment(timestamp).tz(timezone) : Moment(timestamp);
    }

    // Perform the actual format of the output
    const formatString = CoreUtils.isNullOrUndefined(format) ? _getDateFormatString(moment) : format;
    return moment.format(formatString);
};

const _getDateFormatString = (moment: Moment.Moment) => {
    if (moment.isSame(Moment(), "day")) {
        return DateFormats.OrdinalTimeMeridian;
    } else if (moment.isSame(Moment(), "year")) {
        return DateFormats.OrdinalMonthDayTimeMeridian;
    } else {
        return DateFormats.OrdinalMonthDayYearTimeMeridian;
    }
};


const _getMomentFromStandardDateFormat = (standardDateFormat: string): Moment.Moment => {
    if (CoreUtils.isNullOrUndefined(standardDateFormat)) {
        // no value provided
        return null;
    }
    const dateParts = standardDateFormat.split("/");
    if (dateParts.length !== 3) {
        // not a valid standard date format
        return null;
    }
    const year      = dateParts[2];
    const month     = `${dateParts[0].length === 1 ? "0" : ""}${dateParts[0]}`;
    const day       = `${dateParts[1].length === 1 ? "0" : ""}${dateParts[1]}`;
    const newMoment = Moment(`${month}-${day}-${year}`, DateFormats.OrdinalMonthDayYearDashedFourDigitYear);

    return newMoment;
};

const _utcNowString = () => Moment().format();

const _copyDate = (from: Moment.Moment, to: Moment.Moment) => {
    if (from.isValid() && to.isValid()) {
        to.set("month", from.month());
        to.set("date", from.date());
        to.set("year", from.year());
    }
    return to;
};

const _copyTime = (from: Moment.Moment, to: Moment.Moment) => {
    if (from.isValid() && to.isValid()) {
        to.set("hour", from.hour());
        to.set("minute", from.minute());
        to.set("second", from.second());
    }
    return to;
};

/**
 * Parse a date into a Moment without knowing the date format and in a way that all browsers can successfully read
 * @param {string} value String representation of datetime
 * @returns {Moment.Moment} Will always be a Moment object returned but may be invalid if the provided string was not a valid date
 */
const _parseDate = (value: string): Moment.Moment => {
    let moment: Moment.Moment;

    if (CoreUtils.stringIsEmpty(value)) {
        return Moment.invalid();
    }

    // List of common date format strings, in order of preference, for parsing the provided string into a Moment object
    const shouldParseOrdinalMonthDayTwoDigitYear = (val: string) =>
        val.length >= 6 &&
        val.length <= 8 &&
        val.substring(val.length - 4, val.length).indexOf("/") > 0;

    const shouldParseOrdinalMonthDayFullYear = (val: string) =>
        val.length >= 8 &&
        val.length <= 10 &&
        val.substring(val.length - 4, val.length).indexOf("/") < 0;

    const commonDateFormats = [
        { format: DateFormats.OrdinalMonthDayTwoDigitYear, shouldParse: shouldParseOrdinalMonthDayTwoDigitYear },
        { format: DateFormats.OrdinalMonthDayFullYear,     shouldParse: shouldParseOrdinalMonthDayFullYear },
        { format: DateFormats.ISODateTimeOffset,           shouldParse: (_: string) => true },
        { format: DateFormats.DateTimeOffset,              shouldParse: (_: string) => true },
    ];

    // Keep looping through and when a valid date string is found to be a valid date, return immediately
    for (const { format, shouldParse } of commonDateFormats) {
        if (!shouldParse(value)) { continue; }

        moment = Moment(value, format);
        if (moment.isValid()) {
            return moment;
        }
    }

    // Last chance to parse and return a valid date
    return Moment(value);
};

/*
---------------------------------------------------------------------------------------------
Export
---------------------------------------------------------------------------------------------
*/

export const DateUtils = {
    copyDate:                        _copyDate,
    copyTime:                        _copyTime,
    dateDiff:                        _dateDiff,
    dateDiffNow:                     _dateDiffNow,
    dateDiffNowFriendly:             _dateDiffNowFriendly,
    dateFromNow:                     _dateFromNow,
    formatDate:                      _formatDate,
    getDateFormatString:             _getDateFormatString,
    getMomentFromStandardDateFormat: _getMomentFromStandardDateFormat,
    parseDate:                       _parseDate,
    utcNowString:                    _utcNowString,
};
