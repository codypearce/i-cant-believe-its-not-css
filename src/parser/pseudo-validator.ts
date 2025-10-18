// Pseudo-selector validation for complex pseudo-classes
// Validates :is(), :where(), :not(), :has(), :nth-child(), etc.

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validates the content of a pseudo-selector like :is(), :not(), :nth-child(), etc.
 * @param pseudoValue The full pseudo string, e.g., "is(button, .foo)" or "nth-child(2n+1)"
 */
export function validatePseudoSelector(pseudoValue: string): ValidationResult {
  const trimmed = pseudoValue.trim();

  // Extract pseudo name and arguments
  const match = trimmed.match(/^([a-z-]+)\((.*)\)$/i);
  if (!match) {
    // Not a function pseudo-selector, might be simple like "hover", "focus", etc.
    // These are always valid
    return { valid: true };
  }

  const [, name, args] = match;
  const lowerName = name.toLowerCase();

  // Validate based on pseudo-selector type
  switch (lowerName) {
    case 'is':
    case 'where':
      return validateSelectorList(args, lowerName);

    case 'not':
      return validateSelectorList(args, lowerName);

    case 'has':
      return validateRelativeSelectorList(args);

    case 'nth-child':
    case 'nth-last-child':
    case 'nth-of-type':
    case 'nth-last-of-type':
      return validateNthPattern(args, lowerName);

    default:
      // Unknown pseudo-selector, allow it (might be new or vendor-specific)
      return { valid: true };
  }
}

/**
 * Validates a selector list for :is(), :where(), :not()
 * Format: comma-separated simple/compound/complex selectors
 * Example: "button, .foo, [disabled]"
 */
function validateSelectorList(args: string, pseudoName: string): ValidationResult {
  const selectors = args.split(',').map(s => s.trim()).filter(Boolean);

  if (selectors.length === 0) {
    return { valid: false, error: `:${pseudoName}() requires at least one selector` };
  }

  for (const sel of selectors) {
    // Check for pseudo-elements (not allowed in :is(), :where(), :not())
    if (/::?(?:before|after|first-line|first-letter|marker|backdrop|placeholder|file-selector-button)/.test(sel)) {
      return { valid: false, error: `:${pseudoName}() cannot contain pseudo-elements (found in "${sel}")` };
    }

    // Basic selector validation
    const selectorResult = validateBasicSelector(sel);
    if (!selectorResult.valid) {
      return { valid: false, error: `:${pseudoName}() has invalid selector "${sel}": ${selectorResult.error}` };
    }
  }

  return { valid: true };
}

/**
 * Validates relative selector list for :has()
 * Format: relative selectors with combinators like "> .child", "+ .sibling"
 * Example: "> .child" or ".descendant" or "+ .sibling"
 */
function validateRelativeSelectorList(args: string): ValidationResult {
  const selectors = args.split(',').map(s => s.trim()).filter(Boolean);

  if (selectors.length === 0) {
    return { valid: false, error: ':has() requires at least one selector' };
  }

  for (const sel of selectors) {
    // Relative selectors can start with combinators
    const hasValidStart = /^[>+~]?\s*[.#\[\w*:]/.test(sel);
    if (!hasValidStart) {
      return { valid: false, error: `:has() has invalid relative selector "${sel}"` };
    }

    // Basic validation of the selector part
    const selectorPart = sel.replace(/^[>+~]\s*/, '');
    const selectorResult = validateBasicSelector(selectorPart);
    if (!selectorResult.valid) {
      return { valid: false, error: `:has() has invalid selector "${sel}": ${selectorResult.error}` };
    }
  }

  return { valid: true };
}

/**
 * Validates an+b pattern for :nth-child(), etc.
 * Valid patterns:
 * - "odd", "even"
 * - "5" (just a number)
 * - "2n", "3n+4", "-n+3", "2n-1"
 */
function validateNthPattern(args: string, pseudoName: string): ValidationResult {
  const trimmed = args.trim();

  // Check for "of <selector>" syntax (e.g., "2n+1 of .foo")
  const ofMatch = trimmed.match(/^(.+?)\s+of\s+(.+)$/i);
  let pattern = trimmed;
  let ofSelector = '';

  if (ofMatch) {
    pattern = ofMatch[1].trim();
    ofSelector = ofMatch[2].trim();

    // Validate the "of" selector part
    const selectorResult = validateBasicSelector(ofSelector);
    if (!selectorResult.valid) {
      return { valid: false, error: `:${pseudoName}() has invalid "of" selector "${ofSelector}": ${selectorResult.error}` };
    }
  }

  // Validate the an+b pattern
  const lowerPattern = pattern.toLowerCase();

  // Keywords
  if (lowerPattern === 'odd' || lowerPattern === 'even') {
    return { valid: true };
  }

  // Just a number
  if (/^-?\d+$/.test(pattern)) {
    return { valid: true };
  }

  // an+b notation
  // Valid formats: n, 2n, -n, +n, 3n+4, 2n-1, -n+3, +3n-2, etc.
  const anPlusBPattern = /^([+-]?\d*n)?\s*([+-]?\s*\d+)?$/i;
  if (anPlusBPattern.test(pattern)) {
    return { valid: true };
  }

  return { valid: false, error: `:${pseudoName}() has invalid pattern "${pattern}". Expected "odd", "even", a number, or an+b notation like "2n+1"` };
}

/**
 * Basic validation of a selector
 * Checks for obvious syntax errors
 */
function validateBasicSelector(selector: string): ValidationResult {
  const trimmed = selector.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Empty selector' };
  }

  // Check for unmatched brackets
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    return { valid: false, error: 'Unmatched square brackets' };
  }

  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return { valid: false, error: 'Unmatched parentheses' };
  }

  // Check for invalid starting characters (can't start with numbers, except ID selectors)
  if (/^[0-9]/.test(trimmed) && !trimmed.startsWith('#')) {
    return { valid: false, error: 'Selector cannot start with a number' };
  }

  // Check for double operators
  if (/[>+~]{2,}/.test(trimmed)) {
    return { valid: false, error: 'Invalid combinator sequence' };
  }

  return { valid: true };
}
