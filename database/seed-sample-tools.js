const { connect, disconnect, ToolSchema } = require('./index');

const sampleTools = [
  {
    name: 'calculator',
    description: 'Performs basic arithmetic operations (add, subtract, multiply, divide)',
    schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
        },
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['operation', 'a', 'b'],
    },
    executionFunction: `
const { operation, a, b } = params;
let result;
switch (operation) {
  case 'add':
    result = a + b;
    break;
  case 'subtract':
    result = a - b;
    break;
  case 'multiply':
    result = a * b;
    break;
  case 'divide':
    if (b === 0) {
      return { error: 'Division by zero is not allowed', a, b };
    }
    result = a / b;
    break;
  default:
    return { error: 'Invalid operation', operation };
}
return { result, operation, a, b };
    `.trim(),
  },
  {
    name: 'string_utils',
    description: 'String manipulation utilities (uppercase, lowercase, reverse, length)',
    schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['uppercase', 'lowercase', 'reverse', 'length'],
        },
        text: { type: 'string' },
      },
      required: ['action', 'text'],
    },
    executionFunction: `
const { action, text } = params;
let result;
switch (action) {
  case 'uppercase':
    result = text.toUpperCase();
    break;
  case 'lowercase':
    result = text.toLowerCase();
    break;
  case 'reverse':
    result = text.split('').reverse().join('');
    break;
  case 'length':
    result = text.length;
    break;
  default:
    return { error: 'Invalid action', action };
}
return { result, action, originalText: text };
    `.trim(),
  },
  {
    name: 'date_formatter',
    description: 'Format dates in various formats (iso, locale, date-only, time-only)',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'number' },
        format: {
          type: 'string',
          enum: ['iso', 'locale', 'date-only', 'time-only'],
        },
      },
      required: ['timestamp'],
    },
    executionFunction: `
const { timestamp, format = 'iso' } = params;
const date = new Date(timestamp);

if (isNaN(date.getTime())) {
  return { error: 'Invalid timestamp', timestamp };
}

let result;
switch (format) {
  case 'iso':
    result = date.toISOString();
    break;
  case 'locale':
    result = date.toLocaleString();
    break;
  case 'date-only':
    result = date.toLocaleDateString();
    break;
  case 'time-only':
    result = date.toLocaleTimeString();
    break;
  default:
    return { error: 'Invalid format', format };
}
return { formatted: result, timestamp, format };
    `.trim(),
  },
  {
    name: 'random_number',
    description: 'Generate a random number within a specified range',
    schema: {
      type: 'object',
      properties: {
        min: { type: 'number' },
        max: { type: 'number' },
        integer: { type: 'boolean' },
      },
      required: ['min', 'max'],
    },
    executionFunction: `
const { min, max, integer = true } = params;

if (min >= max) {
  return { error: 'min must be less than max', min, max };
}

let result;
if (integer) {
  result = Math.floor(Math.random() * (max - min + 1)) + min;
} else {
  result = Math.random() * (max - min) + min;
}

return { result, min, max, integer };
    `.trim(),
  },
  {
    name: 'json_validator',
    description: 'Validate if a string is valid JSON',
    schema: {
      type: 'object',
      properties: {
        jsonString: { type: 'string' },
      },
      required: ['jsonString'],
    },
    executionFunction: `
const { jsonString } = params;

try {
  const parsed = JSON.parse(jsonString);
  return {
    valid: true,
    parsed: parsed,
    type: typeof parsed,
    isArray: Array.isArray(parsed),
  };
} catch (err) {
  return {
    valid: false,
    error: err.message,
  };
}
    `.trim(),
  },
];

async function seedSampleTools() {
  await connect();
  console.log('🌱 Seeding sample tools...');
  console.log('');

  for (const tool of sampleTools) {
    try {
      const existing = await ToolSchema.findOne({ name: tool.name });
      if (existing) {
        console.log(`⚠️  Tool "${tool.name}" already exists, skipping...`);
      } else {
        await ToolSchema.create(tool);
        console.log(`✅ Created tool: ${tool.name}`);
        console.log(`   Description: ${tool.description}`);
      }
    } catch (err) {
      console.log(`❌ Failed to create tool "${tool.name}": ${err.message}`);
    }
  }

  console.log('');
  console.log('✨ Seeding complete!');
  console.log('');
  console.log('You can now use these tools in your agents:');
  sampleTools.forEach(t => {
    console.log(`  - ${t.name}: ${t.description}`);
  });
  
  await disconnect();
}

// Run if executed directly
if (require.main === module) {
  seedSampleTools().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = { seedSampleTools, sampleTools };
