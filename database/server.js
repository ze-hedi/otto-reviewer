const express = require('express');
const cors = require('cors');
const { connect } = require('./connection');
const Agent = require('./models/Agent');
const AgentFile = require('./models/AgentFile');
const ToolSchema = require('./models/ToolSchema');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/agents', async (req, res) => {
  const agents = await Agent.find().sort({ createdAt: 1 });
  res.json(agents);
});

app.post('/api/agents', async (req, res) => {
  try {
    const { 
      name, description, model, 
      thinkingLevel, sessionMode, workingDir, apiKey,
      systemPrompt, skills 
    } = req.body;

    const agent = await Agent.create({ 
      name, description, model,
      thinkingLevel, sessionMode, workingDir, apiKey 
    });

    if (systemPrompt) {
      await AgentFile.create({
        agent_id: agent._id,
        type: 'soul',
        content: systemPrompt.content,
      });
    }

    if (skills && skills.length > 0) {
      const combined = skills.map((s) => `### ${s.name}\n\n${s.content}`).join('\n\n---\n\n');
      await AgentFile.create({
        agent_id: agent._id,
        type: 'skills',
        content: combined,
      });
    }

    res.status(201).json(agent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/agents/:id/files', async (req, res) => {
  try {
    const files = await AgentFile.find({ agent_id: req.params.id });
    res.json(files);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/agents/:id', async (req, res) => {
  try {
    const { 
      name, description, model,
      thinkingLevel, sessionMode, workingDir, apiKey,
      systemPrompt, skills 
    } = req.body;

    const agent = await Agent.findByIdAndUpdate(
      req.params.id,
      { name, description, model, thinkingLevel, sessionMode, workingDir, apiKey },
      { returnDocument: 'after', runValidators: true }
    );
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    if (systemPrompt) {
      await AgentFile.findOneAndUpdate(
        { agent_id: agent._id, type: 'soul' },
        { content: systemPrompt.content },
        { upsert: true, new: true }
      );
    } else {
      await AgentFile.deleteOne({ agent_id: agent._id, type: 'soul' });
    }

    if (skills && skills.length > 0) {
      const combined = skills
        .map((s) => s.preloaded ? s.content : `### ${s.name}\n\n${s.content}`)
        .join('\n\n---\n\n');
      await AgentFile.findOneAndUpdate(
        { agent_id: agent._id, type: 'skills' },
        { content: combined },
        { upsert: true, new: true }
      );
    } else {
      await AgentFile.deleteOne({ agent_id: agent._id, type: 'skills' });
    }

    res.json(agent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Tool Schema endpoints
app.get('/api/tools', async (req, res) => {
  try {
    const tools = await ToolSchema.find().sort({ name: 1 });
    res.json(tools);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tools', async (req, res) => {
  try {
    const { name, description, icon, schema, executionFunction } = req.body;

    if (!name || !description || !schema || !executionFunction) {
      return res.status(400).json({ error: 'name, description, schema, and executionFunction are required' });
    }

    const tool = await ToolSchema.create({ name, description, icon, schema, executionFunction });
    res.status(201).json(tool);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: 'A tool with this name already exists' });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

app.get('/api/tools/:id', async (req, res) => {
  try {
    const tool = await ToolSchema.findById(req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    res.json(tool);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/tools/:id', async (req, res) => {
  try {
    const { name, description, icon, schema, executionFunction } = req.body;

    const tool = await ToolSchema.findByIdAndUpdate(
      req.params.id,
      { name, description, icon, schema, executionFunction },
      { returnDocument: 'after', runValidators: true }
    );
    
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    res.json(tool);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: 'A tool with this name already exists' });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

app.delete('/api/tools/:id', async (req, res) => {
  try {
    const tool = await ToolSchema.findByIdAndDelete(req.params.id);
    
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    
    res.json({ message: 'Tool deleted successfully', tool });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

connect().then(() => {
  app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
}).catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
