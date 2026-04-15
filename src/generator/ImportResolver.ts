import type { EClass, EClassifier, EPackage, EStructuralFeature, EReference, EGenericType } from 'emfts';
import type { GenPackage } from '../genmodel/GenPackage.js';
import type { GenerationMode } from '../genmodel/GenerationMode.js';

/**
 * Represents an import statement
 */
export interface ImportInfo {
  /** Name of the type to import */
  typeName: string;
  /** Path to import from (relative or package) */
  importPath: string;
  /** Whether this is a type-only import */
  isTypeOnly: boolean;
}

/**
 * Ecore primitive types that map to TypeScript built-ins (no import needed)
 */
const ECORE_PRIMITIVES = new Set([
  'EString', 'EChar', 'ECharacterObject',
  'EBoolean', 'EBooleanObject',
  'EInt', 'EIntegerObject', 'EByte', 'EByteObject',
  'EShort', 'EShortObject', 'ELong', 'ELongObject',
  'EFloat', 'EFloatObject', 'EDouble', 'EDoubleObject',
  'EBigInteger', 'EBigDecimal',
  'EDate',
  'EJavaObject', 'EJavaClass',
  'EByteArray',
  'EFeatureMapEntry', 'EEnumerator',
  'EDiagnosticChain',
  'EMap', 'EEList', 'ETreeIterator',
  'EInvocationTargetException',
  'EResource', 'EResourceSet'
]);

/**
 * Resolves imports for generated files
 */
export class ImportResolver {
  private packagePathMap: Map<string, string> = new Map();

  /**
   * Register a package with its import path
   */
  registerPackage(nsURI: string, importPath: string): void {
    this.packagePathMap.set(nsURI, importPath);
  }

  /**
   * Get all imports needed for a class
   */
  resolveImportsForClass(
    eClass: EClass,
    genPackage: GenPackage,
    mode: GenerationMode
  ): ImportInfo[] {
    const imports = new Map<string, ImportInfo>();

    // Get super types - handle both static and dynamic objects
    const superTypes = this.getSuperTypes(eClass);
    for (const superType of superTypes) {
      this.addImportForClassifier(imports, superType, eClass, genPackage);
    }

    // Get structural features - handle both static and dynamic objects
    const features = this.getStructuralFeatures(eClass);
    for (const feature of features) {
      this.addImportsForFeature(imports, feature, eClass, genPackage);
    }

    // Add mode-specific imports
    this.addModeImports(imports, mode, genPackage);

    return Array.from(imports.values());
  }

  /**
   * Get super types from EClass (handles both static and dynamic)
   */
  private getSuperTypes(eClass: any): any[] {
    if (typeof eClass.getESuperTypes === 'function') {
      return eClass.getESuperTypes() || [];
    }
    if (typeof eClass.eGet === 'function' && typeof eClass.eClass === 'function') {
      const metaClass = eClass.eClass();
      if (metaClass) {
        const feature = metaClass.getEStructuralFeature?.('eSuperTypes');
        if (feature) {
          const result = eClass.eGet(feature);
          if (Array.isArray(result)) return result;
          if (result && typeof result[Symbol.iterator] === 'function') {
            return Array.from(result);
          }
        }
      }
    }
    return [];
  }

  /**
   * Get structural features from EClass (handles both static and dynamic)
   */
  private getStructuralFeatures(eClass: any): any[] {
    if (typeof eClass.getEStructuralFeatures === 'function') {
      return eClass.getEStructuralFeatures() || [];
    }
    if (typeof eClass.eGet === 'function' && typeof eClass.eClass === 'function') {
      const metaClass = eClass.eClass();
      if (metaClass) {
        const feature = metaClass.getEStructuralFeature?.('eStructuralFeatures');
        if (feature) {
          const result = eClass.eGet(feature);
          if (Array.isArray(result)) return result;
          if (result && typeof result[Symbol.iterator] === 'function') {
            return Array.from(result);
          }
        }
      }
    }
    return [];
  }

