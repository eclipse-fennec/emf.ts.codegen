import { describe, it, expect, beforeEach } from 'vitest';
// @ts-ignore
// @ts-ignore
import {
  LibraryFactory,
  LibraryPackage,
  BookCategory,
  type Library,
  type Book,
  type Author,
  type Employee
} from '../examples/generated/org/example';
import { BookImpl } from '../examples/generated/org/example/BookImpl.js';
import { AuthorImpl } from '../examples/generated/org/example/AuthorImpl.js';
import { EmployeeImpl } from '../examples/generated/org/example/EmployeeImpl.js';

describe('Generated Library Model', () => {
  let factory: typeof LibraryFactory.eINSTANCE;

  beforeEach(() => {
    factory = LibraryFactory.eINSTANCE;
  });

  describe('LibraryFactory', () => {
    it('should be a singleton', () => {
      expect(LibraryFactory.eINSTANCE).toBe(LibraryFactory.eINSTANCE);
    });

    it('should create Library instances', () => {
      const library = factory.createLibrary();
      expect(library).toBeDefined();
    });

    it('should create Book instances', () => {
      const book = factory.createBook();
      expect(book).toBeDefined();
    });

    it('should create Author instances', () => {
      const author = factory.createAuthor();
      expect(author).toBeDefined();
    });

    it('should create Employee instances', () => {
      const employee = factory.createEmployee();
      expect(employee).toBeDefined();
    });
  });

  describe('LibraryPackage', () => {
    it('should be a singleton', () => {
      expect(LibraryPackage.eINSTANCE).toBe(LibraryPackage.eINSTANCE);
    });

    it('should have correct package metadata', () => {
      expect(LibraryPackage.eNAME).toBe('library');
      expect(LibraryPackage.eNS_URI).toBe('http://example.org/library');
      expect(LibraryPackage.eNS_PREFIX).toBe('lib');
    });

    it('should have Literals for all EClasses', () => {
      const pkg = LibraryPackage.eINSTANCE;
      expect(LibraryPackage.Literals.LIBRARY).toBeDefined();
      expect(LibraryPackage.Literals.BOOK).toBeDefined();
      expect(LibraryPackage.Literals.PERSON).toBeDefined();
      expect(LibraryPackage.Literals.AUTHOR).toBeDefined();
      expect(LibraryPackage.Literals.EMPLOYEE).toBeDefined();
    });

    it('should have Literals for all features', () => {
      const pkg = LibraryPackage.eINSTANCE;
      expect(LibraryPackage.Literals.LIBRARY__NAME).toBeDefined();
      expect(LibraryPackage.Literals.BOOK__TITLE).toBeDefined();
      expect(LibraryPackage.Literals.PERSON__FIRST_NAME).toBeDefined();
      expect(LibraryPackage.Literals.AUTHOR__BIOGRAPHY).toBeDefined();
      expect(LibraryPackage.Literals.EMPLOYEE__EMPLOYEE_ID).toBeDefined();
    });
  });

  describe('Library', () => {
    let library: Library;

    beforeEach(() => {
      library = factory.createLibrary();
    });

    it('should have default values for collections', () => {
      expect(library.books).toEqual([]);
      expect(library.authors).toEqual([]);
      expect(library.employees).toEqual([]);
    });

    it('should set and get name', () => {
      library.name = 'City Library';
      expect(library.name).toBe('City Library');
    });

    it('should set and get address', () => {
      library.address = '123 Main St';
      expect(library.address).toBe('123 Main St');
    });

    it('should return correct eClass', () => {
      expect(library.eClass()).toBe(LibraryPackage.Literals.LIBRARY);
    });
  });

  describe('Book', () => {
    let book: Book;

    beforeEach(() => {
      book = factory.createBook();
    });

    it('should have default values', () => {
      expect(book.title).toBe('');
      expect(book.pages).toBe(0);
      expect(book.available).toBe(true);
      expect(book.category).toBe(BookCategory.FICTION);
    });

    it('should set and get title', () => {
      book.title = 'Clean Code';
      expect(book.title).toBe('Clean Code');
    });

    it('should set and get pages', () => {
      book.pages = 464;
      expect(book.pages).toBe(464);
    });

    it('should set and get isbn', () => {
      book.isbn = '978-0132350884';
      expect(book.isbn).toBe('978-0132350884');
    });

    it('should set and get publicationYear', () => {
      book.publicationYear = 2008;
      expect(book.publicationYear).toBe(2008);
    });

    it('should set and get category', () => {
      book.category = BookCategory.SCIENCE;
      expect(book.category).toBe(BookCategory.SCIENCE);
    });

    it('should set and get available', () => {
      book.available = false;
      expect(book.available).toBe(false);
    });

    it('should return correct eClass', () => {
      expect(book.eClass()).toBe(LibraryPackage.Literals.BOOK);
    });
  });

  describe('BookCategory Enum', () => {
    it('should have all enum values', () => {
      expect(BookCategory.FICTION).toBe(0);
      expect(BookCategory.NON_FICTION).toBe(1);
      expect(BookCategory.SCIENCE).toBe(2);
      expect(BookCategory.HISTORY).toBe(3);
      expect(BookCategory.BIOGRAPHY).toBe(4);
    });
  });

  describe('Author (inheritance from Person)', () => {
    let author: Author;

    beforeEach(() => {
      author = factory.createAuthor();
    });

    it('should inherit firstName from Person', () => {
      author.firstName = 'Robert';
      expect(author.firstName).toBe('Robert');
    });

    it('should inherit lastName from Person', () => {
      author.lastName = 'Martin';
      expect(author.lastName).toBe('Martin');
    });

    it('should have own biography property', () => {
      author.biography = 'Software craftsman and author';
      expect(author.biography).toBe('Software craftsman and author');
    });

    it('should have own website property', () => {
      author.website = 'https://cleancoder.com';
      expect(author.website).toBe('https://cleancoder.com');
    });

    it('should have books collection', () => {
      expect(author.books).toEqual([]);
    });

    it('should return correct eClass', () => {
      expect(author.eClass()).toBe(LibraryPackage.Literals.AUTHOR);
    });
  });

  describe('Employee (inheritance from Person)', () => {
    let employee: Employee;

    beforeEach(() => {
      employee = factory.createEmployee();
    });

    it('should inherit firstName from Person', () => {
      employee.firstName = 'Jane';
      expect(employee.firstName).toBe('Jane');
    });

    it('should inherit lastName from Person', () => {
      employee.lastName = 'Doe';
      expect(employee.lastName).toBe('Doe');
    });

    it('should have own employeeId property', () => {
      employee.employeeId = 'EMP001';
      expect(employee.employeeId).toBe('EMP001');
    });

    it('should have own salary property', () => {
      employee.salary = 50000;
      expect(employee.salary).toBe(50000);
    });

    it('should return correct eClass', () => {
      expect(employee.eClass()).toBe(LibraryPackage.Literals.EMPLOYEE);
    });
  });

  describe('Reflective API (eGet/eSet)', () => {
    let book: Book;

    beforeEach(() => {
      book = factory.createBook();
    });

    it('should get title via eGet', () => {
      book.title = 'Test Book';
      const value = book.eGet(LibraryPackage.Literals.BOOK__TITLE);
      expect(value).toBe('Test Book');
    });

    it('should set title via eSet', () => {
      book.eSet(LibraryPackage.Literals.BOOK__TITLE, 'Reflective Book');
      expect(book.title).toBe('Reflective Book');
    });

    it('should get pages via eGet', () => {
      book.pages = 200;
      const value = book.eGet(LibraryPackage.Literals.BOOK__PAGES);
      expect(value).toBe(200);
    });

    it('should set pages via eSet', () => {
      book.eSet(LibraryPackage.Literals.BOOK__PAGES, 300);
      expect(book.pages).toBe(300);
    });

    it('should get category via eGet', () => {
      book.category = BookCategory.HISTORY;
      const value = book.eGet(LibraryPackage.Literals.BOOK__CATEGORY);
      expect(value).toBe(BookCategory.HISTORY);
    });

    it('should set category via eSet', () => {
      book.eSet(LibraryPackage.Literals.BOOK__CATEGORY, BookCategory.BIOGRAPHY);
      expect(book.category).toBe(BookCategory.BIOGRAPHY);
    });
  });

  describe('Reflective API (eIsSet/eUnset)', () => {
    let book: Book;

    beforeEach(() => {
      book = factory.createBook();
    });

    it('should return true for eIsSet when title differs from default', () => {
      book.title = 'Some Title';
      expect(book.eIsSet(LibraryPackage.Literals.BOOK__TITLE)).toBe(true);
    });

    it('should return false for eIsSet when title is default', () => {
      expect(book.eIsSet(LibraryPackage.Literals.BOOK__TITLE)).toBe(false);
    });

    it('should return true for eIsSet when pages differs from default', () => {
      book.pages = 100;
      expect(book.eIsSet(LibraryPackage.Literals.BOOK__PAGES)).toBe(true);
    });

    it('should return false for eIsSet when pages is default', () => {
      expect(book.eIsSet(LibraryPackage.Literals.BOOK__PAGES)).toBe(false);
    });

    it('should reset title to default via eUnset', () => {
      book.title = 'Some Title';
      book.eUnset(LibraryPackage.Literals.BOOK__TITLE);
      expect(book.title).toBe('');
    });

    it('should reset pages to default via eUnset', () => {
      book.pages = 100;
      book.eUnset(LibraryPackage.Literals.BOOK__PAGES);
      expect(book.pages).toBe(0);
    });

    it('should reset category to default via eUnset', () => {
      book.category = BookCategory.SCIENCE;
      book.eUnset(LibraryPackage.Literals.BOOK__CATEGORY);
      expect(book.category).toBe(BookCategory.FICTION);
    });

    it('should reset available to default via eUnset', () => {
      book.available = false;
      book.eUnset(LibraryPackage.Literals.BOOK__AVAILABLE);
      expect(book.available).toBe(true);
    });
  });

  describe('References', () => {
    it('should set author on book', () => {
      const book = factory.createBook();
      const author = factory.createAuthor();
      author.firstName = 'John';
      author.lastName = 'Doe';

      book.author = author;
      expect(book.author).toBe(author);
      expect(book.author.firstName).toBe('John');
    });

    it('should set library on book', () => {
      const book = factory.createBook();
      const library = factory.createLibrary();
      library.name = 'Main Library';

      book.library = library;
      expect(book.library).toBe(library);
      expect(book.library.name).toBe('Main Library');
    });

    it('should add books to library', () => {
      const library = factory.createLibrary();
      const book1 = factory.createBook();
      book1.title = 'Book 1';
      const book2 = factory.createBook();
      book2.title = 'Book 2';

      library.books.push(book1, book2);
      expect(library.books.length).toBe(2);
      expect(library.books[0].title).toBe('Book 1');
      expect(library.books[1].title).toBe('Book 2');
    });

    it('should add authors to library', () => {
      const library = factory.createLibrary();
      const author = factory.createAuthor();
      author.firstName = 'Jane';
      author.lastName = 'Smith';

      library.authors.push(author);
      expect(library.authors.length).toBe(1);
      expect(library.authors[0].firstName).toBe('Jane');
    });

    it('should set supervisor on employee', () => {
      const employee = factory.createEmployee();
      const supervisor = factory.createEmployee();
      supervisor.firstName = 'Boss';
      supervisor.employeeId = 'MGR001';

      employee.supervisor = supervisor;
      expect(employee.supervisor).toBe(supervisor);
      expect(employee.supervisor.firstName).toBe('Boss');
    });
  });

  describe('Feature ID Constants', () => {
    it('should have correct feature IDs on BookImpl', () => {
      expect(BookImpl.TITLE).toBe(0);
      expect(BookImpl.ISBN).toBe(1);
      expect(BookImpl.PAGES).toBe(2);
      expect(BookImpl.PUBLICATION_YEAR).toBe(3);
      expect(BookImpl.CATEGORY).toBe(4);
      expect(BookImpl.AVAILABLE).toBe(5);
      expect(BookImpl.AUTHOR).toBe(6);
      expect(BookImpl.LIBRARY).toBe(7);
    });

    it('should have correct feature IDs on AuthorImpl', () => {
      expect(AuthorImpl.BIOGRAPHY).toBe(0);
      expect(AuthorImpl.WEBSITE).toBe(1);
      expect(AuthorImpl.BOOKS).toBe(2);
    });

    it('should have correct feature IDs on EmployeeImpl', () => {
      expect(EmployeeImpl.EMPLOYEE_ID).toBe(0);
      expect(EmployeeImpl.SALARY).toBe(1);
      expect(EmployeeImpl.HIRE_DATE).toBe(2);
      expect(EmployeeImpl.SUPERVISOR).toBe(3);
    });
  });

  describe('Full Library Model Scenario', () => {
    it('should create a complete library with books, authors, and employees', () => {
      // Create library
      const library = factory.createLibrary();
      library.name = 'Central Public Library';
      library.address = '100 Library Ave';

      // Create authors
      const author1 = factory.createAuthor();
      author1.firstName = 'Robert';
      author1.lastName = 'Martin';
      author1.biography = 'Software engineering expert';
      author1.website = 'https://cleancoder.com';

      const author2 = factory.createAuthor();
      author2.firstName = 'Martin';
      author2.lastName = 'Fowler';
      author2.biography = 'Chief scientist at Thoughtworks';

      // Create books
      const book1 = factory.createBook();
      book1.title = 'Clean Code';
      book1.isbn = '978-0132350884';
      book1.pages = 464;
      book1.publicationYear = 2008;
      book1.category = BookCategory.SCIENCE;
      book1.author = author1;
      book1.library = library;

      const book2 = factory.createBook();
      book2.title = 'Refactoring';
      book2.isbn = '978-0134757599';
      book2.pages = 448;
      book2.publicationYear = 2018;
      book2.category = BookCategory.SCIENCE;
      book2.author = author2;
      book2.library = library;

      // Create employees
      const manager = factory.createEmployee();
      manager.firstName = 'Alice';
      manager.lastName = 'Johnson';
      manager.employeeId = 'MGR001';
      manager.salary = 75000;

      const librarian = factory.createEmployee();
      librarian.firstName = 'Bob';
      librarian.lastName = 'Smith';
      librarian.employeeId = 'EMP002';
      librarian.salary = 45000;
      librarian.supervisor = manager;

      // Add to library
      library.authors.push(author1, author2);
      library.books.push(book1, book2);
      library.employees.push(manager, librarian);

      // Verify
      expect(library.name).toBe('Central Public Library');
      expect(library.books.length).toBe(2);
      expect(library.authors.length).toBe(2);
      expect(library.employees.length).toBe(2);

      expect(library.books[0].author.firstName).toBe('Robert');
      expect(library.books[1].author.firstName).toBe('Martin');
      expect(library.employees[1].supervisor?.firstName).toBe('Alice');
    });
  });
});
