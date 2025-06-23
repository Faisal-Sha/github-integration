const axios = require('axios');
const mongoose = require('mongoose');
const Queue = require('bull');
const GithubIntegration = require('../models/GithubIntegration');
const FetchProgress = require('../models/FetchProgress');
const { getGithubData } = require('../helpers/githubHelper');

// Initialize Bull queue (requires Redis)
const githubDataQueue = new Queue('github-data', {
  redis: { host: 'redis', port: 6379 }
});

exports.startGithubAuth = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = 'http://localhost:4200/callback';
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:org,repo`;
  res.json({ authUrl: githubAuthUrl });
};

exports.handleGithubCallback = async (req, res) => {
  const { code } = req.query;
  
  try {
    // Exchange code for access token
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    }, {
      headers: { Accept: 'application/json' }
    });

    const { access_token } = response.data;
    
    // Get user data
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    // Save integration details
    const integration = new GithubIntegration({
      userId: userResponse.data.id,
      username: userResponse.data.login,
      accessToken: access_token,
      connectedAt: new Date()
    });
    await integration.save();

    // Initialize fetch progress
    await FetchProgress.create({
      status: 'pending',
      progress: 0,
      message: 'Starting GitHub data fetch...'
    });

    // Queue data fetching
    await githubDataQueue.add({ accessToken: access_token });

    res.redirect('http://localhost:4200?success=true');
  } catch (error) {
    console.error('GitHub auth error:', error);
    res.redirect('http://localhost:4200?success=false');
  }
};

exports.getIntegrationStatus = async (req, res) => {
  try {
    const integration = await GithubIntegration.findOne();
    res.json({
      isConnected: !!integration,
      connectedAt: integration?.connectedAt,
      username: integration?.username
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check integration status' });
  }
};

exports.getFetchStatus = async (req, res) => {
  try {
    const progress = await FetchProgress.findOne().sort({ updatedAt: -1 });
    res.json({
      status: progress?.status || 'pending',
      progress: progress?.progress || 0,
      message: progress?.message || 'No fetch in progress',
      stats: progress?.stats || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check fetch status' });
  }
};

exports.stopFetch = async (req, res) => {
  try {
    // Set status to idle to stop any ongoing fetch
    await mongoose.connection.db.collection('fetchStatus').updateOne(
      {},
      { $set: { status: 'idle', progress: 0, message: '', currentRepo: null } },
      { upsert: true }
    );
    res.json({ message: 'Fetch stopped successfully' });
  } catch (error) {
    console.error('Error stopping fetch:', error);
    res.status(500).json({ error: 'Failed to stop fetch' });
  }
};

exports.removeIntegration = async (req, res) => {
  try {
    await GithubIntegration.deleteMany({});
    await FetchProgress.deleteMany({});
    // Clear other collections
    await Promise.all([
      mongoose.connection.db.collection('organizations').deleteMany({}),
      mongoose.connection.db.collection('repos').deleteMany({}),
      mongoose.connection.db.collection('commits').deleteMany({}),
      mongoose.connection.db.collection('pulls').deleteMany({}),
      mongoose.connection.db.collection('issues').deleteMany({})
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove integration' });
  }
};

exports.getCollectionData = async (req, res) => {
  const { collection } = req.params;
  const { search = '' } = req.query;
  
  try {
    const collections = await mongoose.connection.db.listCollections({ name: collection }).toArray();
    if (collections.length === 0) {
      return res.json({
        data: [],
        message: 'No data available yet. Please connect to GitHub first.'
      });
    }

    const dbCollection = mongoose.connection.db.collection(collection);
    let query = {};
    
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { login: { $regex: search, $options: 'i' } },
          { full_name: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const data = await dbCollection.find(query).toArray();

    res.json({
      data
    });
  } catch (error) {
    console.error('Error fetching collection data:', error);
    res.status(500).json({ error: 'Failed to fetch collection data' });
  }
};

// Process queued data fetching
githubDataQueue.process(async (job) => {
  try {
    console.log('Processing GitHub data fetching...');
    await getGithubData(job.data.accessToken);
    await FetchProgress.updateOne({}, {
      status: 'completed',
      progress: 100,
      message: 'Data fetch completed',
      updatedAt: new Date()
    }, { upsert: true });
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    await FetchProgress.updateOne({}, {
      status: 'failed',
      progress: 0,
      message: `Data fetch failed: ${error.message}`,
      updatedAt: new Date()
    }, { upsert: true });
    throw error;
  }
});