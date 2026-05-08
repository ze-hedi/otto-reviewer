const mongoose = require('mongoose');

const orchestratorSchema = new mongoose.Schema(
  {
    orchestrator_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      unique: true,
    },
    sub_agents: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Agent' }],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Orchestrator', orchestratorSchema);
