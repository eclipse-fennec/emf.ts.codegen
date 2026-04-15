import { readFile } from 'fs/promises';
import type { EPackage, Resource, ResourceSet } from '@emfts/core';

/**
 * Loads Ecore models using emfts
 */
export class EcoreLoader {
  private resourceSet: ResourceSet | null = null;
  private loadedPackages: Map<string, EPackage> = new Map();

  /**
   * Initialize with a resource set
   */
  async init(): Promise<void> {
    const { BasicResourceSet, getEcorePackage, ECORE_NS_URI } = await import('@emfts/core');

    // Initialize EcorePackage
    getEcorePackage();

    // Create resource set
    this.resourceSet = new BasicResourceSet();

    // Register EcorePackage
    this.resourceSet.getPackageRegistry().set(ECORE_NS_URI, getEcorePackage());
  }

  /**
   * Load an Ecore model from file
   */
  async load(ecorePath: string): Promise<EPackage> {
    if (!this.resourceSet) {
      await this.init();
    }

    const { XMIResource, URI } = await import('@emfts/core');

    // Read file content
    const content = await readFile(ecorePath, 'utf-8');

    // Create URI and resource
    const uri = URI.createURI(ecorePath);
    const resource = new XMIResource(uri);

    // Set resource set before loading
    resource.setResourceSet(this.resourceSet!);

    // Load from string
    resource.loadFromString(content);

    // Check for errors
    const errors = resource.getErrors();
    if (errors.length > 0) {
      console.error('Errors loading Ecore:', errors.map(e => e.message).join(', '));
    }

    // Get root package
    const contents = resource.getContents();
    if (contents.length === 0) {
      throw new Error(`No content found in ${ecorePath}`);
    }

    const root = contents[0];
    if (!this.isEPackage(root)) {
      throw new Error(`Root element is not an EPackage in ${ecorePath}`);
    }

    const ePackage = root as EPackage;
    const nsURI = ePackage.getNsURI();
    if (nsURI) {
      this.loadedPackages.set(nsURI, ePackage);

      // Register in resource set's registry
      this.resourceSet!.getPackageRegistry().set(nsURI, ePackage);
    }

    return ePackage;
  }

  /**
   * Load multiple Ecore models
   */
  async loadAll(ecorePaths: string[]): Promise<Map<string, EPackage>> {
    for (const path of ecorePaths) {
      await this.load(path);
    }
    return new Map(this.loadedPackages);
  }

  /**
   * Get a loaded package by nsURI
   */
  getPackage(nsURI: string): EPackage | undefined {
    return this.loadedPackages.get(nsURI);
  }

  /**
   * Get all loaded packages
   */
  getAllPackages(): Map<string, EPackage> {
    return new Map(this.loadedPackages);
  }

  /**
   * Check if an object is an EPackage
   */
  private isEPackage(obj: unknown): obj is EPackage {
    return obj !== null &&
      typeof obj === 'object' &&
      'getEClassifiers' in obj &&
      'getNsURI' in obj;
  }
}
