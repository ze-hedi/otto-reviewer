/**
 * Test script for tool execution functionality
 * 
 * Tests:
 * 1. ToolExecutor - parsing and executing functions
 * 2. Database integration - CRUD with executionFunction
 * 3. Sample tools from seed script
 */

const { ToolExecutor } = require('../runtime/tool-executor');
const { connect, disconnect, ToolSchema } = require('../database/index');

// Test colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function logTest(name) {
  console.log(`\n${BLUE}Testing: ${name}${RESET}`);
}

function logPass(msg) {
  log(`  ✓ ${msg}`, GREEN);
}

function logFail(msg) {
  log(`  ✗ ${msg}`, RED);
}

// Test counter
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    logPass(message);
    passed++;
  } else {
    logFail(message);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function testToolExecutor() {
  log('\n════════════════════════════════════════════════════', YELLOW);
  log('  Tool Executor Tests', YELLOW);
  log('════════════════════════════════════════════════════', YELLOW);

  // Test 1: Parse simple function
  logTest('Parse simple return function');
  try {
    const fn = ToolExecutor.parseFunction('return params.value * 2;');
    assert(typeof fn === 'function', 'Function parsed successfully');
  } catch (err) {
    logFail(`Failed to parse function: ${err.message}`);
    failed++;
  }

  // Test 2: Execute addition function
  logTest('Execute addition function');
  try {
    const functionString = 'return { result: params.a + params.b };';
    const result = await ToolExecutor.executeFunction(functionString, { a: 5, b: 3 });
    assert(result.details.result === 8, 'Addition result is correct (5 + 3 = 8)');
    assert(result.content[0].type === 'text', 'Result has text content');
  } catch (err) {
    logFail(`Execution failed: ${err.message}`);
    failed++;
  }

  // Test 3: Execute async function
  logTest('Execute async function with Promise');
  try {
    const functionString = `
      return new Promise(resolve => {
        setTimeout(() => resolve({ result: 'async complete!' }), 10);
      });
    `;
    const result = await ToolExecutor.executeFunction(functionString, {});
    assert(result.details.result === 'async complete!', 'Async function executed');
  } catch (err) {
    logFail(`Async execution failed: ${err.message}`);
    failed++;
  }

  // Test 4: Timeout protection
  logTest('Timeout protection for long-running functions');
  try {
    const functionString = `
      return new Promise(resolve => {
        setTimeout(() => resolve({ done: true }), 10000);
      });
    `;
    await ToolExecutor.executeFunction(functionString, {}, 100);
    logFail('Should have timed out but did not');
    failed++;
  } catch (err) {
    assert(err.message.includes('timeout'), 'Function timed out as expected');
  }

  // Test 5: Validate valid function
  logTest('Validate syntactically correct function');
  try {
    const valid = ToolExecutor.validateFunction('return params.x + 1;');
    assert(valid.valid === true, 'Valid function validated successfully');
  } catch (err) {
    logFail(`Validation failed: ${err.message}`);
    failed++;
  }

  // Test 6: Validate invalid function
  logTest('Validate syntactically incorrect function');
  try {
    const invalid = ToolExecutor.validateFunction('return params.x +');
    assert(invalid.valid === false, 'Invalid function rejected');
    assert(invalid.error !== undefined, 'Error message provided');
  } catch (err) {
    logFail(`Validation check failed: ${err.message}`);
    failed++;
  }

  // Test 7: Execute calculator function
  logTest('Execute calculator function (multiply)');
  try {
    const calcFunction = `
      const { operation, a, b } = params;
      if (operation === 'multiply') {
        return { result: a * b, operation, a, b };
      }
      return { error: 'Unknown operation' };
    `;
    const result = await ToolExecutor.executeFunction(calcFunction, {
      operation: 'multiply',
      a: 6,
      b: 7,
    });
    assert(result.details.result === 42, 'Calculator multiply: 6 × 7 = 42');
  } catch (err) {
    logFail(`Calculator execution failed: ${err.message}`);
    failed++;
  }
}

async function testDatabaseIntegration() {
  log('\n════════════════════════════════════════════════════', YELLOW);
  log('  Database Integration Tests', YELLOW);
  log('════════════════════════════════════════════════════', YELLOW);

  await connect();

  // Test 8: Create tool with execution function
  logTest('Create tool in database with executionFunction');
  try {
    // Clean up any existing test tool
    await ToolSchema.deleteOne({ name: 'test_multiply' });

    const tool = await ToolSchema.create({
      name: 'test_multiply',
      description: 'Multiplies two numbers',
      schema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
      executionFunction: 'return { result: params.a * params.b };',
    });

    assert(tool.name === 'test_multiply', 'Tool created with correct name');
    assert(tool.executionFunction.includes('params.a * params.b'), 'Execution function stored');
    logPass(`Tool ID: ${tool._id}`);
  } catch (err) {
    logFail(`Database create failed: ${err.message}`);
    failed++;
  }

  // Test 9: Retrieve and execute tool from database
  logTest('Retrieve tool from DB and execute its function');
  try {
    const tool = await ToolSchema.findOne({ name: 'test_multiply' });
    assert(tool !== null, 'Tool retrieved from database');

    const result = await ToolExecutor.executeFunction(tool.executionFunction, { a: 8, b: 9 });
    assert(result.details.result === 72, 'Executed DB tool: 8 × 9 = 72');
  } catch (err) {
    logFail(`Retrieve and execute failed: ${err.message}`);
    failed++;
  }

  // Test 10: Validation on save (invalid function)
  logTest('Database validation rejects invalid function');
  try {
    await ToolSchema.create({
      name: 'test_invalid',
      description: 'Invalid tool',
      schema: { type: 'object' },
      executionFunction: 'this is not valid javascript{{{',
    });
    logFail('Should have rejected invalid function');
    failed++;
  } catch (err) {
    assert(err.message.includes('Invalid executionFunction'), 'Invalid function rejected by DB');
  }

  // Test 11: Update tool execution function
  logTest('Update tool execution function');
  try {
    const tool = await ToolSchema.findOne({ name: 'test_multiply' });
    tool.executionFunction = 'return { result: params.a + params.b, operation: "add" };';
    await tool.save();

    const updated = await ToolSchema.findOne({ name: 'test_multiply' });
    const result = await ToolExecutor.executeFunction(updated.executionFunction, { a: 10, b: 5 });
    assert(result.details.result === 15, 'Updated function executes (10 + 5 = 15)');
    assert(result.details.operation === 'add', 'Updated function returns new fields');
  } catch (err) {
    logFail(`Update failed: ${err.message}`);
    failed++;
  }

  // Cleanup
  await ToolSchema.deleteOne({ name: 'test_multiply' });
  await disconnect();
}

async function testSampleTools() {
  log('\n════════════════════════════════════════════════════', YELLOW);
  log('  Sample Tools Tests', YELLOW);
  log('════════════════════════════════════════════════════', YELLOW);

  await connect();

  // Test 12: Calculator tool
  logTest('Sample calculator tool (divide)');
  try {
    const calc = await ToolSchema.findOne({ name: 'calculator' });
    if (calc) {
      const result = await ToolExecutor.executeFunction(calc.executionFunction, {
        operation: 'divide',
        a: 20,
        b: 4,
      });
      assert(result.details.result === 5, 'Calculator: 20 ÷ 4 = 5');
    } else {
      log('  ⚠ Calculator tool not found (run seed script first)', YELLOW);
    }
  } catch (err) {
    logFail(`Calculator test failed: ${err.message}`);
    failed++;
  }

  // Test 13: String utils tool
  logTest('Sample string_utils tool (reverse)');
  try {
    const strUtils = await ToolSchema.findOne({ name: 'string_utils' });
    if (strUtils) {
      const result = await ToolExecutor.executeFunction(strUtils.executionFunction, {
        action: 'reverse',
        text: 'hello',
      });
      assert(result.details.result === 'olleh', 'String reverse: "hello" → "olleh"');
    } else {
      log('  ⚠ String utils tool not found (run seed script first)', YELLOW);
    }
  } catch (err) {
    logFail(`String utils test failed: ${err.message}`);
    failed++;
  }

  // Test 14: Date formatter tool
  logTest('Sample date_formatter tool (iso)');
  try {
    const dateFormatter = await ToolSchema.findOne({ name: 'date_formatter' });
    if (dateFormatter) {
      const timestamp = Date.parse('2024-01-01T00:00:00Z');
      const result = await ToolExecutor.executeFunction(dateFormatter.executionFunction, {
        timestamp,
        format: 'iso',
      });
      assert(result.details.formatted === '2024-01-01T00:00:00.000Z', 'Date formatted to ISO');
    } else {
      log('  ⚠ Date formatter tool not found (run seed script first)', YELLOW);
    }
  } catch (err) {
    logFail(`Date formatter test failed: ${err.message}`);
    failed++;
  }

  await disconnect();
}

async function runAllTests() {
  console.log('');
  log('╔════════════════════════════════════════════════════╗', BLUE);
  log('║    Tool Execution Test Suite                      ║', BLUE);
  log('╚════════════════════════════════════════════════════╝', BLUE);

  try {
    await testToolExecutor();
    await testDatabaseIntegration();
    await testSampleTools();

    // Summary
    log('\n════════════════════════════════════════════════════', YELLOW);
    log('  Test Summary', YELLOW);
    log('════════════════════════════════════════════════════', YELLOW);
    log(`\n  Total tests: ${passed + failed}`);
    log(`  ${GREEN}Passed: ${passed}${RESET}`);
    log(`  ${failed > 0 ? RED : GREEN}Failed: ${failed}${RESET}`);
    
    if (failed === 0) {
      log('\n  🎉 All tests passed!', GREEN);
    } else {
      log('\n  ❌ Some tests failed', RED);
    }
    
    console.log('');
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    log(`\n❌ Test suite failed: ${err.message}`, RED);
    console.error(err);
    process.exit(1);
  }
}

// Run tests
runAllTests();
