const mongoose = require('mongoose');

const memoryAgentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    icon: { type: String, default: '🧠' },
    model: { type: String, required: true },
    embedModel: { type: String, default: 'all-minilm' },
    ollamaBaseUrl: { type: String, default: 'http://localhost:11434' },
    collectionName: { type: String, default: 'memories' },
    qdrantUrl: { type: String, default: '' },
    qdrantApiKey: { type: String, default: null },
    customInstructions: { type: String, default: '' },
    apiKey: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MemoryAgent', memoryAgentSchema);
