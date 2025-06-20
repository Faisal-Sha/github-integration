const axios = require('axios');
const mongoose = require('mongoose');
const FetchProgress = require('../models/FetchProgress');

// Helper function to get next page URL from Link header
const getNextPageUrl = (headers) => {
  const linkHeader = headers.link;
  if (!linkHeader) return null;

  const links = linkHeader.split(',');
  const nextLink = links.find(link => link.includes('rel="next"'));
  if (!nextLink) return null;

  const match = nextLink.match(/<([^>]+)>/);
  return match ? match[1] : null;
};

// Helper function to check rate limits
const checkRateLimit = async (accessToken) => {
  const response = await axios.get('https://api.github.com/rate_limit', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const remaining = response.data.resources.core.remaining;
  if (remaining < 100) {
    const resetTime = new Date(response.data.resources.core.reset * 1000);
    throw new Error(`Rate limit low (${remaining} remaining). Resets at ${resetTime}`);
  }
  return remaining;
};

// Helper function to fetch limited pages
async function fetchLimitedPages(initialUrl, accessToken, maxItems = 1000) {
  let url = initialUrl;
  let allData = [];
  let itemsFetched = 0;

  while (url && itemsFetched < maxItems) {
    await checkRateLimit(accessToken);
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const items = response.data.slice(0, maxItems - itemsFetched);
    allData = allData.concat(items);
    itemsFetched += items.length;
    url = getNextPageUrl(response.headers);
  }

  return allData;
}

exports.getGithubData = async (accessToken) => {
  try {
    let progress = 0;
    const updateProgress = async (increment, message) => {
      progress = Math.min(progress + increment, 100);
      await FetchProgress.updateOne({}, {
        status: 'processing',
        progress,
        message,
        updatedAt: new Date()
      }, { upsert: true });
    };

    await updateProgress(0, 'Fetching organizations...');

    // Fetch organizations
    await checkRateLimit(accessToken);
    const orgs = await axios.get('https://api.github.com/user/orgs', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    await mongoose.connection.db.collection('organizations').insertMany(orgs.data);
    await updateProgress(10, 'Organizations fetched');

    for (let i = 0; i < orgs.data.length; i++) {
      const org = orgs.data[i];
      await updateProgress(10, `Fetching repositories for ${org.login}...`);

      // Fetch repositories (limit to first 3 for testing)
      await checkRateLimit(accessToken);
      const repos = await axios.get(`https://api.github.com/orgs/${org.login}/repos?per_page=100`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      const limitedRepos = repos.data.slice(0, 3); // Limit to 3 repos
      await mongoose.connection.db.collection('repos').insertMany(limitedRepos);
      await updateProgress(10, `Repositories fetched for ${org.login}`);

      for (const repo of limitedRepos) {
        try {
          // Get repository details
          await checkRateLimit(accessToken);
          const repoDetails = await axios.get(`https://api.github.com/repos/${org.login}/${repo.name}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          const targetRepo = repoDetails.data.fork ? repoDetails.data.parent : repo;
          const targetOwner = repoDetails.data.fork ? targetRepo.owner.login : org.login;

          await updateProgress(5, `Fetching data for ${targetOwner}/${targetRepo.name}...`);

          // Fetch commits (limit to 1000)
          try {
            const commitsUrl = `https://api.github.com/repos/${targetOwner}/${targetRepo.name}/commits?per_page=100`;
            const allCommits = await fetchLimitedPages(commitsUrl, accessToken, 1000);
            if (allCommits.length > 0) {
              await mongoose.connection.db.collection('commits').insertMany(allCommits);
            }
          } catch (error) {
            console.error(`Error fetching commits for ${targetRepo.name}:`, error.message);
          }

          // Fetch pull requests (limit to 1000)
          try {
            const pullsUrl = `https://api.github.com/repos/${targetOwner}/${targetRepo.name}/pulls?per_page=100&state=all`;
            const allPulls = await fetchLimitedPages(pullsUrl, accessToken, 1000);
            if (allPulls.length > 0) {
              await mongoose.connection.db.collection('pulls').insertMany(allPulls);
            }
          } catch (error) {
            console.error(`Error fetching pull requests for ${targetRepo.name}:`, error.message);
          }

          // Fetch issues (limit to 500)
          try {
            const issuesUrl = `https://api.github.com/repos/${targetOwner}/${targetRepo.name}/issues?per_page=100&state=all`;
            const allIssues = await fetchLimitedPages(issuesUrl, accessToken, 500);
            if (allIssues.length > 0) {
              await mongoose.connection.db.collection('issues').insertMany(allIssues);
            }
          } catch (error) {
            console.error(`Error fetching issues for ${targetRepo.name}:`, error.message);
          }
        } catch (error) {
          console.error(`Error processing repository ${repo.name}:`, error.message);
          continue;
        }
      }
    }

    // Fetch organization members
    for (const org of orgs.data) {
      try {
        await checkRateLimit(accessToken);
        const members = await axios.get(`https://api.github.com/orgs/${org.login}/members?per_page=100`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (members.data.length > 0) {
          await mongoose.connection.db.collection('users').insertMany(members.data);
        }
        await updateProgress(5, `Fetched members for ${org.login}`);
      } catch (error) {
        console.error(`Error fetching members for org ${org.login}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    throw error;
  }
};