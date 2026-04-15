import { readFile } from 'fs/promises';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import type { EPackage, ResourceSet } from '@emfts/core';
import { getFeatureValue, getName } from '../util/EObjectHelper.js';

/**
 * Extracted model types for code generation
 */
interface ApiModel {
  baseUrl: string;
  resources: ResourceModel[];
}

interface ResourceModel {
  name: string;
  path: string;
  endpoints: EndpointModel[];
}

interface EndpointModel {
  name: string;
  path: string;
  method: string;
  produces?: string;
  consumes?: string;
  description?: string;
  responseType?: string;
  responseWrapper?: string;
  parameters: ParameterModel[];
}

interface ParameterModel {
  name: string;
  paramType: string;
  dataType: string;
  required: boolean;
}

interface RestClientGeneratorOptions {
  outputDir: string;
  verbose?: boolean;
}

/**
 * Generates TypeScript fetch clients from rest-api.ecore + XMI instance
 */
export class RestClientGenerator {
  private options: RestClientGeneratorOptions;

  constructor(options: RestClientGeneratorOptions) {
    this.options = options;
  }

  /**
   * Load the REST API metamodel and instance, then generate client code
   */
  async generate(metamodelPath: string, instancePath: string): Promise<string[]> {
    const model = await this.loadModel(metamodelPath, instancePath);
    return this.generateFiles(model);
  }

  /**
   * Load and parse the XMI model into ApiModel
   */
  private async loadModel(metamodelPath: string, instancePath: string): Promise<ApiModel> {
    const { BasicResourceSet, XMIResource, URI, getEcorePackage, ECORE_NS_URI } = await import('@emfts/core');

    // Initialize
    getEcorePackage();

    // Create resource set
    const resourceSet = new BasicResourceSet();
    resourceSet.getPackageRegistry().set(ECORE_NS_URI, getEcorePackage());

    // Load rest-api.ecore metamodel
    const metamodelContent = await readFile(metamodelPath, 'utf-8');
    const metamodelUri = URI.createURI(metamodelPath);
    const metamodelResource = new XMIResource(metamodelUri);
    metamodelResource.setResourceSet(resourceSet);
    metamodelResource.loadFromString(metamodelContent);

    const metamodelContents = metamodelResource.getContents();
    if (metamodelContents.length === 0) {
      throw new Error(`No content found in metamodel ${metamodelPath}`);
    }

    const restApiPackage = metamodelContents[0] as EPackage;
    const nsURI = restApiPackage.getNsURI();
    if (nsURI) {
      resourceSet.getPackageRegistry().set(nsURI, restApiPackage);
    }

    if (this.options.verbose) {
      console.log('Loaded REST API metamodel:', getName(restApiPackage), 'nsURI:', nsURI);
    }

    // Load nsc-api.xmi instance
    const instanceContent = await readFile(instancePath, 'utf-8');
    const instanceUri = URI.createURI(instancePath);
    const instanceResource = new XMIResource(instanceUri);
    instanceResource.setResourceSet(resourceSet);
    instanceResource.loadFromString(instanceContent);

    const instanceErrors = instanceResource.getErrors();
    if (instanceErrors.length > 0) {
      console.error('Errors loading API instance:', instanceErrors.map(e => e.message).join(', '));
    }

    const instanceContents = instanceResource.getContents();
    if (instanceContents.length === 0) {
      throw new Error(`No content found in instance ${instancePath}`);
    }

    const restApi = instanceContents[0];

    if (this.options.verbose) {
      const eClassName = getName(restApi.eClass());
      console.log('Loaded API instance, root type:', eClassName);
    }

    // Extract model data from dynamic EObjects
    return this.extractModel(restApi);
  }

  /**
   * Extract ApiModel from dynamic EObject tree
   */
  private extractModel(restApi: any): ApiModel {
    const baseUrl = getFeatureValue(restApi, 'baseUrl') || '';
    const resources = getFeatureValue(restApi, 'resources') || [];

    const resourceModels: ResourceModel[] = [];
    for (const resource of resources) {
      resourceModels.push(this.extractResource(resource));
    }

    return { baseUrl, resources: resourceModels };
  }

  private extractResource(resource: any): ResourceModel {
    const name = getFeatureValue(resource, 'name') || 'UnknownResource';
    const path = getFeatureValue(resource, 'path') || '';
    const endpoints = getFeatureValue(resource, 'endpoints') || [];

    const endpointModels: EndpointModel[] = [];
    for (const endpoint of endpoints) {
      endpointModels.push(this.extractEndpoint(endpoint));
    }

    return { name, path, endpoints: endpointModels };
  }

