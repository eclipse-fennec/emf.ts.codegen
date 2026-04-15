/**
 * Helper functions for accessing EObject properties
 * Works with both static and dynamic EObjects from emfts
 */

/**
 * Get name from ENamedElement (works with both static and dynamic EObjects)
 */
export function getName(obj: any): string | null {
  if (!obj) return null;

  // Check if it's an unresolved proxy first
  if (typeof obj.eIsProxy === 'function' && obj.eIsProxy()) {
    // For proxies, extract name from the proxy URI
    if (typeof obj.eProxyURI === 'function') {
      const proxyURI = obj.eProxyURI();
      if (proxyURI) {
        const uriStr = proxyURI.toString();
        // Parse URI like "library.ecore#//Book" to extract "Book"
        const hashIdx = uriStr.indexOf('#//');
        if (hashIdx >= 0) {
          const fragment = uriStr.substring(hashIdx + 3);
          const segments = fragment.split('/');
          return segments[segments.length - 1] || null;
        }
      }
    }
    return null;
  }

  // Try direct method first
  if (typeof obj.getName === 'function') {
    try {
      return obj.getName();
    } catch (e) {
      // getName might throw if proxy isn't resolved
    }
  }

  // Try eGet for dynamic objects
  if (typeof obj.eGet === 'function' && typeof obj.eClass === 'function') {
    try {
      const eClass = obj.eClass();
      if (eClass) {
        const nameFeature = eClass.getEStructuralFeature?.('name');
        if (nameFeature) {
          return obj.eGet(nameFeature);
        }
      }
    } catch (e) {
      // eGet might throw if proxy isn't resolved
    }
  }

  // Fallback to property access
  return obj.name ?? null;
}

/**
 * Get any feature value from an EObject
 */
export function getFeatureValue(obj: any, featureName: string): any {
  if (!obj) return undefined;

  // Try getter method first (getXxx format)
  const getterName = `get${capitalize(featureName)}`;
  if (typeof obj[getterName] === 'function') {
    return obj[getterName]();
  }

  // Try isXxx for booleans
  const isName = `is${capitalize(featureName)}`;
  if (typeof obj[isName] === 'function') {
    return obj[isName]();
  }

  // Try eGet for dynamic objects
  if (typeof obj.eGet === 'function' && typeof obj.eClass === 'function') {
    const eClass = obj.eClass();
    if (eClass) {
      const feature = eClass.getEStructuralFeature?.(featureName);
      if (feature) {
        return obj.eGet(feature);
      }
    }
  }

  // Fallback to direct property access
  return obj[featureName];
}

/**
 * Get literal from EEnumLiteral
 */
export function getLiteral(obj: any): string | null {
  if (!obj) return null;

  if (typeof obj.getLiteral === 'function') {
    return obj.getLiteral();
  }

  return getFeatureValue(obj, 'literal') ?? getName(obj);
}

/**
 * Get value from EEnumLiteral
 */
export function getValue(obj: any): number {
  if (!obj) return 0;

  if (typeof obj.getValue === 'function') {
    return obj.getValue();
  }

  const value = getFeatureValue(obj, 'value');
  return typeof value === 'number' ? value : 0;
}

/**
 * Check if a feature is many (multiplicity > 1)
 */
export function isMany(feature: any): boolean {
  if (!feature) return false;

  if (typeof feature.isMany === 'function') {
    return feature.isMany();
  }

  const upperBound = getFeatureValue(feature, 'upperBound');
  return upperBound === -1 || upperBound > 1;
}

/**
 * Check if an EClass is abstract
 */
export function isAbstract(eClass: any): boolean {
  if (!eClass) return false;

  // Check if it's a proxy - proxies don't have the abstract info
  if (typeof eClass.eIsProxy === 'function' && eClass.eIsProxy()) {
    // For proxies, we can't determine if abstract, return false
    return false;
  }

  // Try direct method first
  if (typeof eClass.isAbstract === 'function') {
    try {
      return eClass.isAbstract();
    } catch (e) {
      // Method might throw
    }
  }

  // Try eGet for dynamic objects
  const abstractValue = getFeatureValue(eClass, 'abstract');
  return abstractValue === true || abstractValue === 'true';
}

/**
 * Check if an EClass is an interface
 */
export function isInterface(eClass: any): boolean {
  if (!eClass) return false;

  // Check if it's a proxy - proxies don't have the interface info
  if (typeof eClass.eIsProxy === 'function' && eClass.eIsProxy()) {
    // For proxies, we can't determine if interface, return false
    return false;
  }

  // Try direct method first
  if (typeof eClass.isInterface === 'function') {
    try {
      return eClass.isInterface();
    } catch (e) {
      // Method might throw
    }
  }

  // Try eGet for dynamic objects
  const interfaceValue = getFeatureValue(eClass, 'interface');
  return interfaceValue === true || interfaceValue === 'true';
}

/**
 * Get the type of a structural feature
 */
export function getEType(feature: any): any {
  if (!feature) return null;

  if (typeof feature.getEType === 'function') {
    return feature.getEType();
  }

  return getFeatureValue(feature, 'eType');
}

/**
 * Get super types of an EClass
 */
export function getESuperTypes(eClass: any): any[] {
  if (!eClass) return [];

  if (typeof eClass.getESuperTypes === 'function') {
    return toArray(eClass.getESuperTypes());
  }

  return toArray(getFeatureValue(eClass, 'eSuperTypes'));
}

