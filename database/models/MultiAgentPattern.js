const mongoose = require('mongoose');

const multiAgentPatternSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    systemPrompt: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MultiAgentPattern', multiAgentPatternSchema);