  private extractEndpoint(endpoint: any): EndpointModel {
    const method = getFeatureValue(endpoint, 'method');
    // Enum value: could be the literal name or an object with getName()
    let methodStr = 'GET';
    if (method !== null && method !== undefined) {
      if (typeof method === 'string') {
        methodStr = method;
      } else if (typeof method === 'object' && method !== null) {
        methodStr = getName(method) || String(method);
      } else {
        // Numeric enum value
        const methodMap: Record<number, string> = { 0: 'GET', 1: 'POST', 2: 'PUT', 3: 'DELETE' };
        methodStr = methodMap[Number(method)] || 'GET';
      }
    }

    const parameters = getFeatureValue(endpoint, 'parameters') || [];
    const paramModels: ParameterModel[] = [];
    for (const param of parameters) {
      paramModels.push(this.extractParameter(param));
    }

    return {
      name: getFeatureValue(endpoint, 'name') || 'unknown',
      path: getFeatureValue(endpoint, 'path') || '',
      method: methodStr,
      produces: getFeatureValue(endpoint, 'produces') || undefined,
      consumes: getFeatureValue(endpoint, 'consumes') || undefined,
      description: getFeatureValue(endpoint, 'description') || undefined,
      responseType: getFeatureValue(endpoint, 'responseType') || undefined,
      responseWrapper: getFeatureValue(endpoint, 'responseWrapper') || undefined,
      parameters: paramModels,
    };
  }

  private extractParameter(param: any): ParameterModel {
    const paramType = getFeatureValue(param, 'paramType');
    let paramTypeStr = 'PATH';
    if (paramType !== null && paramType !== undefined) {
      if (typeof paramType === 'string') {
        paramTypeStr = paramType;
      } else if (typeof paramType === 'object' && paramType !== null) {
        paramTypeStr = getName(paramType) || String(paramType);
      } else {
        const typeMap: Record<number, string> = { 0: 'PATH', 1: 'QUERY', 2: 'BODY' };
        paramTypeStr = typeMap[Number(paramType)] || 'PATH';
      }
    }

    return {
      name: getFeatureValue(param, 'name') || 'unknown',
      paramType: paramTypeStr,
      dataType: getFeatureValue(param, 'dataType') || 'string',
      required: getFeatureValue(param, 'required') === true,
    };
  }

