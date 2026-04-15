/**
 * String utility functions for code generation
 */

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Uncapitalize the first letter of a string
 */
export function uncapitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Convert camelCase to UPPER_SNAKE_CASE
 */
export function toUpperSnake(str: string): string {
  if (!str) return str;
  return str
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase()
    .replace(/^_/, '');
}

/**
 * Convert camelCase to lower_snake_case
 */
export function toLowerSnake(str: string): string {
  if (!str) return str;
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Convert to camelCase
 */
export function toCamelCase(str: string): string {
  if (!str) return str;
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^./, c => c.toLowerCase());
}

/**
 * Convert to PascalCase
 */
export function toPascalCase(str: string): string {
  if (!str) return str;
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^./, c => c.toUpperCase());
}

/**
 * Escape a string for use in generated code
 */
export function escapeString(str: string): string {
  if (!str) return str;
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Create a safe identifier from a string
 */
export function toSafeIdentifier(str: string): string {
  if (!str) return str;
  // Replace invalid characters
  let result = str.replace(/[^a-zA-Z0-9_$]/g, '_');
  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(result)) {
    result = '_' + result;
  }
  return result;
}

/**
 * Check if a string is a TypeScript reserved word
 */
export function isReservedWord(str: string): boolean {
  const reserved = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
    'false', 'finally', 'for', 'function', 'if', 'import', 'in',
    'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this',
    'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
    'as', 'implements', 'interface', 'let', 'package', 'private',
    'protected', 'public', 'static', 'yield', 'any', 'boolean',
    'constructor', 'declare', 'get', 'module', 'require', 'number',
    'set', 'string', 'symbol', 'type', 'from', 'of', 'namespace',
    'async', 'await', 'abstract', 'readonly', 'keyof', 'unique',
    'infer', 'is', 'never', 'unknown', 'asserts', 'bigint'
  ]);
  return reserved.has(str);
}

/**
 * Make an identifier safe by prefixing if it's a reserved word
 */
export function makeSafeIdentifier(str: string): string {
  const safe = toSafeIdentifier(str);
  return isReservedWord(safe) ? '_' + safe : safe;
}
