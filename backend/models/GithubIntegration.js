const mongoose = require('mongoose');

const githubIntegrationSchema = new mongoose.Schema({
  userId: String,
  username: String,
  accessToken: String,
  connectedAt: Date
});

module.exports = mongoose.model('GithubIntegration', githubIntegrationSchema);