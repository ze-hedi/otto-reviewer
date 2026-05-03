const mongoose = require('mongoose');

const claudeCodeEventSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, ref: 'ClaudeCodeSession' },
    seq:       { type: Number, required: true },  // ordering index within the session
    type:      { type: String, required: true },  // "system" | "text" | "thinking" | "tool_start" | "tool_result" | "result" | "error"
    payload:   { type: mongoose.Schema.Types.Mixed, required: true },  // raw event object, flexible schema
  },
  { timestamps: true }
);

claudeCodeEventSchema.index({ sessionId: 1, seq: 1 });

module.exports = mongoose.model('ClaudeCodeEvent', claudeCodeEventSchema);