  /**
   * Add import for a classifier if needed
   */
  private addImportForClassifier(
    imports: Map<string, ImportInfo>,
    classifier: EClassifier,
    currentClass: EClass,
    genPackage: GenPackage
  ): void {
    const name = this.getName(classifier);
    if (!name || imports.has(name)) {
      return;
    }

    // Skip Ecore primitive types (they map to TypeScript built-ins)
    if (ECORE_PRIMITIVES.has(name)) {
      return;
    }

    // Check if same class
    if (name === this.getName(currentClass)) {
      return;
    }

    // Check if it's a proxy
    if ('eIsProxy' in classifier && (classifier as any).eIsProxy()) {
      const proxyImport = this.resolveProxyImport(classifier);
      if (proxyImport) {
        // Skip primitive proxies too
        if (ECORE_PRIMITIVES.has(proxyImport.typeName)) {
          return;
        }
        imports.set(proxyImport.typeName, proxyImport);
      }
      return;
    }

    // Get the package
    let classifierPackage = this.getEPackage(classifier);

    // If package is null, check if the classifier exists in the current package
    // This handles dynamic enum types that may not have their container set
    if (!classifierPackage) {
      const currentPackage = genPackage.ecorePackage;
      // Check if a classifier with this name exists in the current package
      const classifiers = currentPackage.getEClassifiers?.() || [];
      for (const c of classifiers) {
        if (this.getName(c) === name) {
          classifierPackage = currentPackage;
          break;
        }
      }
    }

    if (!classifierPackage) {
      return;
    }

    const currentPackage = genPackage.ecorePackage;
    const importPath = this.getImportPath(classifierPackage, currentPackage, name);

    imports.set(name, {
      typeName: name,
      importPath,
      isTypeOnly: false
    });
  }

  /**
   * Add imports for a structural feature
   */
  private addImportsForFeature(
    imports: Map<string, ImportInfo>,
    feature: EStructuralFeature,
    currentClass: EClass,
    genPackage: GenPackage
  ): void {
    // Use eType - try helper method for dynamic objects
    let eType: any = null;
    if (typeof feature.getEType === 'function') {
      eType = feature.getEType();
    } else if (typeof feature.eGet === 'function' && typeof feature.eClass === 'function') {
      const eClass = feature.eClass();
      if (eClass) {
        const typeFeature = eClass.getEStructuralFeature?.('eType');
        if (typeFeature) {
          eType = feature.eGet(typeFeature);
        }
      }
    }
    if (eType) {
      this.addImportForClassifier(imports, eType, currentClass, genPackage);
    }
  }

  /**
   * Add imports for a generic type
   */
  private addImportsForGenericType(
    imports: Map<string, ImportInfo>,
    genericType: EGenericType,
    currentClass: EClass,
    genPackage: GenPackage
  ): void {
    const classifier = genericType.getEClassifier();
    if (classifier) {
      this.addImportForClassifier(imports, classifier, currentClass, genPackage);
    }

    // Process type arguments
    const typeArgs = genericType.getETypeArguments();
    if (typeArgs) {
      for (const arg of typeArgs) {
        this.addImportsForGenericType(imports, arg, currentClass, genPackage);
      }
    }
  }

  /**
   * Resolve import for a proxy object
   */
  private resolveProxyImport(classifier: EClassifier, currentPackage?: EPackage): ImportInfo | null {
    if (!('eProxyURI' in classifier)) {
      return null;
    }

    const proxyURI = (classifier as any).eProxyURI();
    if (!proxyURI) {
      return null;
    }

    const uriString = proxyURI.toString();
    if (!uriString.includes('#//')) {
      return null;
    }

    const [packageURI, typeName] = uriString.split('#//');

    // Check if the proxy refers to a type in the same file/package
    // (e.g., "library.ecore#//BookCategory" when we're generating Book)
    // In this case, use a relative import
    const isLocalFile = packageURI.endsWith('.ecore') && !packageURI.includes('/');
    if (isLocalFile) {
      return {
        typeName,
        importPath: `./${typeName}`,
        isTypeOnly: false
      };
    }

    const importPath = this.getPackageImportPath(packageURI) ?? this.uriToImportPath(packageURI);

    return {
      typeName,
      importPath,
      isTypeOnly: false
    };
  }