/**
 * Get structural features of an EClass
 */
export function getEStructuralFeatures(eClass: any): any[] {
  if (!eClass) return [];

  if (typeof eClass.getEStructuralFeatures === 'function') {
    return toArray(eClass.getEStructuralFeatures());
  }

  return toArray(getFeatureValue(eClass, 'eStructuralFeatures'));
}

/**
 * Get operations of an EClass
 */
export function getEOperations(eClass: any): any[] {
  if (!eClass) return [];

  if (typeof eClass.getEOperations === 'function') {
    return toArray(eClass.getEOperations());
  }

  return toArray(getFeatureValue(eClass, 'eOperations'));
}

/**
 * Get type parameters of an EClassifier
 */
export function getETypeParameters(classifier: any): any[] {
  if (!classifier) return [];

  if (typeof classifier.getETypeParameters === 'function') {
    return toArray(classifier.getETypeParameters());
  }

  return toArray(getFeatureValue(classifier, 'eTypeParameters'));
}

/**
 * Get parameters of an EOperation
 */
export function getEParameters(operation: any): any[] {
  if (!operation) return [];

  if (typeof operation.getEParameters === 'function') {
    return toArray(operation.getEParameters());
  }

  return toArray(getFeatureValue(operation, 'eParameters'));
}

/**
 * Get literals of an EEnum
 */
export function getELiterals(eEnum: any): any[] {
  if (!eEnum) return [];

  if (typeof eEnum.getELiterals === 'function') {
    return toArray(eEnum.getELiterals());
  }

  return toArray(getFeatureValue(eEnum, 'eLiterals'));
}

/**
 * Get the package of a classifier
 */
export function getEPackage(classifier: any): any {
  if (!classifier) return null;

  // Try direct method first
  if (typeof classifier.getEPackage === 'function') {
    return classifier.getEPackage();
  }

  // Try eGet for dynamic objects
  const pkg = getFeatureValue(classifier, 'ePackage');
  if (pkg) return pkg;

  // Try eContainer - classifiers are contained in their package
  if (typeof classifier.eContainer === 'function') {
    const container = classifier.eContainer();
    // Check if container is an EPackage (has getEClassifiers or getNsURI)
    if (container && (typeof container.getEClassifiers === 'function' ||
                      typeof container.getNsURI === 'function')) {
      return container;
    }
  }

  return null;
}

/**
 * Get default value literal of a feature
 */
export function getDefaultValueLiteral(feature: any): string | null {
  if (!feature) return null;

  if (typeof feature.getDefaultValueLiteral === 'function') {
    return feature.getDefaultValueLiteral();
  }

  return getFeatureValue(feature, 'defaultValueLiteral');
}

/**
 * Get lower bound of a feature
 */
export function getLowerBound(feature: any): number {
  if (!feature) return 0;

  if (typeof feature.getLowerBound === 'function') {
    return feature.getLowerBound();
  }

  const value = getFeatureValue(feature, 'lowerBound');
  return typeof value === 'number' ? value : 0;
}

/**
 * Get upper bound of a feature
 */
export function getUpperBound(feature: any): number {
  if (!feature) return 1;

  if (typeof feature.getUpperBound === 'function') {
    return feature.getUpperBound();
  }

  const value = getFeatureValue(feature, 'upperBound');
  return typeof value === 'number' ? value : 1;
}

/**
 * Check if feature is containment
 */
export function isContainment(feature: any): boolean {
  if (!feature) return false;

  if (typeof feature.isContainment === 'function') {
    return feature.isContainment();
  }

  return getFeatureValue(feature, 'containment') === true;
}

/**
 * Get the opposite reference
 */
export function getEOpposite(feature: any): any {
  if (!feature) return null;

  if (typeof feature.getEOpposite === 'function') {
    return feature.getEOpposite();
  }

  return getFeatureValue(feature, 'eOpposite');
}

/**
 * Get the ExtendedMetaData "name" annotation value for a model element.
 * Returns the XML serialization name if different from the model name, or null.
 */
export function getExtendedMetaDataName(element: any): string | null {
  if (!element) return null;

  const annotations = toArray(getFeatureValue(element, 'eAnnotations'));
  for (const ann of annotations) {
    const source = getFeatureValue(ann, 'source');
    if (source === 'http:///org/eclipse/emf/ecore/util/ExtendedMetaData') {
      const details = toArray(getFeatureValue(ann, 'details'));
      for (const detail of details) {
        const key = getFeatureValue(detail, 'key');
        if (key === 'name') {
          return getFeatureValue(detail, 'value');
        }
      }
    }
  }
  return null;
}

// Helper functions
function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert any list-like value (Array, EList, Iterable) to a plain JS array
 */
function toArray(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  // EList with size()/get()
  if (typeof value.size === 'function' && typeof value.get === 'function') {
    const arr = [];
    for (let i = 0; i < value.size(); i++) {
      arr.push(value.get(i));
    }
    return arr;
  }
  // EList with toArray()
  if (typeof value.toArray === 'function') {
    return value.toArray();
  }
  // Any iterable (but not string)
  if (typeof value !== 'string' && typeof value[Symbol.iterator] === 'function') {
    return Array.from(value);
  }
  return [];
}
