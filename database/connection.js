const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/otto_code';

async function connect() {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected to MongoDB at ${MONGO_URI}`);
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect };
