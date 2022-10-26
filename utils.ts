import { PromiseUtils }           from "@core/async/promise-utils";
import { RoleType }               from "@core/enums/role-type-enum";
import { IAuthenticatedUser }     from "@core/interfaces/auth/authenticated-user-interface/authenticated-user-interface";
import { ReadonlyComponentProps } from "@core/interfaces/component-props/readonly-component-props";
import { IFile }                  from "@core/models/files/file-interface";
import { SchoolYear }             from "@core/models/schools/school-year-interface";
import { ISystemSettings }        from "@core/models/system-settings/system-settings-interface";
import { IUser }                  from "@core/models/users/user-interface";
import { ServiceResponse }        from "@core/services/interfaces/service-response";
import { getResponsiveImage }     from "@core/transforms/files/file-transforms";
import {
    transformFileVersion,
    transformFileVersions,
}                                 from "@core/transforms/files/file-version-transforms";
import { CollectionUtils }        from "@core/utilities/collection-utils/collection-utils";
import { debounce }               from "@core/utilities/debounce";
import {
    fileToBase64Async,
    getAbsoluteUrl,
    mapContentTypeToFileKind,
    registerFileConstructorPolyfill,
}                                 from "@core/utilities/files";
import { round }                  from "@core/utilities/math";
import { NumberUtils }            from "@core/utilities/number";
import { RegExpUtils }            from "@core/utilities/regexp-utils/regexp-utils";
import {
    scrollToBottom,
    scrollToTop,
}                                 from "@core/utilities/scroll";
import { setDataState }           from "@core/utilities/state";
import { ValueUtils }             from "@core/utilities/value-utils";
import {
    getClientValidationErrors,
    getServerErrors,
    getServerValidationErrors,
    getUnhandledErrors,
    getValidationErrorCount,
    validate,
}                                 from "@core/validation/helpers";
import { Route }                  from "@routing/_interfaces/route";
import { RoutingUtils }           from "@routing/routing";
import { RoutingProps }           from "@routing/routing-props";
import { getAuthenticatedRole }   from "@state/user-state";
import { List }                   from "immutable";
import { ResponsiveImageSet }     from "kop-elements/_interfaces/responsive-image-set";
import { SelectOption }           from "kop-elements/_interfaces/select-option";
import { Helpers }                from "kop-utils/helpers";
import * as Moment                from "moment";
import { cloneElement }           from "react";
import { matchPath }              from "react-router";
import * as uuidv4                from "uuid/v4";
import { bindAll }                from "./binding";
import { clone }                  from "./clone";
import {
    capitalize,
    contains,
    containsTokenized,
    convertToTitleCase,
    removeWhitespace,
    StringUtils,
    truncateWithEllipses,
}                                 from "./string";


/*
---------------------------------------------------------------------------------------------
Constants
---------------------------------------------------------------------------------------------
*/

// Matches open and close paragraph tags as well as break tags.
const RICH_TEXT_VALIDATOR_REGEX = /(<\/?p>)|(<br\s*\/?>)/g;

/*
---------------------------------------------------------------------------------------------
Private Methods
---------------------------------------------------------------------------------------------
*/

/**
 * Returns whether the provided exception was the result of a cancelled promise
 * @param exception
 */
const _isPromiseCancelled = (exception: any): boolean => {
    return ValueUtils.isNotNullOrUndefined(exception)
            && ValueUtils.isNotNullOrUndefined(exception.isCanceled);
};

/**
 * CCALMS2-10021: This is generic method to check any HTML tags present in Rich text Editor.
 * If any HTML Tags present then it simply return caption string and if not then add <em> tag before and after caption to look italic.
 *
 * @param caption                   Accept caption string as a input
 * @returns                         Return caption string as a value
 */

const _getUpdatedCaption = (caption: string): string => {
    if (CoreUtils.isNotNullOrUndefined(caption)) {
        return caption?.match(RegExpUtils.richTextEditorTagsAndAttributes) ? caption : `<em>${caption}</em>`;
    }
};

