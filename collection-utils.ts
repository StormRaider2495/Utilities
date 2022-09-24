import { IHash }       from "@core/interfaces/hash";
import { NumberUtils } from "@core/utilities/number";
import { ValueUtils }  from "@core/utilities/value-utils";
import { List, Map }   from "immutable";

/**
 * Returns a collection of elements contained in collection A but not collection B
 *
 * See https://en.wikipedia.org/wiki/Set_difference
 * @template T
 * @param {(List<T> | T[])} collectionA
 * @param {(List<T> | T[])} collectionB
 * @param {(elementOfA: T, elementOfB: T) => boolean} [comparator]
 * Optional comparator function to run on elements of the collections.
 * By default, this resolves to strict equality checking (elementOfA === elementOfB)
 * @returns {List<T>}
 */
const _differenceOf = <T>(collectionA: List<T> | T[], collectionB: List<T> | T[], comparator?: (elementOfA: T, elementOfB: T) => boolean): List<T> => {
    const listA: List<T> = List<T>(collectionA);
    const listB: List<T> = List<T>(collectionB);

    if (ValueUtils.isNullOrUndefined(comparator)) {
        comparator = ((elementOfA: T, elementOfB: T) => elementOfA === elementOfB);
    }

    return listA.filterNot((elementA: T) => listB.some((elementB: T) => comparator(elementA, elementB))).toList();
};

/**
 * Flattens an immutable Map of Arrays or a 2D array into one single array.
 *
 * @template T
 * @param {(Map<any, T[]> | T[][])} collection
 * @returns {T[]}
 */
const _flatten = <T>(collection: Map<any, T[]> | T[][]): T[] => {
    let flattened: T[] = [];
    if (collection instanceof Map) {
        const map = collection as Map<any, T[]>;
        map.map((array: T[]) => flattened = flattened.concat(array));
    }
    if (collection instanceof Array) {
        const array = collection as T[][];
        array.map((array: T[]) => flattened = flattened.concat(array));
    }
    return flattened;
};

/**
 * Convenience method for use when setting default value and passing in an Enum
 * object for the keys of the Map.
 *
 * @template TEnum
 * @param {TEnum} enumType Type of the enum to use as the keys of the Map.
 * @param {boolean} [defaultValue=false] Boolean value to initialize all keys of the Map to.
 * @returns {Map<TEnum, boolean>}
 */
const _getDefaultMap = <TEnum>(enumType: TEnum, defaultValue: boolean = false): Map<TEnum, boolean> => {
    let defaultMap = Map<TEnum, boolean>({});
    Object.keys(enumType).forEach((key) => {
        const value = enumType[key];

        if (!isNaN(value)) {
            // ignores transpiled TS to JS enum to key/value pairs resulting
            // in keys that are the numbers
            defaultMap = defaultMap.set(enumType[key], defaultValue);
        } else {
            defaultMap = defaultMap.set(enumType[value], defaultValue);
        }
    });
    return defaultMap;
};

/**
 * Checks for values in a collection/object. Returns false if the collection is undefined, null,
 * or the respective object type's "empty" state, ie length 0, size 0, or has no keys.
 *
 * Uses ... syntax to allow a single collection or multiple collections to be passed in, ie
 * CollectionUtils.hasValues([]) or CollectionUtils.hasValues([], [], [])
 *
 * @param {(...Array<(any[] | List<any> | IHash<any>)>)} collections
 * @returns {boolean} False if `collections` is null/undefined, or every element is also null/undefined,
 * or has no sub-elements. True if any element has sub-elements.
 */
const _hasValues = (...collections: Array<(any[] | List<any> | IHash<any>)>): boolean => {
    if (ValueUtils.isNullOrUndefined(collections)) {
        return false;
    }

    let hasValues = false;

    collections.map((collection: any[] | List<any> | IHash<any>) => {
        if (!_isEmpty(collection)) {
            hasValues = true;
        }
    });

    return hasValues;
};

/**
 * Returns a Hash object with each value in the array mapped as the key & value
 * This probably doesn't have a large use-case aside from the CheckboxListDeprecated component,
 * but it's here if you need it. It will allow for easier refactoring of existing components using
 * the deprecated CheckboxList.
 *
 * @param {number[]} array
 * @returns {IHash<number>}
 */
const _hashFromNumberArray = (array: number[]): IHash<number> => {
    const hash: IHash<number> = {};
    if (_isEmpty(array)) {
        return hash;
    }

    // Filter out any invalid values (undefined, null, or floating points)
    const filteredArray = array.filter((num: number) => ValueUtils.isNotNullOrUndefined(num) && NumberUtils.isWholeNumber(num));

    filteredArray.map((num: number) => {
        hash[num] = num;
    });

    return hash;
};

/**
 * Returns a collection of elements contained in BOTH collection A and collection B
 *
 * https://en.wikipedia.org/wiki/Intersection_(set_theory)
 * @template T
 * @param {(List<T> | T[])} collectionA
 * @param {(List<T> | T[])} collectionB
 * @param {(elementOfA: T, elementOfB: T) => boolean} [comparator]
 * Optional comparator function to run on elements of the collections.
 * By default, this resolves to strict equality checking (elementOfA === elementOfB)
 * @returns {List<T>}
 */
const _intersectionOf = <T>(collectionA: List<T> | T[], collectionB: List<T> | T[], comparator?: (elementOfA: T, elementOfB: T) => boolean): List<T> => {
    const listA: List<T> = List<T>(collectionA);
    const listB: List<T> = List<T>(collectionB);

    if (ValueUtils.isNullOrUndefined(comparator)) {
        comparator = ((elementOfA: T, elementOfB: T) => elementOfA === elementOfB);
    }

    return listA.filter((elementA: T) => listB.some((elementB: T) => comparator(elementA, elementB))).toList();
};

