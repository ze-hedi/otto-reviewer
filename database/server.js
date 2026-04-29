const express = require('express');
const cors = require('cors');
const { connect } = require('./connection');
const Agent = require('./models/Agent');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/agents', async (req, res) => {
  const agents = await Agent.find().sort({ createdAt: 1 });
  res.json(agents);
});

connect().then(() => {
  app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
}).catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
