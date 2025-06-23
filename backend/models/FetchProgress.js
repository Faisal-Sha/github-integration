const mongoose = require('mongoose');

const fetchProgressSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  progress: { type: Number, default: 0 }, // 0 to 100
  message: String,
  updatedAt: { type: Date, default: Date.now },
  currentRepo: {
    owner: String,
    name: String,
    commitsPage: Number,
    pullsPage: Number,
    issuesPage: Number
  },
  stats: {
    totalRepos: { type: Number, default: 0 },
    processedRepos: { type: Number, default: 0 },
    totalCommits: { type: Number, default: 0 },
    totalPulls: { type: Number, default: 0 },
    totalIssues: { type: Number, default: 0 }
  }
});

module.exports = mongoose.model('FetchProgress', fetchProgressSchema);