/**
 * the first item that is not null or undefined will be returned
 * @param values all values to evaluate
 */
const _coalesce = (...values: any[]): any => {
    let value = null;

    if (CollectionUtils.isEmpty(values)) {
        return value;
    }

    do {
        value = values.shift();
    } while (values.length > 0 && ValueUtils.isNullOrUndefined(value));

    return value;
};

const _currentUserHasRole = (roleType: RoleType, user?: IAuthenticatedUser) => {
    if (ValueUtils.isNullOrUndefined(user)) {
        const role = getAuthenticatedRole(window);

        if (ValueUtils.isNullOrUndefined(role) || ValueUtils.isNullOrUndefined(role.type)) {
            return false;
        }
        return role.type === roleType;
    }

    if (ValueUtils.isNullOrUndefined(user.currentRoleId) || user.currentRoleId <= 0 || CollectionUtils.isEmpty(user.roles)) {
        return false;
    }

    let userHasRole = false;

    for (const role of user.roles) {
        if (role.id === user.currentRoleId && role.type === roleType) {
            userHasRole = true;
        }
    }

    return userHasRole;
};

const _currentUserHasRoles = (roleTypes: RoleType[], user?: IAuthenticatedUser) => {
    if (CollectionUtils.isEmpty(roleTypes)) {
        return false;
    }

    let userHasRole = false;

    roleTypes.forEach((r) => {
        if (_currentUserHasRole(r, user)) {
            userHasRole = true;
        }
    });

    return userHasRole;
};

/**
 * Generates a unique element id for use where a component may be rendered more than once in the DOM.
 * @param id String value of the id for the element.
 */
const _generateUniqueHtmlId = (id: string): string => {
    return id + _getRandomNumberExceptExclusions([], 1000).toString();
};

const _getRandomNumberExceptExclusions = (exclusions: number[], max: number): number => {
    let randomNumber = null;

    while (randomNumber === null || exclusions.indexOf(randomNumber) !== -1) {
        randomNumber = Math.round(Math.random() * Math.floor(max));
    }

    return randomNumber;
};

/**
 * Transforms a given file into a responsive image set for use in rendering in components
 *
 * @param {ISystemSettings} systemSettings - reference to system settings
 * @param {IFile} file - reference to the file
 * @return {ResponsiveImageSet} - responsive image structure for the provided file
 * modified to fix CCALMS2-17488
 */
const _getResponsiveImageSet = (systemSettings: ISystemSettings, file: IFile): ResponsiveImageSet => {
    if (CoreUtils.isNullOrUndefined(file) || CoreUtils.isNullOrUndefined(file.versions))  {
        return undefined;
    }
    const fileVersion: any =  { ...file, fileId: file.id };
    const newFile: any = transformFileVersion(systemSettings, fileVersion);

    file.versions = transformFileVersions(systemSettings, file.versions);

    const responsiveImageSet: ResponsiveImageSet = {
        base:   undefined,
        double: undefined,
    };

    let fileVersionsHash: any = file.versions;
    fileVersionsHash = {};
    file.versions.forEach((fv: any) => fileVersionsHash[fv.name] = fv);

    // Automatically set properties on result for every version we find
    for (const key in fileVersionsHash) {
        if (! fileVersionsHash.hasOwnProperty(key)) {
            continue;
        }

        const version = fileVersionsHash[key];
        if (version.fileId !== file.id) {
            continue;
        }

        responsiveImageSet[version.name] = getResponsiveImage(newFile, version);
    }

    // When a default version type isn't found above, that means we need to default
    // them to use the parent file.
    if (responsiveImageSet.base === undefined) {
        responsiveImageSet.base = getResponsiveImage(newFile);
    }

    if (responsiveImageSet.double === undefined) {
        responsiveImageSet.double = getResponsiveImage(newFile);
    }

    return responsiveImageSet;
};

