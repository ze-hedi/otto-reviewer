# Tool Execution Function Guide

## Overview

This feature allows you to create dynamic, executable tools that can be stored in the database and automatically loaded into PiAgent sessions. Tools are defined with:

1. **Name** - Unique identifier
2. **Description** - What the tool does (shown to the LLM)
3. **Schema** - JSON Schema defining the tool's parameters
4. **Execution Function** - JavaScript code that runs when the tool is called

## Quick Start

### 1. Seed Sample Tools

```bash
cd database
node seed-sample-tools.js
```

This creates 5 example tools:
- `calculator` - Basic arithmetic operations
- `string_utils` - String manipulation
- `date_formatter` - Date formatting
- `random_number` - Random number generation
- `json_validator` - JSON validation

### 2. Create a Tool via UI

1. Navigate to `/tools` in the React app
2. Click "+ Add Tool"
3. Fill in the form:
   - **Name**: `my_custom_tool`
   - **Description**: What the tool does
   - **Schema**: JSON Schema for parameters
   - **Execution Function**: JavaScript code

### 3. Use Tools in Agent Sessions

Tools are automatically loaded when you create an agent session via `/runtime/run`. The agent will have access to all tools in the database.

## Execution Function Format

### Basic Structure

```javascript
// Function receives a 'params' object
const { param1, param2 } = params;

// Perform your logic
const result = doSomething(param1, param2);

// Return a result object or string
return { result, additionalData: 'value' };
```

### Examples

#### Simple Calculator

```javascript
const { operation, a, b } = params;
let result;
switch (operation) {
  case 'add': result = a + b; break;
  case 'subtract': result = a - b; break;
  case 'multiply': result = a * b; break;
  case 'divide': result = b !== 0 ? a / b : 'Error: Division by zero'; break;
}
return { result, operation, a, b };
```

#### String Reverse

```javascript
const { text } = params;
return { result: text.split('').reverse().join('') };
```

#### Async Operations

```javascript
return new Promise(resolve => {
  setTimeout(() => {
    resolve({ result: 'Delayed result!' });
  }, 1000);
});
```

## Schema Definition

Use JSON Schema to define your tool's parameters:

### Simple String Parameter

```json
{
  "type": "object",
  "properties": {
    "message": { "type": "string" }
  },
  "required": ["message"]
}
```

### Multiple Parameters with Enum

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["uppercase", "lowercase", "reverse"]
    },
    "text": { "type": "string" }
  },
  "required": ["action", "text"]
}
```

### Optional Parameters

```json
{
  "type": "object",
  "properties": {
    "min": { "type": "number" },
    "max": { "type": "number" },
    "integer": { "type": "boolean" }
  },
  "required": ["min", "max"]
}
```

## API Usage

### Create Tool

```bash
curl -X POST http://localhost:4000/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "name": "echo",
    "description": "Echoes back the message",
    "schema": {
      "type": "object",
      "properties": {
        "message": { "type": "string" }
      }
    },
    "executionFunction": "return { echo: params.message };"
  }'
```

### List All Tools

```bash
curl http://localhost:4000/api/tools
```

### Update Tool

```bash
curl -X PUT http://localhost:4000/api/tools/TOOL_ID \
  -H "Content-Type: application/json" \
  -d '{
    "name": "echo",
    "description": "Updated description",
    "schema": { ... },
    "executionFunction": "return { echo: params.message.toUpperCase() };"
  }'
```

### Delete Tool

```bash
curl -X DELETE http://localhost:4000/api/tools/TOOL_ID
```

## How It Works

### Architecture Flow

```
┌──────────────────┐
│   React UI       │  User creates tool with execution function
│   (ToolsPage)    │
└────────┬─────────┘
         │ POST /api/tools
         ↓
┌──────────────────┐
│  Database API    │  Stores tool in MongoDB (with validation)
│  (port 4000)     │
└──────────────────┘
         │
         │ GET /api/tools (on agent session creation)
         ↓
┌──────────────────┐
│  Runtime Server  │  Loads tools and converts to PiAgent format
│  (port 5000)     │  Creates onToolExecute handler
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│    PiAgent       │  Registers tools and executes when LLM calls them
│                  │
└──────────────────┘
```

### Execution Process

1. **Tool Loading**:
   - When `/runtime/run` is called, the server fetches all tools from DB
   - Converts JSON Schema to TypeBox format
   - Registers tools with PiAgent

2. **Tool Execution**:
   - LLM decides to use a tool
   - `onToolExecute` handler is called with tool name and params
   - Execution function is parsed and executed via `ToolExecutor`
   - Result is returned to LLM

3. **Safety Features**:
   - Function validation before saving
   - 5-second timeout protection
   - Error handling and graceful failures
   - Params-only access (no Node.js APIs)

## Testing

### Run Unit Tests

```bash
# Run all tests
npx tsx tests/test-tool-execution.cjs

