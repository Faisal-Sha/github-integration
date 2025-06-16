const axios = require('axios');
const GithubIntegration = require('../models/GithubIntegration');
const { getGithubData } = require('../helpers/githubHelper');

exports.startGithubAuth = (req, res) => {
  console.log('Environment variables:', {
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    NODE_ENV: process.env.NODE_ENV
  });
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

    // Fetch and store GitHub data
    await getGithubData(access_token);

    res.redirect('http://localhost:4200?success=true');
  } catch (error) {
    console.error('GitHub auth error:', error);
    res.redirect('http://localhost:4200?success=false');
  }
};

exports.getIntegrationStatus = async (req, res) => {
  try {
    const integration = await GithubIntegration.findOne();
    console.log("integration",integration);
    res.json({
      isConnected: !!integration,
      connectedAt: integration?.connectedAt,
      username: integration?.username
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check integration status' });
  }
};

exports.removeIntegration = async (req, res) => {
  try {
    await GithubIntegration.deleteMany({});
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
  const { page = 1, limit = 10, search = '' } = req.query;
  
  try {
    const dbCollection = mongoose.connection.db.collection(collection);
    const query = search ? { $text: { $search: search } } : {};
    
    const [data, total] = await Promise.all([
      dbCollection.find(query)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .toArray(),
      dbCollection.countDocuments(query)
    ]);

    res.json({
      data,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch collection data' });
  }
};