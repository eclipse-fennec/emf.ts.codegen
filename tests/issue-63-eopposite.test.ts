import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { generateInMemory } from '../src/index.js';
import { generateGenConfigXMI } from '../src/cli/commands/init.js';

/**
 * Tests for GitHub issue #63: eOpposite was wired into the metadata (#59) but
 * never maintained by the generated Impl - changing one end of a bidirectional
 * reference left the other end stale. This generates the cardinality matrix
 * (single-single, many-many, containment-single) into a temp directory inside
 * the repo and exercises the real generated classes; the library example in
 * generated-library.test.ts covers single-many and many-containment-single.
 *
 * @see https://github.com/eclipse-fennec/emf.ts.codegen/issues/63
 */
describe('Issue #63: eOpposite maintenance across all cardinalities', () => {
  const outDir = path.resolve(__dirname, '.generated-tmp/opposite');
  let factory: any;

  beforeAll(async () => {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'issue-63-'));
    try {
      const configPath = path.join(tmpDir, 'links.genconfig.xmi');
      await writeFile(configPath, generateGenConfigXMI(
        'http://example.org/links', 'emf', './generated', 'Links', 'org.example'
      ), 'utf-8');
      const result = await generateInMemory({
        ecorePath: path.resolve(__dirname, 'fixtures/opposite-model.ecore'),
        configPath
      });
      expect(result.success).toBe(true);
      for (const file of result.files) {
        const target = path.join(outDir, file.path);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.content, 'utf-8');
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
    const mod = await import(pathToFileURL(path.join(outDir, 'org/example/LinksFactory.ts')).href);
    factory = mod.LinksFactory.eINSTANCE;
  });

  afterAll(async () => {
    await rm(path.resolve(__dirname, '.generated-tmp'), { recursive: true, force: true });
  });

  describe('single <-> single', () => {
    it('setting one end sets the other', () => {
      const husband = factory.createHusband();
      const wife = factory.createWife();
      husband.wife = wife;
      expect(wife.husband).toBe(husband);
    });

    it('setting the other end works symmetrically', () => {
      const husband = factory.createHusband();
      const wife = factory.createWife();
      wife.husband = husband;
      expect(husband.wife).toBe(wife);
    });

    it('replacing the partner releases the previous one', () => {
      const husband = factory.createHusband();
      const first = factory.createWife();
      const second = factory.createWife();
      husband.wife = first;
      husband.wife = second;
      expect(first.husband).toBeUndefined();
      expect(second.husband).toBe(husband);
    });

    it('taking over a partner releases the partner\'s previous partner', () => {
      const first = factory.createHusband();
      const second = factory.createHusband();
      const wife = factory.createWife();
      first.wife = wife;
      second.wife = wife;
      expect(first.wife).toBeUndefined();
      expect(wife.husband).toBe(second);
    });

    it('clearing and eUnset release the other end', () => {
      const husband = factory.createHusband();
      const wife = factory.createWife();
      husband.wife = wife;
      husband.wife = undefined;
      expect(wife.husband).toBeUndefined();

      husband.wife = wife;
      husband.eUnset(husband.eClass().getEStructuralFeature('wife'));
      expect(wife.husband).toBeUndefined();
      expect(husband.wife).toBeUndefined();
    });
  });

  describe('many <-> many', () => {
    it('adding on one side adds on the other', () => {
      const student = factory.createStudent();
      const course = factory.createCourse();
      student.courses.add(course);
      expect(course.students.contains(student)).toBe(true);
      expect(student.courses.size()).toBe(1);
      expect(course.students.size()).toBe(1);
    });

    it('works symmetrically from the other side', () => {
      const student = factory.createStudent();
      const course = factory.createCourse();
      course.students.add(student);
      expect(student.courses.contains(course)).toBe(true);
    });

    it('removing on one side removes on the other', () => {
      const student = factory.createStudent();
      const course = factory.createCourse();
      student.courses.add(course);
      student.courses.remove(course);
      expect(course.students.size()).toBe(0);
    });

    it('clearing releases every counterpart', () => {
      const course = factory.createCourse();
      const students = [factory.createStudent(), factory.createStudent()];
      students.forEach(s => course.students.add(s));
      course.students.clear();
      expect(students.every(s => s.courses.size() === 0)).toBe(true);
    });

    it('adding twice does not duplicate on either side', () => {
      const student = factory.createStudent();
      const course = factory.createCourse();
      student.courses.add(course);
      student.courses.add(course);
      expect(student.courses.size()).toBe(1);
      expect(course.students.size()).toBe(1);
    });
  });

  describe('single containment <-> single back reference', () => {
    it('containing an item sets both the container and the back reference', () => {
      const owner = factory.createOwner();
      const item = factory.createItem();
      owner.item = item;
      expect(item.owner).toBe(owner);
      expect(item.eContainer()).toBe(owner);
    });

    it('moving the item to another owner releases the first one completely', () => {
      const first = factory.createOwner();
      const second = factory.createOwner();
      const item = factory.createItem();
      first.item = item;
      second.item = item;
      expect(first.item).toBeUndefined();
      expect(item.owner).toBe(second);
      expect(item.eContainer()).toBe(second);
    });

    it('replacing the item releases the previous one', () => {
      const owner = factory.createOwner();
      const first = factory.createItem();
      const second = factory.createItem();
      owner.item = first;
      owner.item = second;
      expect(first.owner).toBeUndefined();
      expect(first.eContainer() ?? null).toBeNull();
      expect(second.owner).toBe(owner);
    });

    it('setting the back reference side contains the item', () => {
      const owner = factory.createOwner();
      const item = factory.createItem();
      item.owner = owner;
      expect(owner.item).toBe(item);
      expect(item.eContainer()).toBe(owner);
    });

    it('assigning an owner through the back reference releases the previous owner and item', () => {
      const first = factory.createOwner();
      const second = factory.createOwner();
      const item = factory.createItem();
      const displaced = factory.createItem();
      first.item = item;
      second.item = displaced;
      item.owner = second;
      expect(first.item).toBeUndefined();
      expect(second.item).toBe(item);
      expect(item.eContainer()).toBe(second);
      expect(displaced.owner).toBeUndefined();
      expect(displaced.eContainer() ?? null).toBeNull();
    });
  });
});
