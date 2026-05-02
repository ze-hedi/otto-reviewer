const mongoose = require('mongoose');

const mcpServerSchema = new mongoose.Schema(
  {
    command: { type: String, required: true },
    args:    { type: [String], default: [] },
    env:     { type: Map, of: String, default: {} },
  },
  { _id: false }
);

const claudeCodeAgentSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, unique: true },
    description: { type: String, required: true },
    icon:        { type: String, default: '🖥️' },
    status:      { type: String, enum: ['Active', 'Inactive'], default: 'Active' },

    // Maps 1-to-1 with ClaudeCodeAgentConfig
    systemPrompt:   { type: String, default: '' },
    model:          { type: String, default: 'claude-sonnet-4-6' },
    maxTurns:       { type: Number, default: null },
    permissionMode: {
      type: String,
      enum: ['default', 'auto', 'acceptEdits', 'bypassPermissions'],
      default: 'default',
    },
    allowedTools: { type: [String], default: [] },
    mcpServers:   { type: Map, of: mcpServerSchema, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClaudeCodeAgent', claudeCodeAgentSchema);
