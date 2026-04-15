import ejs from 'ejs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { GenPackage } from '../../genmodel/GenPackage.js';
import type { GenClass } from '../../genmodel/GenClass.js';
import type { GenEnum } from '../../genmodel/GenEnum.js';
import type { GeneratorContext } from '../GeneratorContext.js';
import { GeneratedFile } from '../GeneratedFile.js';
import * as EObjectHelper from '../../util/EObjectHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Base class for mode-specific generators
 */
export abstract class BaseGenerator {
  protected context: GeneratorContext;
  protected templateCache: Map<string, ejs.TemplateFunction> = new Map();

  constructor(context: GeneratorContext) {
    this.context = context;
  }

  /**
   * Get the template directory for this mode
   */
  protected abstract getTemplateDir(): string;

  /**
   * Generate a class file
   */
  abstract generateClass(genClass: GenClass, genPackage: GenPackage): Promise<GeneratedFile>;

  /**
   * Generate an interface file
   */
  abstract generateInterface(genClass: GenClass, genPackage: GenPackage): Promise<GeneratedFile>;

  /**
   * Generate an enum file
   */
  abstract generateEnum(genEnum: GenEnum, genPackage: GenPackage): Promise<GeneratedFile>;

  /**
   * Generate a package barrel file
   */
  abstract generatePackageFile(genPackage: GenPackage): Promise<GeneratedFile>;

  /**
   * Generate factory file (EMF mode only, returns null for others)
   */
  async generateFactory(genPackage: GenPackage): Promise<GeneratedFile | null> {
    return null;
  }

  /**
   * Load and compile a template
   */
  protected async loadTemplate(templateName: string): Promise<ejs.TemplateFunction> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templateDir = this.getTemplateDir();
    const templatePath = join(templateDir, `${templateName}.ejs`);

    try {
      const content = await readFile(templatePath, 'utf-8');
      const template = ejs.compile(content, {
        filename: templatePath,
        async: false
      });
      this.templateCache.set(templateName, template);
      return template;
    } catch (error) {
      this.context.error(`Failed to load template: ${templatePath}`, templateName);
      throw error;
    }
  }

  /**
   * Render a template with data
   */
  protected async render(templateName: string, data: Record<string, unknown>): Promise<string> {
    const template = await this.loadTemplate(templateName);

    // Add common helpers
    const fullData = {
      ...data,
      context: this.context,
      typeMapper: this.context.typeMapper,
      importResolver: this.context.importResolver,
      indent: (level: number) => this.context.getIndent(level),
      header: this.context.getFileHeader(),
      // Helper functions
      capitalize: (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '',
      uncapitalize: (s: string) => s ? s.charAt(0).toLowerCase() + s.slice(1) : '',
      toUpperSnake: (s: string) => s ? s.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '') : '',
      toLowerSnake: (s: string) => s ? s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') : '',
      // EObject helper functions for dynamic objects
      getName: EObjectHelper.getName,
      getFeatureValue: EObjectHelper.getFeatureValue,
      getLiteral: EObjectHelper.getLiteral,
      getValue: EObjectHelper.getValue,
      isMany: EObjectHelper.isMany,
      checkIsAbstract: EObjectHelper.isAbstract,
      checkIsInterface: EObjectHelper.isInterface,
      getEType: EObjectHelper.getEType,
      getESuperTypes: EObjectHelper.getESuperTypes,
      getEStructuralFeatures: EObjectHelper.getEStructuralFeatures,
      getEOperations: EObjectHelper.getEOperations,
      getETypeParameters: EObjectHelper.getETypeParameters,
      getEParameters: EObjectHelper.getEParameters,
      getELiterals: EObjectHelper.getELiterals,
      getEPackage: EObjectHelper.getEPackage,
      getDefaultValueLiteral: EObjectHelper.getDefaultValueLiteral,
      getLowerBound: EObjectHelper.getLowerBound,
      getUpperBound: EObjectHelper.getUpperBound,
      isContainment: EObjectHelper.isContainment,
      getEOpposite: EObjectHelper.getEOpposite,
      getExtendedMetaDataName: EObjectHelper.getExtendedMetaDataName
    };

    return template(fullData);
  }

  /**
   * Create a generated file
   */
  protected createFile(path: string, content: string): GeneratedFile {
    return new GeneratedFile(path, content, this.context.options.outputDirectory);
  }

  /**
   * Get output path for a class
   */
  protected getClassPath(genClass: GenClass, genPackage: GenPackage, suffix: string = ''): string {
    const className = genClass.implClassName ?? EObjectHelper.getName(genClass.ecoreClass) ?? 'Unknown';
    const packagePath = this.getPackagePath(genPackage);
    return join(packagePath, `${className}${suffix}.ts`);
  }

  /**
   * Get output path for an interface
   */
  protected getInterfacePath(genClass: GenClass, genPackage: GenPackage): string {
    const interfaceName = genClass.interfaceName ?? EObjectHelper.getName(genClass.ecoreClass) ?? 'Unknown';
    const packagePath = this.getPackagePath(genPackage);
    return join(packagePath, `${interfaceName}.ts`);
  }

  /**
   * Get output path for an enum
   */
  protected getEnumPath(genEnum: GenEnum, genPackage: GenPackage): string {
    const enumName = EObjectHelper.getName(genEnum.ecoreEnum) ?? 'Unknown';
    const packagePath = this.getPackagePath(genPackage);
    return join(packagePath, `${enumName}.ts`);
  }

  /**
   * Get output path for a package
   */
  protected getPackagePath(genPackage: GenPackage): string {
    const basePath = genPackage.basePackage.replace(/\./g, '/');
    return basePath;
  }
}
