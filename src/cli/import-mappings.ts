/**
 * Parse import mappings (nsURI=importPath) from CLI arguments
 */
export function parseImportMappings(mappings?: string[]): Map<string, string> {
  const referencedPackages = new Map<string, string>();
  for (const mapping of mappings ?? []) {
    const eqIdx = mapping.indexOf('=');
    if (eqIdx === -1) {
      console.warn(`[WARN] Invalid import mapping (expected nsURI=importPath): ${mapping}`);
      continue;
    }
    referencedPackages.set(mapping.substring(0, eqIdx), mapping.substring(eqIdx + 1));
  }
  return referencedPackages;
}
