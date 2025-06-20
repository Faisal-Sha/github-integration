const mongoose = require('mongoose');

const fetchProgressSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  progress: { type: Number, default: 0 }, // 0 to 100
  message: String,
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FetchProgress', fetchProgressSchema);