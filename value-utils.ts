//
// ---------------------------------------------------------------------------------------------
// #region Private Methods
// ---------------------------------------------------------------------------------------------
//

/**
 * Returns whether the value provided is not null/undefined
 *
 * @param value
 */
const _isNotNullOrUndefined = (value: any) => (value != null);

/**
 * Returns whether the value provided is null/undefined
 *
 * @param value
 */
const _isNullOrUndefined = (value: any) => (value == null);

// #endregion Private Methods

export const ValueUtils = {
    isNotNullOrUndefined: _isNotNullOrUndefined,
    isNullOrUndefined:    _isNullOrUndefined,
};
