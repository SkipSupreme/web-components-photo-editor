/**
 * Simple Test Runner - Browser-based testing without dependencies
 * Runs all tests and reports results
 */

class TestRunner {
  constructor() {
    this.suites = [];
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Define a test suite
   */
  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      beforeEach: null,
      afterEach: null
    };
    this.currentSuite = suite;
    fn();
    this.suites.push(suite);
    this.currentSuite = null;
  }

  /**
   * Define a test
   */
  it(description, fn) {
    if (this.currentSuite) {
      this.currentSuite.tests.push({ description, fn });
    }
  }

  /**
   * Set up before each test
   */
  beforeEach(fn) {
    if (this.currentSuite) {
      this.currentSuite.beforeEach = fn;
    }
  }

  /**
   * Clean up after each test
   */
  afterEach(fn) {
    if (this.currentSuite) {
      this.currentSuite.afterEach = fn;
    }
  }

  /**
   * Run all tests
   */
  async run() {
    console.log('\n========================================');
    console.log('  RUNNING TESTS');
    console.log('========================================\n');

    for (const suite of this.suites) {
      console.log(`\n📦 ${suite.name}`);
      console.log('─'.repeat(40));

      for (const test of suite.tests) {
        try {
          if (suite.beforeEach) await suite.beforeEach();
          await test.fn();
          if (suite.afterEach) await suite.afterEach();

          console.log(`  ✅ ${test.description}`);
          this.results.passed++;
        } catch (error) {
          console.log(`  ❌ ${test.description}`);
          console.log(`     Error: ${error.message}`);
          this.results.failed++;
          this.results.errors.push({
            suite: suite.name,
            test: test.description,
            error: error.message,
            stack: error.stack
          });
        }
      }
    }

    this.printSummary();
    return this.results;
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n========================================');
    console.log('  TEST SUMMARY');
    console.log('========================================');
    console.log(`  Total:  ${this.results.passed + this.results.failed}`);
    console.log(`  Passed: ${this.results.passed}`);
    console.log(`  Failed: ${this.results.failed}`);
    console.log('========================================\n');

    if (this.results.errors.length > 0) {
      console.log('\n🔴 FAILED TESTS:\n');
      for (const err of this.results.errors) {
        console.log(`  ${err.suite} > ${err.test}`);
        console.log(`    ${err.error}\n`);
      }
    }
  }
}

/**
 * Assertion helpers
 */
const assert = {
  equal(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message} Expected ${expected}, got ${actual}`);
    }
  },

  deepEqual(actual, expected, message = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${message} Objects not equal`);
    }
  },

  true(value, message = '') {
    if (value !== true) {
      throw new Error(`${message} Expected true, got ${value}`);
    }
  },

  false(value, message = '') {
    if (value !== false) {
      throw new Error(`${message} Expected false, got ${value}`);
    }
  },

  exists(value, message = '') {
    if (value === null || value === undefined) {
      throw new Error(`${message} Expected value to exist`);
    }
  },

  notExists(value, message = '') {
    if (value !== null && value !== undefined) {
      throw new Error(`${message} Expected value to not exist`);
    }
  },

  throws(fn, message = '') {
    let threw = false;
    try {
      fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(`${message} Expected function to throw`);
    }
  },

  async asyncThrows(fn, message = '') {
    let threw = false;
    try {
      await fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(`${message} Expected async function to throw`);
    }
  },

  instanceOf(value, constructor, message = '') {
    if (!(value instanceof constructor)) {
      throw new Error(`${message} Expected instance of ${constructor.name}`);
    }
  },

  typeOf(value, type, message = '') {
    if (typeof value !== type) {
      throw new Error(`${message} Expected type ${type}, got ${typeof value}`);
    }
  },

  greaterThan(actual, expected, message = '') {
    if (actual <= expected) {
      throw new Error(`${message} Expected ${actual} > ${expected}`);
    }
  },

  lessThan(actual, expected, message = '') {
    if (actual >= expected) {
      throw new Error(`${message} Expected ${actual} < ${expected}`);
    }
  },

  contains(array, item, message = '') {
    if (!array.includes(item)) {
      throw new Error(`${message} Array does not contain item`);
    }
  },

  hasProperty(obj, prop, message = '') {
    if (!(prop in obj)) {
      throw new Error(`${message} Object missing property: ${prop}`);
    }
  }
};

// Export for use
window.TestRunner = TestRunner;
window.assert = assert;

export { TestRunner, assert };