/**
 * Checks for values in a collection/object. Returns true if the collection is undefined, null,
 * or the respective object type's "empty" state, ie length 0, size 0, or has no keys.
 *
 * Uses ... syntax to allow a single collection or multiple collections to be passed in, ie
 * CollectionUtils.isEmpty([]) or CollectionUtils.isEmpty([], [], [])
 *
 * @param {(...Array<(any[] | List<any> | IHash<any>)>)} collections
 * @returns {boolean} True if `collections` is null/undefined, or every element is also null/undefined,
 * or has no sub-elements. False if any element has sub-elements.
 */
const _isEmpty = (...collections: Array<(any[] | List<any> | IHash<any>)>): boolean => {
    if (ValueUtils.isNullOrUndefined(collections)) {
        return true;
    }

    let isEmpty = true;

    collections.map((collection: any[] | List<any> | IHash<any>) => {
        if (ValueUtils.isNullOrUndefined(collection)) {
            return;
        }
        if (collection instanceof List) {
            const collectionList = collection as List<any>;
            if (collectionList.size !== 0) {
                isEmpty = false;
            }
        } else if (collection instanceof Array) {
            const collectionArray = collection as any[];
            if (collectionArray.length !== 0) {
                isEmpty = false;
            }
        } else {
            const collectionHash = collection as IHash<any>;
            const hashIsEmpty    = _isEmpty(Object.keys(collectionHash));
            if (!hashIsEmpty) {
                isEmpty = false;
            }
        }
    });

    return isEmpty;
};

/**
 * Compares elements of a collection with specified type to check if every element is of that type.
 *
 * Examples:
 *  _isComprisedOf([5, 4], "number") => true.
 *  _isComprisedOf(["test", 6], "string") => false.
 *  _isComprisedOf(List<ItrFormStudentRecord>([new ItrFormStudentRecord()]), ItrFormStudentRecord) => true.
 *
 * Note: Primitive Types `type` must be specified in a string.
 *
 * @param {(collection: T[] | List<T>)} collection
 * @param {any} type
 * @returns {boolean} True if `collection` is null/undefined, or every element is of Type `type`,
 * or false if `collection` has elements not of Type `type`.
 */
const _isComprisedOf = <T>(collection: T[] | List<T>, type: any): boolean => {
    if (_isEmpty(collection)) {
        return true;
    }

    let isInstanceOf = true;


    // This section is revised from
    // https://dev.to/krumpet/generic-type-guard-in-typescript-258l
    interface typeMap { // for mapping from strings to types
        string:  string;
        number:  number;
        boolean: boolean;
    }

    // 'string' | 'number' | 'boolean' | constructor
    type PrimitiveOrConstructor = (new (...args: any[]) => any) | keyof typeMap;

    // infer the guarded type from a specific case of PrimitiveOrConstructor
    type GuardedType<T extends PrimitiveOrConstructor> = T extends new(...args: any[]) => infer U ? U : T extends keyof typeMap ? typeMap[T] : never;

    // finally, guard ALL the types!
    function typeGuard<T extends PrimitiveOrConstructor>(o: any, className: T):
        o is GuardedType<T> {
            const localPrimitiveOrConstructor: PrimitiveOrConstructor = className;
            if (typeof localPrimitiveOrConstructor === "string") {
            return typeof o === localPrimitiveOrConstructor;
        }

        return o instanceof localPrimitiveOrConstructor;
    }

    if (collection instanceof List) {
        const collectionList = collection as List<any>;
        collectionList.forEach((e: any) => {
            if (!(typeGuard(e, type))) {
                isInstanceOf = false;
                return;
            }
        });
    } else if (collection instanceof Array) {
        const collectionArray = collection as any[];
        collectionArray.forEach((e: any) => {
            if (!(typeGuard(e, type))) {
                isInstanceOf = false;
                return;
            }
        });
    }

    return isInstanceOf;
};

/**
 * Compares two objects and deep checks to verify if thery are equal or not.
 * Deep checking is done on object-value pair between the two objects.
 *
 * @param objectA
 * @param objectB
 * @returns {boolean} True if both the objects are equal, or False if any of the key values are different
 */
const _isEqual = (objectA: any, objectB: any): boolean => {
    if (objectA === objectB) { return true; }

    if (typeof objectA !== "object" || typeof objectB !== "object" || objectA == null || objectB == null) {
        return false;
    }

    const keysA = Object.keys(objectA);
    const keysB = Object.keys(objectB);

    if (keysA.length !== keysB.length) {
        return false;
    }

    for (const key of keysA) {
        if (keysB.indexOf(key) === -1) {
            return false;
        }

        if (typeof objectA[key] === "function" || typeof objectB[key] === "function") {
            if (objectA[key].toString() !== objectB[key].toString()) {
                return false;
            }
        } else {
            if (!_isEqual(objectA[key], objectB[key])) {
                return false;
            }
        }
    }

    return true;
};

export const CollectionUtils = {
    differenceOf:            _differenceOf,
    flatten:                 _flatten,
    getDefaultMap:           _getDefaultMap,
    hasValues:               _hasValues,
    hashFromNumberArray:     _hashFromNumberArray,
    intersectionOf:          _intersectionOf,
    isComprisedOf:           _isComprisedOf,
    isEmpty:                 _isEmpty,
    isEqual:                 _isEqual,
};
