const mongoose = require('mongoose');

const claudeCodeSessionSchema = new mongoose.Schema(
  {
    _id:        { type: String },  // Claude's session ID used directly as _id
    agentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'ClaudeCodeAgent', default: null },
    model:      { type: String, default: '' },
    subtype:    { type: String, enum: ['success', 'error_during_execution', 'max_turns_reached'], default: 'success' },
    costUsd:    { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    numTurns:   { type: Number, default: 0 },
  },
  { timestamps: true, _id: false }
);

module.exports = mongoose.model('ClaudeCodeSession', claudeCodeSessionSchema);
