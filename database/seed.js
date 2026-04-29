const { connect, disconnect } = require('./connection');
const Agent = require('./models/Agent');

const agents = [
  {
    name: 'otto_review',
    type: 'React Agent',
    description:
      'Specialized agent for reviewing React code, identifying best practices, and suggesting improvements.',
    status: 'Active',
  },
  {
    name: 'plan_execute',
    type: 'Plan & Execute Agent',
    description:
      'Strategic agent that plans complex tasks and executes them step by step with precision.',
    status: 'Active',
  },
  {
    name: 'code_analyzer',
    type: 'Code Analysis Agent',
    description:
      'General purpose agent for analyzing code quality, performance, and security vulnerabilities.',
    status: 'Active',
  },
];

async function seed() {
  await connect();

  await Agent.deleteMany({});
  const inserted = await Agent.insertMany(agents);
  console.log(`Seeded ${inserted.length} agents:`);
  inserted.forEach((a) => console.log(`  - ${a.name} (${a.type})`));

  await disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
