const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    type: { type: String, default: 'custom' },
    description: { type: String, required: true },
    model: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    thinkingLevel: { 
      type: String, 
      enum: ['off', 'low', 'medium', 'high', 'xhigh'], 
      default: 'medium' 
    },
    sessionMode: { 
      type: String, 
      enum: ['memory', 'disk', 'continue'], 
      default: 'memory' 
    },
    workingDir: { 
      type: String, 
      default: '' 
    },
    apiKey: {
      type: String,
      default: null
    },
    icon: {
      type: String,
      default: '🤖',
    },
    tools: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ToolSchema' }],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Agent', agentSchema);