/**
 * Merges the date from the date moment object with the time momen object.
 * This assumes both are using the same timezone
 * @param date
 * @param time
 */
const _getMergedDateTime = (date: Moment.Moment, time: Moment.Moment) => {
    return time
        .year(date.year())
        .month(date.month())
        .date(date.date());
};

/**
 * Generates a new Uuid
 */
const _getNewUuid = () => {
    return uuidv4();
};

const _getNumberOrdinal = (value: number) => {
    if (value <= 0) {
        return "";
    }

    const j     = value % 10;
    const k     = value % 100;
    let ordinal = "th";

    if (j === 1 && k !== 11) {
        ordinal = "st";
    } else if (j === 2 && k !== 12) {
        ordinal = "nd";
    } else if (j === 3 && k !== 13) {
        ordinal = "rd";
    }

    return ordinal;
};

/**
 * Type-safe access of deep property of an object
 *
 * Ex: const foo = CoreUtils.getOrDefault(obj, (o => o.some.deep.property.of.obj));
 *
 * @param obj                   Object to get deep property
 * @param unsafeDataOperation   Function that returns the deep property
 * @param valueIfFail           Value to return in case if there is no such property
 */
const _getOrDefault = <O, T>(obj: O, unsafeDataOperation: (x: O) => T, valueIfFail: T = null): T => {
    try {
        return unsafeDataOperation(obj);
    } catch (error) {
        return valueIfFail;
    }
};

const _getPagingSkip = (take: number, pageNumber: number) => {
    return take * (pageNumber - 1);
};

const _getSelectOptionsFromCollection = <T, V>(collection: T[] | List<T>, label: (item: T) => string, value: (item: T) => V): SelectOption[] => {
    if (collection instanceof Array) {
        const collectionArray = collection as T[];
        return collectionArray.filter((item: T) => ValueUtils.isNotNullOrUndefined(item)).map((item) => {
            return {
                label: label(item),
                value: value(item),
             } as SelectOption;
        });
    }
    if (collection instanceof List) {
        const collectionList = collection as List<T>;
        return collectionList.filter((item: T) => ValueUtils.isNotNullOrUndefined(item)).map((item) => {
            return {
                label: label(item),
                value: value(item),
             } as SelectOption;
        }).toArray();
    }
};

const _getSelectOptionsFromEnum = (enumObject: any, hasNonNumericalValues: boolean = false) => {
    return Object.keys(enumObject)
    .filter((key) => hasNonNumericalValues || !isNaN(enumObject[key]))
    .map((key) => {
        key = key.replace("_", " ");
        return { label: key, value: enumObject[key] };
    });
};

const _getSortOption = (sortOptionEnum: any, sortBy: string, sortDirection: string) => {
    let direction = "Descending";
    if (ValueUtils.isNullOrUndefined(sortDirection) || sortDirection.toLowerCase() === "asc") {
        direction = "Ascending";
    }
    const sortOption = sortOptionEnum[direction + sortBy];

    return sortOption;
};

const _getUrlParam = (routingProps: RoutingProps, paramName: string): any => {
    const param = routingProps.match.params[paramName];
    return param;
};

/**
 *  @deprecated should be using User Record instead
 *
 */
const _getUserPreferredFirstName = (user: Partial<IUser>): string => {
    const preferredFirstName = user.preferredFirstName ? user.preferredFirstName : user.firstName;

    return preferredFirstName;
};
/**
 *  @deprecated should be using User Record instead
 *
 */
const _getUserPreferredFullName = (user: Partial<IUser>): string => {
    const preferredFirstName = _getUserPreferredFirstName(user);
    const preferredLastName  = _getUserPreferredLastName(user);

    return preferredFirstName + " " + preferredLastName;
};
/**
 *  @deprecated should be using User Record instead
 *
 */
const _getUserPreferredLastName = (user: Partial<IUser>): string => {
    const preferredLastName  = user.preferredLastName  ? user.preferredLastName  : user.lastName;

    return preferredLastName;
};

