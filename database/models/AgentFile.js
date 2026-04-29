const mongoose = require('mongoose');

const agentFileSchema = new mongoose.Schema(
  {
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true },
    type: { type: String, enum: ['soul', 'skills'], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

agentFileSchema.index({ agent_id: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('AgentFile', agentFileSchema);
