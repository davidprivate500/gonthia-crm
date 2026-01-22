// BUG-008 FIX: Search utilities with proper escaping

/**
 * Escapes SQL LIKE/ILIKE special characters
 * Prevents users from using wildcards like % and _ in search terms
 */
export function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')  // Escape backslash first
    .replace(/%/g, '\\%')    // Escape percent
    .replace(/_/g, '\\_');   // Escape underscore
}

/**
 * Creates a safe search pattern for ILIKE queries
 * Wraps the escaped input with wildcards for partial matching
 */
export function toSearchPattern(input: string): string {
  return `%${escapeLikePattern(input)}%`;
}

/**
 * Validates search input for potentially problematic patterns
 * Returns true if the input is safe to use
 */
export function isValidSearchInput(input: string): boolean {
  // Check for null bytes (PostgreSQL doesn't accept them)
  if (input.includes('\0')) {
    return false;
  }

  // Check for excessively long input (already handled by validation but double-check)
  if (input.length > 200) {
    return false;
  }

  return true;
}