const _isComponentReadonly = (props: ReadonlyComponentProps): boolean => {
    return _coalesce(props.isReadonly, false);
};

const _isFunction = (value: any) => {
    return ValueUtils.isNotNullOrUndefined(value) && (typeof value === "function");
};

const _isRetina = (overrideRatio?: number): boolean => {
    let mediaQuery: string;

    if (ValueUtils.isNotNullOrUndefined(window)) {
        const ratio    = CoreUtils.coalesce(overrideRatio, 1.25);
        const fraction = `${parseInt((ratio * 4).toString(), 10)}/4`;

        mediaQuery = `(-webkit-min-device-pixel-ratio: ${ratio}), (min--moz-device-pixel-ratio: ${ratio}), (-o-min-device-pixel-ratio: ${fraction}), (min-resolution: ${ratio}dppx)`;

        if (window.devicePixelRatio >= ratio) {
            return true;
        }

        if (window.matchMedia && window.matchMedia(mediaQuery).matches) {
            return true;
        }
    }

    return false;
};

const _isSameMonthAndDay = (dateOne: Moment.Moment, dateTwo: Moment.Moment) => {
    return dateOne.date() === dateTwo.date() && dateOne.month() === dateTwo.month();
};

const _isToday = (date: Moment.Moment) => {
    if (ValueUtils.isNullOrUndefined(date)) {
        return false;
    }
    return date.isSame(new Date(), "day");
};

const _isValidEmail = (email: string) => {
    email = email.trim();
    const emailPattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return emailPattern.test(email);
};

/**
 * Determines whether React can match the current path to the route provided
 *
 * @param {Route} routeToMatch
 * @returns {boolean} True if the current window.location.pathname matches the Route.React field,
 * false otherwise
 */
const _matchesRoutePath = (routeToMatch: Route): boolean => {
    const pathname = window.location.pathname;
    const matchResult = matchPath(pathname, { path: routeToMatch.React, exact: true });
    return CoreUtils.isNotNullOrUndefined(matchResult);
};

/**
 * Logs to the console service response errors on when in the development environment.
 *
 * @param {string} label - Log label in the console. (The name of the calling method is a good start.)
 * @param {ServiceResponse} response - Service response object from api.
 */
const _logDevServiceError = (label: string, response: ServiceResponse): void => {
    if (response.errorCount > 0 && process.env.NODE_ENV === "development") {
        console.warn(`*** Development Env Errors for ${label} ***`);
        response.errors.forEach((error, index) => {
            console.warn(`Error #${index + 1} - Key: ${error.key} - Message: ${error.message}`);
        });
        console.warn(response);
    }
};

/**
 * Shallowly merges given objects into one.
 * @param objects All of the objects to shallow merge together
 */
const _shallowMerge = (...objects: any[]): any => {
    let mergedObject = {};

    if (CollectionUtils.isEmpty(objects)) {
        return mergedObject;
    }

    objects.forEach((object) => {
        mergedObject = { ...mergedObject, ...object };
    });

    return mergedObject;
};


const _removeDuplicates = (array: object[], prop: string = "id") => {
    return array.filter((obj, pos, arr) => {
        return arr.map((mapObj) => mapObj[prop]).indexOf(obj[prop]) === pos;
    });
};

const _setCustomPageTitle = (title: string): void => {
    document.title = `Edio | ${title}`;
};

const _setPageTitle = (route: Route): void => {
    document.title = `Edio | ${route.Name}`;
};

const _getPropValue = (props: any, key: string) => {
    const value = props.match.params[key];
    if (ValueUtils.isNotNullOrUndefined(value)) {
        if (isNaN(value)) {
            return value;
        }
        return parseInt(value, 0);
    }
    return undefined;
};

