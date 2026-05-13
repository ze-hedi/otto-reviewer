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
      type: [{
        agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
        stateful: { type: Boolean, default: false },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Orchestrator', orchestratorSchema);