# Tests cover:
# - Function parsing and execution
# - Database CRUD operations
# - Sample tools from seed script
# - Timeout protection
# - Validation
```

### Expected Output

```
╔════════════════════════════════════════════════════╗
║    Tool Execution Test Suite                      ║
╚════════════════════════════════════════════════════╝

...

Test Summary
════════════════════════════════════════════════════

  Total tests: 19
  Passed: 19
  Failed: 0

  🎉 All tests passed!
```

## Security Considerations

### What's Safe

✅ **Params-only access** - Functions only receive tool parameters  
✅ **No require()** - Cannot import modules or access file system  
✅ **Timeout protection** - Functions killed after 5 seconds  
✅ **Validation** - Syntax checked before saving  
✅ **Error boundaries** - Errors caught and reported safely

### Limitations

⚠️ **No external APIs** - Cannot make HTTP requests  
⚠️ **No file system** - Cannot read/write files  
⚠️ **Pure computation** - Only operates on provided params  
⚠️ **Limited libraries** - No access to Node.js built-ins

### Best Practices

1. **Keep functions simple** - Focus on data transformation
2. **Validate inputs** - Check params before processing
3. **Return consistent formats** - Always return objects with meaningful keys
4. **Handle errors gracefully** - Return error messages, don't throw
5. **Test thoroughly** - Use the validation button before saving

## Example Use Cases

### 1. Data Transformation

```javascript
// Tool: format_currency
const { amount, currency = 'USD' } = params;
const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency
});
return { formatted: formatter.format(amount) };
```

### 2. Text Processing

```javascript
// Tool: word_count
const { text } = params;
const words = text.trim().split(/\s+/).filter(w => w.length > 0);
return {
  count: words.length,
  words: words,
  characters: text.length
};
```

### 3. Mathematical Operations

```javascript
// Tool: fibonacci
const { n } = params;
if (n <= 1) return { result: n };
let a = 0, b = 1;
for (let i = 2; i <= n; i++) {
  [a, b] = [b, a + b];
}
return { result: b, sequence: `F(${n})` };
```

## Troubleshooting

### "Invalid executionFunction" Error

- Check for syntax errors in your JavaScript
- Use the "Validate Function" button before saving
- Test with simple code first: `return { test: 'works' };`

### Tool Not Showing in Agent

- Restart the runtime server after adding tools
- Check database connection: `curl http://localhost:4000/api/tools`
- Verify tool was saved: Check MongoDB or use API

### Execution Timeout

- Reduce computation complexity
- Avoid infinite loops
- Remove unnecessary delays
- Current timeout: 5000ms (5 seconds)

### Function Returns Unexpected Results

- Log params: `console.log` won't work, return debugging info instead
- Test function locally with sample params
- Check schema matches what you're accessing in params

## Files Modified/Created

### Database Layer
- ✅ `/database/models/ToolSchema.js` - Added `executionFunction` field
- ✅ `/database/seed-sample-tools.js` - Sample tools seed script

### Runtime Layer
- ✅ `/runtime/tool-executor.ts` - Tool execution utility
- ✅ `/runtime/server.ts` - Tool loading and integration

### Frontend
- ✅ `/frontend/react-app/src/components/ToolForm.jsx` - Added execution function field
- ✅ `/frontend/react-app/src/components/ToolForm.css` - Execution function styles
- ✅ `/frontend/react-app/src/pages/ToolsPage.jsx` - Form state and validation

### Tests
- ✅ `/tests/test-tool-execution.cjs` - Comprehensive test suite

## Next Steps

1. **Create your first custom tool** via the UI
2. **Test it** by creating an agent session
3. **Iterate** - Tools can be edited and updated anytime
4. **Share** - Export tool definitions as JSON
5. **Scale** - Create tool libraries for different use cases

## Support

For issues or questions:
- Check test output: `npx tsx tests/test-tool-execution.cjs`
- Review logs: Runtime server console output
- Validate tools: Use the frontend validation button
- Database check: `mongo otto_code` → `db.toolschemas.find()`