const _escapeSingleQuote = (urlValue: string) => (ValueUtils.isNotNullOrUndefined(urlValue) ? urlValue :  "").replace(/'/g, "\\'");

const _richTextHasValue = (value: string): boolean => {
    return StringUtils.stringHasValue(value.replace(RICH_TEXT_VALIDATOR_REGEX, ""));
};

const _richTextIsEmpty = (value: string): boolean => {
    return StringUtils.stringIsEmpty(value.replace(RICH_TEXT_VALIDATOR_REGEX, ""));
};

const _subtractWeekdays = (date: Moment.Moment, days: number): Moment.Moment => {
    date = Moment(date); // use a clone

    while (days > 0) {
        date = date.subtract(1, "days");
        // increase "days" only if it's a weekday.
        if (date.isoWeekday() !== 6 && date.isoWeekday() !== 7) {
            days -= 1;
        }
    }

    return date;
};

/**
 * Enables typescript classes to extend multiple classes instead of just one
 * https://www.typescriptlang.org/docs/handbook/mixins.html
 * Top level properties take precedence when the same property exists on main class and one of the extended classes
 * @param derivedCtor Main derived class
 * @param baseCtors Array of classes to extend
 */
const _applyMixins = (derivedCtor: any, baseCtors: any[]): void => {
   baseCtors.forEach((baseCtor: any) => {
       Object.getOwnPropertyNames(baseCtor.prototype).forEach((name: any) => {
           if (!derivedCtor.prototype[name]) {
               Object.defineProperty(derivedCtor.prototype, name, Object.getOwnPropertyDescriptor(baseCtor.prototype, name));
           }
       });
   });
};

/**
 * Takes an array of ServiceResponse<T>, merges them, and returns one ServiceResponse<T[]>
 *
 * @template T
 * @param {Array<ServiceResponse<T>>} responses
 * @returns {ServiceResponse<T[]>}
 */
const _combineServiceResponses = <T>(responses: Array<ServiceResponse<T>>): ServiceResponse<T[]> => {
    return responses
        .reduce((c: ServiceResponse<T[]>, r: ServiceResponse<T>) => {
            let   errors       = _coalesce(c.errors, []).concat(_coalesce(r.errors, []));
            const errorCount   = errors.length;
            let   message      = [c.message, r.message].filter((m: string) => StringUtils.stringHasValue(m)).toString();
            const resultObject = c.resultObject.concat(r.resultObject);
            const status       = (!c.status || r.status > c.status) ? r.status : c.status;

            if (StringUtils.stringIsEmpty(message)) {
                message = null;
            }

            // For backwards compatibilty, we want errors to be null instead of an empty array
            // This is because doesResponseHaveErrors checks for null or undefined to determine if there are errors
            if (CollectionUtils.isEmpty(errors)) {
                errors = null;
            }

            return {
                errorCount,
                errors,
                message,
                resultObject,
                status,
            };
        }, {
            errorCount:   0,
            errors:       [],
            message:      null,
            resultObject: [],
            status:       null,
        });
};

/**
 * Adds a key to each child component if one does not already exist
 * @param {string} section Unique section name added to the beginning of the key templated string
 * @param {React.ReactNode[]} children Array of children to add missing keys
 * @returns {React.ReactNode[]}
 */
const _addKeysToChildren = (section: string, children: React.ReactNode[]): React.ReactNode[] => {
    return children.map((c: any, i: number) => {
        if (CoreUtils.isNullOrUndefined(c.key)) {
            c = cloneElement(c, {
                key: `${section}-child-${(i + 1)}`,
            });
        }

        return c;
    });
};

/**
 * formats currency like:
 * $1,000,000.00
 * Ref: https://stackoverflow.com/questions/149055/how-can-i-format-numbers-as-currency-string-in-javascript
 */
const _formatCurrency = (
    amount:       number,
    decimal:      string = ".",
    decimalCount: number = 2,
    thousands:    string = ","): string => {
    try {
      decimalCount = Math.abs(decimalCount);
      decimalCount = isNaN(decimalCount) ? 2 : decimalCount;

      const negativeSign = amount < 0 ? "-" : "";

      let newAmount = amount as any;
      const i = parseInt(newAmount = Math.abs(Number(amount) || 0).toFixed(decimalCount), 10).toString() as any;
      const j = (i.length > 3) ? i.length % 3 : 0;

      return negativeSign + "$" + (j ? i.substr(0, j) + thousands : "")
        + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousands)
        + (decimalCount ? decimal + Math.abs(newAmount - i).toFixed(decimalCount).slice(2) : "") as string;
    } catch (e) {
      return null;
    }
  };

