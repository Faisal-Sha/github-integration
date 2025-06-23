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

// Helper function to fetch paginated data with progress tracking
async function fetchPaginatedData(url, accessToken, collection, owner, repoName, pageType) {
  try {
    await checkRateLimit(accessToken);
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (response.data.length > 0) {
      // Insert data in batches of 1000
      const chunks = [];
      for (let i = 0; i < response.data.length; i += 1000) {
        chunks.push(response.data.slice(i, i + 1000));
      }

      for (const chunk of chunks) {
        await mongoose.connection.db.collection(collection).insertMany(chunk, { ordered: false });
      }

      // Update progress
      const progress = await FetchProgress.findOne();
      if (progress) {
        // Update page count
        progress.currentRepo[`${pageType}Page`]++;
        
        // Update total count based on type
        const statKey = `total${pageType.charAt(0).toUpperCase() + pageType.slice(1)}`;
        progress.stats[statKey] = (progress.stats[statKey] || 0) + response.data.length;
        
        // Update timestamp
        progress.updatedAt = new Date();
        
        await progress.save();
      }
    }

    return getNextPageUrl(response.headers);
  } catch (error) {
    if (error.response?.status === 409) {
      // Duplicate key error, ignore and continue
      return getNextPageUrl(error.response.headers);
    }
    throw error;
  }
}

exports.getGithubData = async (accessToken) => {
  try {
    // Initialize or reset progress
    await FetchProgress.deleteMany({});
    await FetchProgress.create({
      status: 'processing',
      progress: 0,
      message: 'Fetching organizations...',
      currentRepo: { commitsPage: 0, pullsPage: 0, issuesPage: 0 },
      stats: { totalRepos: 0, processedRepos: 0, totalCommits: 0, totalPulls: 0, totalIssues: 0 }
    });

    // Fetch organizations
    await checkRateLimit(accessToken);
    const orgs = await axios.get('https://api.github.com/user/orgs', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    await mongoose.connection.db.collection('organizations').insertMany(orgs.data);

    // Fetch all repositories for each organization
    for (const org of orgs.data) {
      let reposUrl = `https://api.github.com/orgs/${org.login}/repos?per_page=100`;
      
      while (reposUrl) {
        await checkRateLimit(accessToken);
        const reposResponse = await axios.get(reposUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        const repos = reposResponse.data;
        if (repos.length > 0) {
          await mongoose.connection.db.collection('repos').insertMany(repos, { ordered: false });
          
          // Update total repos count
          const progress = await FetchProgress.findOne();
          progress.stats.totalRepos += repos.length;
          await progress.save();
        }

        reposUrl = getNextPageUrl(reposResponse.headers);
      }

      // Process each repository
      const allRepos = await mongoose.connection.db.collection('repos').find({ 'owner.login': org.login }).toArray();
      
      for (const repo of allRepos) {
        try {
          // Get repository details
          await checkRateLimit(accessToken);
          const repoDetails = await axios.get(`https://api.github.com/repos/${org.login}/${repo.name}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          // For forked repos, use parent repo details
          const repoToProcess = repoDetails.data.fork ? repoDetails.data.parent : repoDetails.data;
          const targetOwner = repoToProcess.owner.login;
          const targetName = repoToProcess.name;

          // Update current repo in progress
          await FetchProgress.updateOne({}, {
            'currentRepo.owner': targetOwner,
            'currentRepo.name': targetName,
            'currentRepo.commitsPage': 0,
            'currentRepo.pullsPage': 0,
            'currentRepo.issuesPage': 0,
            message: `Processing ${targetOwner}/${targetName}`,
            updatedAt: new Date()
          });

          const ITEM_LIMIT = 4000; // Maximum items to fetch per type
          const PAGE_SIZE = 100;  // GitHub's maximum page size

          // Fetch commits
          let commitsUrl = `https://api.github.com/repos/${targetOwner}/${targetName}/commits?per_page=${PAGE_SIZE}`;
          let commitsCount = 0;
          while (commitsUrl && commitsCount < ITEM_LIMIT) {
            const nextUrl = await fetchPaginatedData(commitsUrl, accessToken, 'commits', targetOwner, targetName, 'commits');
            commitsCount += PAGE_SIZE;
            commitsUrl = commitsCount < ITEM_LIMIT ? nextUrl : null;
          }

          // Fetch pull requests
          let pullsUrl = `https://api.github.com/repos/${targetOwner}/${targetName}/pulls?per_page=${PAGE_SIZE}&state=all&sort=updated&direction=desc`;
          let pullsCount = 0;
          while (pullsUrl && pullsCount < ITEM_LIMIT) {
            const nextUrl = await fetchPaginatedData(pullsUrl, accessToken, 'pulls', targetOwner, targetName, 'pulls');
            pullsCount += PAGE_SIZE;
            pullsUrl = pullsCount < ITEM_LIMIT ? nextUrl : null;
          }

          // Fetch issues
          let issuesUrl = `https://api.github.com/repos/${targetOwner}/${targetName}/issues?per_page=${PAGE_SIZE}&state=all&sort=updated&direction=desc`;
          let issuesCount = 0;
          while (issuesUrl && issuesCount < ITEM_LIMIT) {
            const nextUrl = await fetchPaginatedData(issuesUrl, accessToken, 'issues', targetOwner, targetName, 'issues');
            issuesCount += PAGE_SIZE;
            issuesUrl = issuesCount < ITEM_LIMIT ? nextUrl : null;
          }

          // Update processed repos count and progress
          const progress = await FetchProgress.findOne();
          if (progress) {
            // Increment processed repos
            progress.stats.processedRepos++;
            
            // Update progress percentage
            if (progress.stats.totalRepos > 0) {
              progress.progress = (progress.stats.processedRepos / progress.stats.totalRepos) * 100;
            }
            
            // Update timestamp
            progress.updatedAt = new Date();
            
            await progress.save();
          }

        } catch (error) {
          console.error(`Error processing repository ${repo.name}:`, error.message);
          // Continue with next repo
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
}