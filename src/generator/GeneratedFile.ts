import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';

/**
 * Represents a generated file
 */
export class GeneratedFile {
  /** Relative file path */
  readonly path: string;

  /** File content */
  readonly content: string;

  /** Whether this file was actually generated (vs skipped) */
  readonly generated: boolean;

  /** Output base directory */
  private outputDir: string;

  constructor(path: string, content: string, outputDir: string, generated: boolean = true) {
    this.path = path;
    this.content = content;
    this.outputDir = outputDir;
    this.generated = generated;
  }

  /**
   * Get the full output path
   */
  getFullPath(): string {
    return join(this.outputDir, this.path);
  }

  /**
   * Write the file to disk
   */
  async write(): Promise<void> {
    if (!this.generated) {
      return;
    }

    const fullPath = this.getFullPath();
    const dir = dirname(fullPath);

    // Ensure directory exists
    await mkdir(dir, { recursive: true });

    // Write file
    await writeFile(fullPath, this.content, 'utf-8');
  }
}
