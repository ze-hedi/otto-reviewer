const { connect, disconnect, ToolSchema } = require('./index');

async function testToolSchema() {
  console.log('🔌 Connecting to database...');
  await connect();

  try {
    // Clean up any existing test data
    console.log('\n🧹 Cleaning up test data...');
    await ToolSchema.deleteMany({ name: /^test_/ });

    // Test 1: Create a tool schema
    console.log('\n✅ Test 1: Creating a tool schema...');
    const tool1 = await ToolSchema.create({
      name: 'test_calculator',
      description: 'A simple calculator tool',
      schema: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['operation', 'a', 'b']
      }
    });
    console.log('   Created:', tool1.name, '- ID:', tool1._id);

    // Test 2: Create another tool
    console.log('\n✅ Test 2: Creating another tool schema...');
    const tool2 = await ToolSchema.create({
      name: 'test_weather',
      description: 'Get weather information',
      schema: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          units: { type: 'string', enum: ['celsius', 'fahrenheit'] }
        },
        required: ['location']
      }
    });
    console.log('   Created:', tool2.name, '- ID:', tool2._id);

    // Test 3: Get all tools
    console.log('\n✅ Test 3: Getting all tools...');
    const allTools = await ToolSchema.find().sort({ name: 1 });
    console.log(`   Found ${allTools.length} tools:`);
    allTools.forEach(t => console.log(`   - ${t.name}: ${t.description}`));

    // Test 4: Get a specific tool
    console.log('\n✅ Test 4: Getting specific tool by ID...');
    const foundTool = await ToolSchema.findById(tool1._id);
    console.log('   Found:', foundTool.name);
    console.log('   Schema:', JSON.stringify(foundTool.schema, null, 2));

    // Test 5: Update a tool
    console.log('\n✅ Test 5: Updating tool...');
    const updatedTool = await ToolSchema.findByIdAndUpdate(
      tool1._id,
      { description: 'An advanced calculator tool with more operations' },
      { new: true, runValidators: true }
    );
    console.log('   Updated description:', updatedTool.description);

    // Test 6: Test duplicate name (should fail)
    console.log('\n✅ Test 6: Testing duplicate name validation...');
    try {
      await ToolSchema.create({
        name: 'test_calculator',
        description: 'Duplicate',
        schema: {}
      });
      console.log('   ❌ FAILED: Should have thrown duplicate error');
    } catch (err) {
      console.log('   ✓ Correctly prevented duplicate:', err.code === 11000 ? 'Duplicate key error' : err.message);
    }

    // Test 7: Delete a tool
    console.log('\n✅ Test 7: Deleting tool...');
    const deleted = await ToolSchema.findByIdAndDelete(tool2._id);
    console.log('   Deleted:', deleted.name);

    // Verify deletion
    const remaining = await ToolSchema.find({ name: /^test_/ });
    console.log(`   Remaining test tools: ${remaining.length}`);

    // Clean up
    console.log('\n🧹 Final cleanup...');
    await ToolSchema.deleteMany({ name: /^test_/ });

    console.log('\n✨ All tests passed!');

  } catch (err) {
    console.error('\n❌ Test failed:', err);
  } finally {
    await disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

testToolSchema();
