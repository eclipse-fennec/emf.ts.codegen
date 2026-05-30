import { describe, it, expect } from 'vitest';
import { ServiceInterfaceGenerator } from '../src/generator/ServiceInterfaceGenerator.js';
import type { ServiceInterfaceModel } from '../src/generator/ServiceInterfaceGenerator.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Tests for ServiceInterfaceGenerator (Issue #8)
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/8
 */
describe('ServiceInterfaceGenerator', () => {

  describe('generateInterface (unit)', () => {
    const generator = new ServiceInterfaceGenerator({ outputDir: '/tmp/test' });

    it('should generate a basic interface with operations', () => {
      const model: ServiceInterfaceModel = {
        name: 'Payment',
        version: '1.0.0',
        description: 'Payment processing service',
        operations: [
          {
            name: 'charge',
            description: 'Charge an amount.',
            returnType: 'double',
            parameters: [
              { name: 'amount', type: 'double', optional: false },
              { name: 'currency', type: 'string', optional: true, defaultValue: 'EUR' },
            ],
          },
          {
            name: 'getBalance',
            returnType: 'double',
            parameters: [
              { name: 'accountId', type: 'string', optional: false },
            ],
          },
        ],
      };

      const result = generator.generateInterface(model);

      expect(result).toContain('export interface Payment {');
      expect(result).toContain('Payment — Payment processing service');
      expect(result).toContain('@version 1.0.0');
      expect(result).toContain('@generated');
    });

    it('should map DDSR types to TypeScript types', () => {
      const model: ServiceInterfaceModel = {
        name: 'TypeTest',
        operations: [
          {
            name: 'op1',
            returnType: 'double',
            parameters: [
              { name: 'a', type: 'string', optional: false },
              { name: 'b', type: 'double', optional: false },
              { name: 'c', type: 'float', optional: false },
              { name: 'd', type: 'int', optional: false },
              { name: 'e', type: 'long', optional: false },
              { name: 'f', type: 'short', optional: false },
              { name: 'g', type: 'boolean', optional: false },
              { name: 'h', type: 'SomeUnknown', optional: false },
            ],
          },
        ],
      };

      const result = generator.generateInterface(model);

      expect(result).toContain('a: string');
      expect(result).toContain('b: number');
      expect(result).toContain('c: number');
      expect(result).toContain('d: number');
      expect(result).toContain('e: number');
      expect(result).toContain('f: number');
      expect(result).toContain('g: boolean');
      expect(result).toContain('h: string'); // fallback
      expect(result).toContain('Promise<number>');
    });

    it('should mark optional parameters with ?', () => {
      const model: ServiceInterfaceModel = {
        name: 'OptTest',
        operations: [
          {
            name: 'doSomething',
            returnType: 'string',
            parameters: [
              { name: 'required', type: 'string', optional: false },
              { name: 'optional', type: 'int', optional: true },
            ],
          },
        ],
      };

      const result = generator.generateInterface(model);

      expect(result).toContain('required: string');
      expect(result).toContain('optional?: number');
    });

    it('should use Promise<void> for operations without return type', () => {
      const model: ServiceInterfaceModel = {
        name: 'VoidTest',
        operations: [
          {
            name: 'clearAll',
            parameters: [],
          },
        ],
      };

      const result = generator.generateInterface(model);

      expect(result).toContain('clearAll(): Promise<void>');
    });

    it('should use params object pattern for parameters', () => {
      const model: ServiceInterfaceModel = {
        name: 'ParamTest',
        operations: [
          {
            name: 'charge',
            returnType: 'double',
            parameters: [
              { name: 'amount', type: 'double', optional: false },
              { name: 'currency', type: 'string', optional: true },
            ],
          },
        ],
      };

      const result = generator.generateInterface(model);

      expect(result).toContain('charge(params: { amount: number; currency?: string }): Promise<number>');
    });

    it('should handle operations with no parameters', () => {
      const model: ServiceInterfaceModel = {
        name: 'NoParamTest',
        operations: [
          {
            name: 'ping',
            returnType: 'boolean',
            parameters: [],
          },
        ],
      };

      const result = generator.generateInterface(model);

      expect(result).toContain('ping(): Promise<boolean>');
    });

    it('should include operation descriptions as JSDoc', () => {
      const model: ServiceInterfaceModel = {
        name: 'DocTest',
        operations: [
          {
            name: 'doWork',
            description: 'Does important work.',
            returnType: 'string',
            parameters: [],
          },
        ],
      };

      const result = generator.generateInterface(model);

      expect(result).toContain('/** Does important work. */');
    });
  });

  describe('generateFromModels (integration)', () => {
    it('should write files to disk and generate index', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emfts-svc-test-'));

      try {
        const generator = new ServiceInterfaceGenerator({ outputDir: tempDir });

        const models: ServiceInterfaceModel[] = [
          {
            name: 'Payment',
            version: '1.0.0',
            description: 'Payment processing',
            operations: [
              {
                name: 'charge',
                returnType: 'double',
                parameters: [
                  { name: 'amount', type: 'double', optional: false },
                ],
              },
            ],
          },
          {
            name: 'Inventory',
            operations: [
              {
                name: 'getStock',
                returnType: 'int',
                parameters: [
                  { name: 'productId', type: 'string', optional: false },
                ],
              },
            ],
          },
        ];

        const files = await generator.generateFromModels(models);

        expect(files).toHaveLength(3); // Payment.ts, Inventory.ts, index.ts

        // Check Payment.ts
        const paymentContent = fs.readFileSync(path.join(tempDir, 'Payment.ts'), 'utf-8');
        expect(paymentContent).toContain('export interface Payment');
        expect(paymentContent).toContain('charge(params: { amount: number }): Promise<number>');

        // Check Inventory.ts
        const inventoryContent = fs.readFileSync(path.join(tempDir, 'Inventory.ts'), 'utf-8');
        expect(inventoryContent).toContain('export interface Inventory');

        // Check index.ts
        const indexContent = fs.readFileSync(path.join(tempDir, 'index.ts'), 'utf-8');
        expect(indexContent).toContain("export type { Payment }");
        expect(indexContent).toContain("export type { Inventory }");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should filter interfaces by name', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emfts-svc-filter-'));

      try {
        const generator = new ServiceInterfaceGenerator({
          outputDir: tempDir,
          interfaceFilter: ['Payment'],
        });

        const models: ServiceInterfaceModel[] = [
          { name: 'Payment', operations: [{ name: 'charge', returnType: 'double', parameters: [] }] },
          { name: 'Inventory', operations: [{ name: 'getStock', returnType: 'int', parameters: [] }] },
        ];

        const files = await generator.generateFromModels(models);

        // Should only generate Payment.ts + index.ts (not Inventory.ts)
        expect(files).toHaveLength(2);
        expect(files.some(f => f.includes('Payment.ts'))).toBe(true);
        expect(files.some(f => f.includes('Inventory.ts'))).toBe(false);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('generateInterface output matches issue example', () => {
    it('should match the Payment example from issue #8', () => {
      const generator = new ServiceInterfaceGenerator({ outputDir: '/tmp/test' });

      const model: ServiceInterfaceModel = {
        name: 'Payment',
        version: '1.0.0',
        description: 'Payment processing service',
        operations: [
          {
            name: 'charge',
            description: 'Charge an amount.',
            returnType: 'double',
            parameters: [
              { name: 'amount', type: 'double', optional: false, description: 'Amount to charge.' },
              { name: 'currency', type: 'string', optional: true, defaultValue: 'EUR', index: 1 },
            ],
          },
          {
            name: 'getBalance',
            returnType: 'double',
            parameters: [
              { name: 'accountId', type: 'string', optional: false },
            ],
          },
        ],
      };

      const result = generator.generateInterface(model);

      // Verify structure matches the expected output from issue #8
      expect(result).toContain('export interface Payment {');
      expect(result).toContain('/** Charge an amount. */');
      expect(result).toContain('charge(params: { amount: number; currency?: string }): Promise<number>;');
      expect(result).toContain('getBalance(params: { accountId: string }): Promise<number>;');
      expect(result).toContain('}');
    });
  });
});
