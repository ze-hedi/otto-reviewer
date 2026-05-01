const mongoose = require('mongoose');

const toolSchemaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    schema: { type: mongoose.Schema.Types.Mixed, required: true },
    executionFunction: { type: String, required: true },
  },
  { timestamps: true }
);

// Validate executionFunction before saving
toolSchemaSchema.pre('save', function() {
  // Test if the function string is valid JavaScript
  try {
    new Function('params', this.executionFunction);
  } catch (err) {
    throw new Error(`Invalid executionFunction: ${err.message}`);
  }
});

module.exports = mongoose.model('ToolSchema', toolSchemaSchema);
