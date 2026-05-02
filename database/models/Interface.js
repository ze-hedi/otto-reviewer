const mongoose = require('mongoose');

const interfaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    icon: { type: String, required: true },
    executionFunction: {
      type: String,
      required: true,
      validate: {
        validator(v) {
          try { new Function(v); return true; } catch { return false; }
        },
        message: 'executionFunction contains invalid JavaScript syntax',
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Interface', interfaceSchema);