/**
 * formats a phone number like:
 * (555) 555-5555
 * or, with a country code
 * +1 (555) 555-5555
 */
const _formatPhoneNumber = (phoneNum: string): string => {
    phoneNum = phoneNum.replace(/[^0-9.]/g, ""); // remove everything except numbers

    if (phoneNum.length < 10 || phoneNum.length > 11) {
        return "--";
    }

    if (phoneNum.length > 10) {
        // includes country code
        return `+${phoneNum[0]} (${phoneNum.substring(1, 4)}) ${phoneNum.substring(4, 7)}-${phoneNum.substring(7)}`;
    }

    return `(${phoneNum.substring(0, 3)}) ${phoneNum.substring(3, 6)}-${phoneNum.substring(6)}`;
};

/**
 * Checks for the presence of something in an array.
 * @param {Array<any>} against
 * @param {any} check
 * @param {boolean} strict
 */
const _arrayIncludes = (against: any[], check: any, strict: boolean = true): boolean => {
    try {
        if (strict){
            return !!against.find((e) => e === check);
        }
        else {
            // tslint:disable-next-line:triple-equals
            return !!against.find((e) => e == check);
        }
    }
    catch (error) {
        return false;
    }
};

/**
 * Returns the current SchoolYear from the SchoolYear years
 *
 * @param {SchoolYear[]} schoolYears - school years data
 * @return {SchoolYear} - the matched SchoolYear object
 */
const _getCurrentSchoolYear = (schoolYears: SchoolYear[]): SchoolYear => {
    const now = Moment();

    if (CoreUtils.isNullOrUndefined(schoolYears)) {
        return null;
    }

    const currentSchoolYear: SchoolYear = schoolYears.find((schoolYear: SchoolYear) => {
        return Moment(schoolYear.startDate).isBefore(now) && Moment(schoolYear.extensionEndDate).isAfter(now);
    });

    if (CoreUtils.isNullOrUndefined(currentSchoolYear)) {
        // cannot find current school year... bail
        return null;
    }

    return currentSchoolYear;
};

/**
 * Returns the SchoolYear from the SchoolYear year which matches the schoolYearId
 *
 * @param {SchoolYear[]} schoolYears - school years data
 * @param {number} schoolYearId - the id of the schoolYear for which the object is required
 * @return {SchoolYear} - the matched SchoolYear object
 */
const _getSchoolYearFromId = (schoolYears: SchoolYear[], schoolYearId: number): SchoolYear => {

    if (CoreUtils.isNullOrUndefined(schoolYears) || CoreUtils.isNullOrUndefined(schoolYearId) ) {
        return null;
    }

    const matchedSchoolYear: SchoolYear = schoolYears.find((schoolYear: SchoolYear) => {
        return schoolYear.id === schoolYearId;
    });

    if (CoreUtils.isNullOrUndefined(matchedSchoolYear)) {
        // cannot find current school year... bail
        return null;
    }

    return matchedSchoolYear;
};


/**
 * Determines whether React can match the provided pathname to the route provided
 *
 * @param {string} pathname
 * @param {Route} routeToMatch
 * @returns {boolean} True if the provided pathname string matches the Route.React field
 * false otherwise
 */
const _matchesPathname = (pathname: string, routeToMatch: Route): boolean => {
    const matchResult = matchPath(pathname, { path: routeToMatch.React, exact: true });
    return ValueUtils.isNotNullOrUndefined(matchResult);
};