  /**
   * Get import path for a package
   */
  private getImportPath(
    sourcePackage: EPackage,
    currentPackage: EPackage,
    typeName: string
  ): string {
    const sourceURI = sourcePackage.getNsURI();
    const currentURI = currentPackage.getNsURI();

    // Same package - relative import
    if (sourceURI === currentURI) {
      return `./${typeName}`;
    }

    // Different package - check registered paths
    if (sourceURI && this.packagePathMap.has(sourceURI)) {
      return this.packagePathMap.get(sourceURI)!;
    }

    // Use URI as fallback
    return this.uriToImportPath(sourceURI ?? typeName);
  }

  /**
   * Get registered import path for a package URI
   */
  private getPackageImportPath(nsURI: string): string | undefined {
    return this.packagePathMap.get(nsURI);
  }

  /**
   * Convert a URI to an import path
   */
  private uriToImportPath(uri: string): string {
    // Remove protocol
    let path = uri;
    if (path.startsWith('http://')) {
      path = path.substring(7);
    } else if (path.startsWith('https://')) {
      path = path.substring(8);
    }

    // Convert to valid import path
    return path.replace(/[^a-zA-Z0-9./]/g, '-');
  }

  /**
   * Add mode-specific imports
   */
  private addModeImports(
    imports: Map<string, ImportInfo>,
    mode: GenerationMode,
    genPackage: GenPackage
  ): void {
    switch (mode) {
      case 'decorator':
        imports.set('ModelAnnotations', {
          typeName: 'Documentation, Attribute, ModelClass, Reference, Enum',
          importPath: './ModelAnnotations',
          isTypeOnly: false
        });
        break;

      case 'emf':
        imports.set('BasicEObject', {
          typeName: 'BasicEObject',
          importPath: 'emfts',
          isTypeOnly: false
        });
        imports.set('EClass', {
          typeName: 'EClass',
          importPath: 'emfts',
          isTypeOnly: true
        });
        imports.set('EStructuralFeature', {
          typeName: 'EStructuralFeature',
          importPath: 'emfts',
          isTypeOnly: true
        });
        break;

      case 'plain':
      default:
        // No additional imports for plain mode
        break;
    }
  }

  /**
   * Get name from ENamedElement (works with both static and dynamic EObjects)
   */
  private getName(obj: any): string | null {
    if (!obj) return null;
    // Try direct method first
    if (typeof obj.getName === 'function') {
      return obj.getName();
    }
    // Try eGet for dynamic objects
    if (typeof obj.eGet === 'function' && typeof obj.eClass === 'function') {
      const eClass = obj.eClass();
      if (eClass) {
        const nameFeature = eClass.getEStructuralFeature?.('name');
        if (nameFeature) {
          return obj.eGet(nameFeature);
        }
      }
    }
    // Fallback to property access
    return obj.name ?? null;
  }

  /**
   * Get the package of a classifier
   */
  private getEPackage(classifier: any): EPackage | null {
    if (!classifier) return null;
    // Try direct method first
    if (typeof classifier.getEPackage === 'function') {
      return classifier.getEPackage();
    }
    // Try eGet for dynamic objects
    if (typeof classifier.eGet === 'function' && typeof classifier.eClass === 'function') {
      const eClass = classifier.eClass();
      if (eClass) {
        const pkgFeature = eClass.getEStructuralFeature?.('ePackage');
        if (pkgFeature) {
          return classifier.eGet(pkgFeature);
        }
      }
    }
    // Try eContainer for contained objects
    if (typeof classifier.eContainer === 'function') {
      const container = classifier.eContainer();
      if (container && this.isEPackage(container)) {
        return container as EPackage;
      }
    }
    return null;
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

  /**
   * Format imports as TypeScript import statements
   */
  formatImports(imports: ImportInfo[]): string {
    // Group imports by path
    const byPath = new Map<string, ImportInfo[]>();
    for (const imp of imports) {
      const existing = byPath.get(imp.importPath) ?? [];
      existing.push(imp);
      byPath.set(imp.importPath, existing);
    }

    const lines: string[] = [];
    for (const [path, imps] of byPath) {
      const typeOnly = imps.every(i => i.isTypeOnly);
      const names = imps.map(i => i.typeName).join(', ');

      if (typeOnly) {
        lines.push(`import type { ${names} } from '${path}';`);
      } else {
        lines.push(`import { ${names} } from '${path}';`);
      }
    }

    return lines.join('\n');
  }
}
