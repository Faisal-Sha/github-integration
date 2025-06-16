const axios = require('axios');
const mongoose = require('mongoose');

exports.getGithubData = async (accessToken) => {
  try {
    // Fetch organizations
    const orgs = await axios.get('https://api.github.com/user/orgs', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    await mongoose.connection.db.collection('organizations').insertMany(orgs.data);

    for (const org of orgs.data) {
      // Fetch repositories
      const repos = await axios.get(`https://api.github.com/orgs/${org.login}/repos`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      await mongoose.connection.db.collection('repos').insertMany(repos.data);

      for (const repo of repos.data) {
        // Fetch commits
        const commits = await axios.get(`https://api.github.com/repos/${org.login}/${repo.name}/commits`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { per_page: 100 }
        });
        await mongoose.connection.db.collection('commits').insertMany(commits.data);

        // Fetch pull requests
        const pulls = await axios.get(`https://api.github.com/repos/${org.login}/${repo.name}/pulls`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { per_page: 100 }
        });
        await mongoose.connection.db.collection('pulls').insertMany(pulls.data);

        // Fetch issues
        const issues = await axios.get(`https://api.github.com/repos/${org.login}/${repo.name}/issues`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { per_page: 100 }
        });
        await mongoose.connection.db.collection('issues').insertMany(issues.data);
      }
    }

    // Fetch organization users
    const users = await axios.get('https://api.github.com/orgs/users', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    await mongoose.connection.db.collection('users').insertMany(users.data);
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    throw error;
  }
};