/**
 * Determines whether React can match the provided pathname to the route provided
 *
 * @param {string} pathname
 * @param {Route[]} routesToMatch
 * @returns {boolean} True if the provided pathname string matches the routesToMatch
 * false otherwise
 */
const _matchesPathnames = (pathname: string, routesToMatch: Route[]): boolean => {
    if (CollectionUtils.isEmpty(routesToMatch)) {
        return false;
    }

    const matchFound = routesToMatch.find((routeToMatch: Route) => _matchesPathname(pathname, routeToMatch));

    if (CollectionUtils.hasValues(matchFound)) {
        return true;
    }

    return false;
};

/**
 * Checking if a object is Immutable or not
 *
 * @param {string} object value to be checked
 * @returns {boolean}
 */
const _isImmutable = (object: any): boolean => {
    return object.asImmutable && object.asImmutable() === object;
};

/**
 * Converting Blob to File using the File constructor
 * @param {Blob} theBlob The blob data
 * @param {string} fileName The name of the file
 * @returns {File}
 */
const _blobToFile = (theBlob: Blob, fileName: string): File => {
    return new File([theBlob], fileName, { lastModified: new Date().getTime(), type: theBlob.type });
};

/**
 * Downloads a file based on the given URL and name
 * @param {string} fileURL The URL of the file that is to be downloaded
 * @param {string } fileName The name of the file that is to be downloaded
 */
const _downloadFile = (fileURL: string, fileName: string): void => {
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = fileURL;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
    }, 100);
};

/**
 * Function to calculate the smallest multiple of x closest to a given number n
 */
const _closestMultiple = (n: number, x: number) => {
    if (n === 0 || n < 0) {
        return 0;
    }
    if (x > n) {
        return x;
    }
    n = n + Math.floor(x / 2);
    n = n - (n % x);
    return n;
};

/*
---------------------------------------------------------------------------------------------
Export
---------------------------------------------------------------------------------------------
*/

