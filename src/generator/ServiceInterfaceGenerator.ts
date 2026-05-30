import { readFile } from 'fs/promises';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { getFeatureValue, getName } from '../util/EObjectHelper.js';

/**
 * Extracted model types for service interface generation
 */
export interface ServiceInterfaceModel {
  name: string;
  version?: string;
  description?: string;
  operations: ServiceOperationModel[];
}

export interface ServiceOperationModel {
  name: string;
  description?: string;
  returnType?: string;
  parameters: ServiceParameterModel[];
}

export interface ServiceParameterModel {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
  description?: string;
  index?: number;
}

export interface ServiceInterfaceGeneratorOptions {
  outputDir: string;
  verbose?: boolean;
  /** Filter to specific interface names */
  interfaceFilter?: string[];
}

/**
 * DDSR type name → TypeScript type
 */
function mapDdsrType(type: string): string {
  switch (type) {
    case 'string':
      return 'string';
    case 'double':
    case 'float':
    case 'int':
    case 'long':
    case 'short':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
}

/**
 * Generates TypeScript interfaces from DDSR Broker Catalog (ServiceInterface definitions)
 */
export class ServiceInterfaceGenerator {
  private options: ServiceInterfaceGeneratorOptions;

  constructor(options: ServiceInterfaceGeneratorOptions) {
    this.options = options;
  }

  /**
   * Generate from a broker URL (fetches catalog XMI)
   */
  async generateFromUrl(brokerUrl: string): Promise<string[]> {
    const xmi = await this.fetchCatalog(brokerUrl);
    const interfaces = await this.parseXmi(xmi);
    return this.generateFiles(interfaces);
  }

  /**
   * Generate from a local XMI file
   */
  async generateFromFile(modelPath: string): Promise<string[]> {
    const xmi = await readFile(modelPath, 'utf-8');
    const interfaces = await this.parseXmi(xmi);
    return this.generateFiles(interfaces);
  }

  /**
   * Generate from pre-parsed interface models (for testing / programmatic use)
   */
  async generateFromModels(interfaces: ServiceInterfaceModel[]): Promise<string[]> {
    return this.generateFiles(interfaces);
  }

  /**
   * Fetch catalog XMI from broker URL
   */
  private async fetchCatalog(brokerUrl: string): Promise<string> {
    const response = await fetch(brokerUrl, {
      headers: { 'Accept': 'application/xml' }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch catalog from ${brokerUrl}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  /**
   * Parse XMI string into ServiceInterfaceModel[]
   */
  async parseXmi(xmi: string): Promise<ServiceInterfaceModel[]> {
    const { BasicResourceSet, XMIResource, URI, getEcorePackage, ECORE_NS_URI } = await import('@emfts/core');

    getEcorePackage();
    const resourceSet = new BasicResourceSet();
    resourceSet.getPackageRegistry().set(ECORE_NS_URI, getEcorePackage());

    // Try loading DDSR metamodel if available
    try {
      await this.registerDdsrMetamodel(resourceSet);
    } catch {
      // Proceed without metamodel — will parse dynamically
    }

    const resource = new XMIResource(URI.createURI('catalog.xmi'));
    resource.setResourceSet(resourceSet);
    resource.loadFromString(xmi);

    const contents = resource.getContents();
    if (contents.length === 0) {
      throw new Error('No content found in catalog XMI');
    }

    const root = contents[0];
    return this.extractInterfaces(root);
  }

  /**
   * Try to register the DDSR metamodel for proper XMI parsing
   */
  private async registerDdsrMetamodel(resourceSet: any): Promise<void> {
    // The DDSR metamodel may be available as a package
    // For now, we rely on dynamic parsing which works without a registered metamodel
  }

  /**
   * Extract ServiceInterfaceModel[] from the XMI root object
   */
  private extractInterfaces(root: any): ServiceInterfaceModel[] {
    // The root is a RemoteServiceRegistry; catalog entries are in the 'catalog' feature
    const catalogEntries = getFeatureValue(root, 'catalog') || [];
    const entries = Array.isArray(catalogEntries) ? catalogEntries : [catalogEntries];

    const interfaces: ServiceInterfaceModel[] = [];
    for (const entry of entries) {
      const iface = this.extractInterface(entry);
      if (this.options.interfaceFilter && this.options.interfaceFilter.length > 0) {
        if (!this.options.interfaceFilter.includes(iface.name)) continue;
      }
      interfaces.push(iface);
    }

    if (this.options.verbose) {
      console.log(`Found ${interfaces.length} service interface(s) in catalog`);
    }

    return interfaces;
  }

  /**
   * Extract a single ServiceInterfaceModel from a catalog entry
   */
  private extractInterface(entry: any): ServiceInterfaceModel {
    const name = getFeatureValue(entry, 'name') || getName(entry) || 'Unknown';
    const version = getFeatureValue(entry, 'version') || undefined;
    const description = getFeatureValue(entry, 'description') || undefined;
    const rawOperations = getFeatureValue(entry, 'operations') || [];
    const operations = Array.isArray(rawOperations) ? rawOperations : [rawOperations];

    const operationModels: ServiceOperationModel[] = [];
    for (const op of operations) {
      operationModels.push(this.extractOperation(op));
    }

    return { name, version, description, operations: operationModels };
  }

  /**
   * Extract a ServiceOperationModel from an operation entry
   */
  private extractOperation(op: any): ServiceOperationModel {
    const name = getFeatureValue(op, 'name') || getName(op) || 'unknown';
    const description = getFeatureValue(op, 'description') || undefined;
    const returnType = getFeatureValue(op, 'returnType') || undefined;
    const rawParams = getFeatureValue(op, 'parameters') || [];
    const params = Array.isArray(rawParams) ? rawParams : [rawParams];

    const paramModels: ServiceParameterModel[] = [];
    for (const param of params) {
      paramModels.push(this.extractParameter(param));
    }

    // Sort by index if present
    paramModels.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    return { name, description, returnType, parameters: paramModels };
  }

  /**
   * Extract a ServiceParameterModel from a parameter entry
   */
  private extractParameter(param: any): ServiceParameterModel {
    const name = getFeatureValue(param, 'name') || getName(param) || 'unknown';
    const type = getFeatureValue(param, 'type') || 'string';
    const optional = getFeatureValue(param, 'optional') === true;
    const defaultValue = getFeatureValue(param, 'defaultValue') || undefined;
    const description = getFeatureValue(param, 'description') || undefined;
    const index = getFeatureValue(param, 'index');

    return {
      name,
      type,
      optional,
      defaultValue,
      description,
      index: typeof index === 'number' ? index : undefined
    };
  }

  /**
   * Generate all TypeScript files from parsed interfaces
   */
  private async generateFiles(interfaces: ServiceInterfaceModel[]): Promise<string[]> {
    // Apply filter if set
    if (this.options.interfaceFilter && this.options.interfaceFilter.length > 0) {
      interfaces = interfaces.filter(i => this.options.interfaceFilter!.includes(i.name));
    }

    const files: { path: string; content: string }[] = [];

    for (const iface of interfaces) {
      files.push({
        path: `${iface.name}.ts`,
        content: this.generateInterface(iface),
      });
    }

    // Generate barrel index
    if (interfaces.length > 0) {
      files.push({
        path: 'index.ts',
        content: this.generateIndex(interfaces),
      });
    }

    // Write files to disk
    const writtenFiles: string[] = [];
    for (const file of files) {
      const fullPath = join(this.options.outputDir, file.path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, file.content, 'utf-8');
      writtenFiles.push(fullPath);

      if (this.options.verbose) {
        console.log('  Generated:', fullPath);
      }
    }

    return writtenFiles;
  }

  /**
   * Generate a TypeScript interface for a single ServiceInterface
   */
  generateInterface(iface: ServiceInterfaceModel): string {
    const lines: string[] = [];

    // Header
    lines.push(`/**`);
    if (iface.description) {
      lines.push(` * ${iface.name} — ${iface.description}`);
    } else {
      lines.push(` * ${iface.name}`);
    }
    if (iface.version) {
      lines.push(` * @version ${iface.version}`);
    }
    lines.push(` *`);
    lines.push(` * Generated from DDSR Broker Catalog.`);
    lines.push(` * @generated`);
    lines.push(` */`);
    lines.push(`export interface ${iface.name} {`);

    for (const op of iface.operations) {
      lines.push(this.generateMethod(op));
    }

    lines.push(`}`);
    lines.push(``);

    return lines.join('\n');
  }

  /**
   * Generate a single method signature
   */
  private generateMethod(op: ServiceOperationModel): string {
    const returnTsType = op.returnType ? mapDdsrType(op.returnType) : 'void';

    // Build params object type
    let paramsSignature: string;
    if (op.parameters.length === 0) {
      paramsSignature = '';
    } else {
      const paramFields = op.parameters.map(p => {
        const tsType = mapDdsrType(p.type);
        const opt = p.optional ? '?' : '';
        return `${p.name}${opt}: ${tsType}`;
      });
      paramsSignature = `params: { ${paramFields.join('; ')} }`;
    }

    // Build JSDoc + signature
    const parts: string[] = [];
    if (op.description) {
      parts.push(`  /** ${op.description} */`);
    }
    parts.push(`  ${op.name}(${paramsSignature}): Promise<${returnTsType}>;`);

    return parts.join('\n');
  }

  /**
   * Generate barrel index.ts
   */
  private generateIndex(interfaces: ServiceInterfaceModel[]): string {
    const lines: string[] = [];

    lines.push(`/**`);
    lines.push(` * Generated from DDSR Broker Catalog.`);
    lines.push(` * @generated`);
    lines.push(` */`);

    for (const iface of interfaces) {
      lines.push(`export type { ${iface.name} } from './${iface.name}.js';`);
    }

    lines.push(``);

    return lines.join('\n');
  }
}
