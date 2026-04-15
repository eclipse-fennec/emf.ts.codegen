import type { GenModel } from '../genmodel/GenModel.js';
import type { GenPackage } from '../genmodel/GenPackage.js';
import type { GeneratorOptions } from './GeneratorOptions.js';
import { createDefaultOptions } from './GeneratorOptions.js';
import { GeneratorContext, type Diagnostic } from './GeneratorContext.js';
import { GeneratedFile } from './GeneratedFile.js';
import { BaseGenerator, PlainGenerator, DecoratorGenerator, EmfGenerator } from './modes/index.js';
import { GenerationMode } from '../genmodel/GenerationMode.js';
import { getName } from '../util/EObjectHelper.js';

/**
 * Result of code generation
 */
export interface GenerationResult {
  /** Generated files */
  files: GeneratedFile[];

  /** Diagnostics (warnings, errors) */
  diagnostics: Diagnostic[];

  /** Whether generation succeeded */
  success: boolean;
}

/**
 * Main code generator that orchestrates generation based on mode
 */
export class CodeGenerator {
  private genModel: GenModel;
  private context: GeneratorContext;
  private generator: BaseGenerator;

  constructor(genModel: GenModel, options?: Partial<GeneratorOptions>) {
    this.genModel = genModel;
    this.context = new GeneratorContext(genModel, createDefaultOptions(options));
    this.generator = this.createModeGenerator(genModel.generationMode);
  }

  /**
   * Create the appropriate generator for the mode
   */
  private createModeGenerator(mode: GenerationMode): BaseGenerator {
    switch (mode) {
      case GenerationMode.PLAIN:
        return new PlainGenerator(this.context);

      case GenerationMode.DECORATOR:
        return new DecoratorGenerator(this.context);

      case GenerationMode.EMF:
        return new EmfGenerator(this.context);

      default:
        this.context.warn(`Unknown mode: ${mode}, falling back to DECORATOR`);
        return new DecoratorGenerator(this.context);
    }
  }

  /**
   * Generate all code for the model
   */
  async generate(): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];

    try {
      // Generate each package
      for (const genPackage of this.genModel.genPackages) {
        const packageFiles = await this.generatePackage(genPackage);
        files.push(...packageFiles);
      }

      return {
        files,
        diagnostics: this.context.diagnostics,
        success: !this.context.hasErrors()
      };
    } catch (error) {
      this.context.error(error instanceof Error ? error.message : String(error));
      return {
        files,
        diagnostics: this.context.diagnostics,
        success: false
      };
    }
  }

  /**
   * Generate files for a package
   */
  private async generatePackage(genPackage: GenPackage): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    this.context.info(`Generating package: ${genPackage.ecorePackage.getName()}`);

    // Generate enums first (they might be referenced by classes)
    for (const genEnum of genPackage.genEnums) {
      this.context.info(`Generating enum: ${getName(genEnum.ecoreEnum)}`);
      const file = await this.generator.generateEnum(genEnum, genPackage);
      files.push(file);
    }

    // Generate interfaces if configured
    if (this.genModel.generateInterfaces) {
      for (const genClass of genPackage.genClasses) {
        if (genClass.generateInterface) {
          this.context.info(`Generating interface: ${genClass.ecoreClass.getName()}`);
          const file = await this.generator.generateInterface(genClass, genPackage);
          files.push(file);
        }
      }
    }

    // Generate classes if configured
    if (this.genModel.generateClasses) {
      for (const genClass of genPackage.genClasses) {
        if (genClass.generateImpl && !genClass.ecoreClass.isInterface()) {
          this.context.info(`Generating class: ${genClass.ecoreClass.getName()}`);
          const file = await this.generator.generateClass(genClass, genPackage);
          files.push(file);
        }
      }
    }

    // Generate package file
    if (this.genModel.generatePackage) {
      this.context.info(`Generating package file`);
      const packageFile = await this.generator.generatePackageFile(genPackage);
      files.push(packageFile);
    }

    // Generate factory if configured and supported
    if (this.genModel.generateFactory) {
      const factoryFile = await this.generator.generateFactory(genPackage);
      if (factoryFile) {
        this.context.info(`Generating factory`);
        files.push(factoryFile);
      }
    }

    // Generate mode-specific additional files
    if (this.generator instanceof DecoratorGenerator) {
      const annotationsFile = await this.generator.generateModelAnnotations(genPackage);
      files.push(annotationsFile);
    }

    if (this.generator instanceof EmfGenerator) {
      const indexFile = await this.generator.generateIndex(genPackage);
      files.push(indexFile);
    }

    // Generate nested packages recursively
    for (const nestedPackage of genPackage.nestedGenPackages) {
      const nestedFiles = await this.generatePackage(nestedPackage);
      files.push(...nestedFiles);
    }

    return files;
  }

  /**
   * Write all generated files to disk
   */
  async writeFiles(files: GeneratedFile[]): Promise<void> {
    for (const file of files) {
      await file.write();
      this.context.info(`Written: ${file.getFullPath()}`);
    }
  }

  /**
   * Generate and write all files
   */
  async run(): Promise<GenerationResult> {
    const result = await this.generate();

    if (result.success) {
      await this.writeFiles(result.files);
    }

    return result;
  }
}