export const CoreUtils = {
    addKeysToChildren:               _addKeysToChildren,
    applyMixins:                     _applyMixins,
    arrayIncludes:                   _arrayIncludes,
    assertCurrentUrl:                RoutingUtils.assertCurrentUrl,
    bindAll:                         bindAll,
    blobToFile:                      _blobToFile,
    buildAbsoluteUrl:                RoutingUtils.buildAbsoluteUrl,
    buildUrl:                        RoutingUtils.replaceUrlParams,
    cancelPromises:                  PromiseUtils.cancelPromises,
    capitalize:                      capitalize,
    clone:                           clone,
    closestMultiple:                 _closestMultiple,
    coalesce:                        _coalesce,
    collectionHasValues:             CollectionUtils.hasValues,
    collectionIsEmpty:               CollectionUtils.isEmpty,
    combineServiceResponses:         _combineServiceResponses,
    convertToTitleCase:              convertToTitleCase,
    currentUserHasRole:              _currentUserHasRole,
    currentUserHasRoles:             _currentUserHasRoles,
    debounce:                        debounce,
    doResponsesHaveErrors:           PromiseUtils.doResponsesHaveErrors,
    doesResponseHaveErrors:          PromiseUtils.doesResponseHaveErrors,
    downloadFile:                    _downloadFile,
    emptyPromise:                    PromiseUtils.emptyPromise,
    escapeSingleQuote:               _escapeSingleQuote,
    fileToBase64Async:               fileToBase64Async,
    formatCurrency:                  _formatCurrency,
    formatPhoneNumber:               _formatPhoneNumber,
    generateUniqueHtmlId:            _generateUniqueHtmlId,
    getAbsoluteUrl:                  getAbsoluteUrl,
    getClientValidationErrors:       getClientValidationErrors,
    getCurrentPageNumber:            RoutingUtils.getCurrentPageNumber,
    getCurrentSchoolYear:            _getCurrentSchoolYear,
    getDefaultMap:                   CollectionUtils.getDefaultMap,
    getMergedDateTime:               _getMergedDateTime,
    getNewUuid:                      _getNewUuid,
    getNumberOrdinal:                _getNumberOrdinal,
    getOrDefault:                    _getOrDefault,
    getPagingSkip:                   _getPagingSkip,
    getPropValue:                    _getPropValue,
    getRandomNumberExceptExclusions: _getRandomNumberExceptExclusions,
    getResponsiveImageSet:           _getResponsiveImageSet,
    getSchoolYearFromId:             _getSchoolYearFromId,
    getSelectOptionsFromCollection:  _getSelectOptionsFromCollection,
    getSelectOptionsFromEnum:        _getSelectOptionsFromEnum,
    getServerErrors:                 getServerErrors,
    getServerValidationErrors:       getServerValidationErrors,
    getSortOption:                   _getSortOption,
    getUnhandledErrors:              getUnhandledErrors,
    getUpdatedCaption:               _getUpdatedCaption,
    getUrlParam:                     _getUrlParam,
    getUserPreferredFirstName:       _getUserPreferredFirstName,
    getUserPreferredFullName:        _getUserPreferredFullName,
    getUserPreferredLastName:        _getUserPreferredLastName,
    getValidationErrorCount:         getValidationErrorCount,
    goBack:                          RoutingUtils.goBack,
    goTo:                            RoutingUtils.goTo,
    goToWithReload:                  RoutingUtils.goToWithReload,
    handleException:                 PromiseUtils.handleException,
    isComponentReadonly:             _isComponentReadonly,
    isComprisedOf:                   CollectionUtils.isComprisedOf,
    isElementInViewport:             Helpers.isElementInViewport,
    isFunction:                      _isFunction,
    isImmutable:                     _isImmutable,
    isNotNullOrUndefined:            ValueUtils.isNotNullOrUndefined,
    isNullOrUndefined:               ValueUtils.isNullOrUndefined,
    isPromiseCancelled:              _isPromiseCancelled,
    isRetina:                        _isRetina,
    isSameMonthAndDay:               _isSameMonthAndDay,
    isToday:                         _isToday,
    isValidEmail:                    _isValidEmail,
    isWholeNumber:                   NumberUtils.isWholeNumber,
    logDevServiceError:              _logDevServiceError,
    mapContentTypeToFileKind:        mapContentTypeToFileKind,
    matchesPathname:                 _matchesPathname,
    matchesPathnames:                _matchesPathnames,
    matchesRoutePath:                _matchesRoutePath,
    moveItemInArray:                 Helpers.moveItemInArray,
    promisedSetState:                PromiseUtils.promisedSetState,
    queryStringToObject:             RoutingUtils.queryStringToObject,
    registerAllPromises:             PromiseUtils.registerAllPromises,
    registerFileConstructorPolyfill: registerFileConstructorPolyfill,
    registerNonCancellablePromise:   PromiseUtils.registerNonCancellablePromise,
    registerPromise:                 PromiseUtils.registerPromise,
    removeDuplicates:                _removeDuplicates,
    removeWhitespace:                removeWhitespace,
    richTextHasValue:                _richTextHasValue,
    richTextIsEmpty:                 _richTextIsEmpty,
    round:                           round,
    scrollToBottom:                  scrollToBottom,
    scrollToTop:                     scrollToTop,
    setCustomPageTitle:              _setCustomPageTitle,
    setDataState:                    setDataState,
    setPageTitle:                    _setPageTitle,
    shallowMerge:                    _shallowMerge,
    stringContains:                  contains,
    stringHasValue:                  StringUtils.stringHasValue,
    stringIsEmpty:                   StringUtils.stringIsEmpty,
    subtractWeekdays:                _subtractWeekdays,
    tokenizedStringSearch:           containsTokenized,
    truncateWithEllipses:            truncateWithEllipses,
    validate:                        validate,
};