  /**
   * Generate all TypeScript files
   */
  private async generateFiles(model: ApiModel): Promise<string[]> {
    const files: { path: string; content: string }[] = [];

    // Generate api-base.ts
    files.push({
      path: 'api-base.ts',
      content: this.generateApiBase(),
    });

    // Generate per-resource API classes
    for (const resource of model.resources) {
      files.push({
        path: `${resource.name}Api.ts`,
        content: this.generateResourceApi(resource),
      });
    }

    // Generate index.ts barrel export
    files.push({
      path: 'index.ts',
      content: this.generateIndex(model),
    });

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
   * Generate api-base.ts with shared utilities
   */
  private generateApiBase(): string {
    return `/*
 * This file was generated by emfts-codegen REST client generator.
 * DO NOT EDIT - changes will be overwritten.
 *
 * @generated
 */
import { XMIResource, URI, BasicResourceSet, type EPackage, type EObject } from '@emfts/core'

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const registeredPackages: Map<string, EPackage> = new Map()

/**
 * Register an EPackage for XML deserialization.
 * Call this once per model package before using the API clients.
 */
export function registerPackage(pkg: EPackage): void {
  const nsURI = pkg.getNsURI()
  if (nsURI) {
    registeredPackages.set(nsURI, pkg)
  }
}

function createResourceSet(): BasicResourceSet {
  const rs = new BasicResourceSet()
  for (const [nsURI, pkg] of registeredPackages) {
    rs.getPackageRegistry().set(nsURI, pkg)
  }
  return rs
}

/**
 * Deserialize an XML/XMI string into a single EObject.
 */
export function deserializeXml(xml: string): EObject {
  const rs = createResourceSet()
  const resource = new XMIResource(URI.createURI('response.xml'))
  resource.setResourceSet(rs)
  resource.loadFromString(xml)
  const contents = resource.getContents()
  if (contents.size() === 0) {
    throw new Error('Empty XML response')
  }
  return contents.get(0)
}

/**
 * Deserialize an XML/XMI string that contains a Response wrapper.
 * Extracts the 'data' list from the wrapper.
 */
export function deserializeXmlList(xml: string): EObject[] {
  const root = deserializeXml(xml)
  const eClass = root.eClass()
  const dataFeature = eClass.getEStructuralFeature('data')
  if (dataFeature) {
    const data = root.eGet(dataFeature)
    return Array.isArray(data) ? data : data ? [data] : []
  }
  // If no 'data' feature, return root as single-element list
  return [root]
}

/**
 * Serialize an EObject to XML/XMI string.
 */
export function serializeXml(eObject: EObject): string {
  const resource = new XMIResource(URI.createURI('request.xml'))
  resource.getContents().push(eObject)
  return resource.saveToString()
}
`;
  }

  /**
   * Generate a TypeScript API class for a REST resource
   */
  private generateResourceApi(resource: ResourceModel): string {
    const lines: string[] = [];

    // Header
    lines.push(`/*`);
    lines.push(` * This file was generated by emfts-codegen REST client generator.`);
    lines.push(` * DO NOT EDIT - changes will be overwritten.`);
    lines.push(` *`);
    lines.push(` * @generated`);
    lines.push(` */`);
    lines.push(`import type { EObject } from '@emfts/core'`);
    lines.push(`import { BASE_URL, ApiError, deserializeXml, deserializeXmlList, serializeXml } from './api-base.js'`);
    lines.push(``);

    // Class
    lines.push(`export class ${resource.name}Api {`);

    for (const endpoint of resource.endpoints) {
      lines.push(``);
      this.generateEndpointMethod(lines, resource, endpoint);
    }

    lines.push(`}`);
    lines.push(``);

    return lines.join('\n');
  }

  /**
   * Generate a single endpoint method
   */
  private generateEndpointMethod(lines: string[], resource: ResourceModel, endpoint: EndpointModel): void {
    const pathParams = endpoint.parameters.filter(p => p.paramType === 'PATH');
    const queryParams = endpoint.parameters.filter(p => p.paramType === 'QUERY');
    const bodyParam = endpoint.parameters.find(p => p.paramType === 'BODY');

    // Determine return type
    const returnType = this.getReturnType(endpoint);

    // Build method signature
    const methodParams = this.buildMethodParams(pathParams, queryParams, bodyParam);

    // JSDoc
    if (endpoint.description) {
      lines.push(`  /**`);
      lines.push(`   * ${endpoint.description}`);
      lines.push(`   */`);
    }

    lines.push(`  async ${endpoint.name}(${methodParams}): Promise<${returnType}> {`);

    // Build URL
    this.generateUrlConstruction(lines, resource, endpoint, pathParams, queryParams);

    // Build fetch options
    const needsOptions = endpoint.method !== 'GET' || bodyParam;
    if (needsOptions) {
      lines.push(`    const options: RequestInit = {`);
      lines.push(`      method: '${endpoint.method}',`);

      if (bodyParam || endpoint.consumes) {
        const contentType = endpoint.consumes || 'application/json';
        if (bodyParam && bodyParam.dataType === 'xml') {
          lines.push(`      headers: { 'Content-Type': '${contentType}' },`);
          lines.push(`      body: serializeXml(${bodyParam.name}),`);
        } else if (bodyParam && (bodyParam.dataType === 'Blob' || contentType === 'application/pdf')) {
          lines.push(`      headers: { 'Content-Type': '${contentType}' },`);
          lines.push(`      body: ${bodyParam.name},`);
        } else if (bodyParam) {
          lines.push(`      headers: { 'Content-Type': '${contentType}' },`);
          lines.push(`      body: ${bodyParam.name},`);
        }
      }

      lines.push(`    }`);
      lines.push(`    const response = await fetch(url, options)`);
    } else {
      lines.push(`    const response = await fetch(url)`);
    }

    // Error handling
    lines.push(`    if (!response.ok) {`);
    lines.push(`      throw new ApiError(response.status, await response.text())`);
    lines.push(`    }`);

    // Response handling
    this.generateResponseHandling(lines, endpoint);

    lines.push(`  }`);
  }

  /**
   * Generate URL construction code
   */
  private generateUrlConstruction(
    lines: string[],
    resource: ResourceModel,
    endpoint: EndpointModel,
    pathParams: ParameterModel[],
    queryParams: ParameterModel[],
  ): void {
    // Build path with template literals
    let fullPath = resource.path + endpoint.path;

    // Replace {param} with ${encodeURIComponent(param)}
    for (const param of pathParams) {
      fullPath = fullPath.replace(`{${param.name}}`, `\${encodeURIComponent(${param.name})}`);
    }

    if (queryParams.length === 0) {
      lines.push(`    const url = \`\${BASE_URL}${fullPath}\``);
    } else {
      lines.push(`    const params = new URLSearchParams()`);
      for (const param of queryParams) {
        if (param.dataType === 'string[]') {
          if (param.required) {
            lines.push(`    for (const v of ${param.name}) { params.append('${param.name}', v) }`);
          } else {
            lines.push(`    if (${param.name}) { for (const v of ${param.name}) { params.append('${param.name}', v) } }`);
          }
        } else {
          if (param.required) {
            lines.push(`    params.set('${param.name}', ${param.name})`);
          } else {
            lines.push(`    if (${param.name} !== undefined) { params.set('${param.name}', ${param.name}) }`);
          }
        }
      }
      lines.push(`    const query = params.toString()`);
      lines.push(`    const url = \`\${BASE_URL}${fullPath}\${query ? '?' + query : ''}\``);
    }
  }

  /**
   * Generate response handling code based on endpoint config
   */
  private generateResponseHandling(lines: string[], endpoint: EndpointModel): void {
    if (endpoint.produces === 'application/pdf') {
      // Binary response
      lines.push(`    return response.blob()`);
    } else if (endpoint.responseWrapper) {
      // Wrapped XML response (list)
      lines.push(`    if (response.status === 204) return []`);
      lines.push(`    const xml = await response.text()`);
      lines.push(`    return deserializeXmlList(xml)`);
    } else if (endpoint.responseType && endpoint.produces === 'application/xml') {
      // Direct XML response
      lines.push(`    const xml = await response.text()`);
      lines.push(`    return deserializeXml(xml)`);
    }
    // else: void return, no body handling needed
  }

  /**
   * Build method parameter string
   */
  private buildMethodParams(
    pathParams: ParameterModel[],
    queryParams: ParameterModel[],
    bodyParam?: ParameterModel,
  ): string {
    const params: string[] = [];

    for (const p of pathParams) {
      params.push(`${p.name}: ${this.mapDataType(p.dataType)}`);
    }

    for (const p of queryParams) {
      const tsType = this.mapDataType(p.dataType);
      if (p.required) {
        params.push(`${p.name}: ${tsType}`);
      } else {
        params.push(`${p.name}?: ${tsType}`);
      }
    }

    if (bodyParam) {
      const tsType = this.mapBodyType(bodyParam, undefined);
      params.push(`${bodyParam.name}: ${tsType}`);
    }

    return params.join(', ');
  }

  /**
   * Determine the TypeScript return type for an endpoint
   */
  private getReturnType(endpoint: EndpointModel): string {
    if (endpoint.produces === 'application/pdf') {
      return 'Blob';
    }
    if (endpoint.responseWrapper) {
      return 'EObject[]';
    }
    if (endpoint.responseType && endpoint.produces === 'application/xml') {
      return 'EObject';
    }
    return 'void';
  }

  /**
   * Map data type string to TypeScript type
   */
  private mapDataType(dataType: string): string {
    switch (dataType) {
      case 'string': return 'string';
      case 'string[]': return 'string[]';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'Blob': return 'Blob';
      default: return 'string';
    }
  }

  /**
   * Map body parameter type
   */
  private mapBodyType(param: ParameterModel, consumes?: string): string {
    if (param.dataType === 'Blob' || param.dataType === 'File') {
      return 'Blob';
    }
    if (param.dataType === 'xml') {
      return 'EObject';
    }
    return 'unknown';
  }

  /**
   * Generate barrel export index.ts
   */
  private generateIndex(model: ApiModel): string {
    const lines: string[] = [];

    lines.push(`/*`);
    lines.push(` * This file was generated by emfts-codegen REST client generator.`);
    lines.push(` * DO NOT EDIT - changes will be overwritten.`);
    lines.push(` *`);
    lines.push(` * @generated`);
    lines.push(` */`);
    lines.push(`export { BASE_URL, ApiError, registerPackage, deserializeXml, deserializeXmlList, serializeXml } from './api-base.js'`);

    for (const resource of model.resources) {
      lines.push(`export { ${resource.name}Api } from './${resource.name}Api.js'`);
    }

    lines.push(``);

    return lines.join('\n');
  }
}
