/**
 * Options for code generation
 */
export interface GeneratorOptions {
  /** Output directory for generated files */
  outputDirectory: string;

  /** Whether to overwrite existing files */
  overwrite: boolean;

  /** Whether to format generated code */
  formatCode: boolean;

  /** File header template */
  fileHeader?: string;

  /** Whether to generate JSDoc comments */
  generateJsDoc: boolean;

  /** Line ending style */
  lineEnding: 'lf' | 'crlf';

  /** Indentation style */
  indentation: 'spaces' | 'tabs';

  /** Indentation size (for spaces) */
  indentSize: number;
}

/**
 * Default generator options
 */
export function createDefaultOptions(partial: Partial<GeneratorOptions> = {}): GeneratorOptions {
  return {
    outputDirectory: './generated',
    overwrite: true,
    formatCode: true,
    generateJsDoc: true,
    lineEnding: 'lf',
    indentation: 'spaces',
    indentSize: 2,
    ...partial
  };
}
