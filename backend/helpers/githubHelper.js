const axios = require('axios');
const mongoose = require('mongoose');

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

// Helper function to fetch all pages
async function fetchAllPages(initialUrl, accessToken) {
  let url = initialUrl;
  let allData = [];

  while (url) {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    allData = allData.concat(response.data);
    url = getNextPageUrl(response.headers);
  }

  return allData;
}

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
        try {
          // Get repository details to check if it's forked
          const repoDetails = await axios.get(`https://api.github.com/repos/${org.login}/${repo.name}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          // Determine which repository to fetch data from (parent if forked, current if not)
          const targetRepo = repoDetails.data.fork ? repoDetails.data.parent : repo;
          const targetOwner = repoDetails.data.fork ? targetRepo.owner.login : org.login;
          console.log(`Fetching data for repo: ${targetOwner}/${targetRepo.name} (${repoDetails.data.fork ? 'forked' : 'original'})`);

          try {
            // Fetch all commits with pagination
            const commitsUrl = `https://api.github.com/repos/${targetOwner}/${targetRepo.name}/commits?per_page=100`;
            const allCommits = await fetchAllPages(commitsUrl, accessToken);
            if (allCommits.length > 0) {
              await mongoose.connection.db.collection('commits').insertMany(allCommits);
              console.log(`Saved ${allCommits.length} commits for ${targetRepo.name}`);
            }
          } catch (error) {
            console.error(`Error fetching commits for ${targetRepo.name}:`, error.message);
          }

          try {
            // Fetch all pull requests with pagination
            const pullsUrl = `https://api.github.com/repos/${targetOwner}/${targetRepo.name}/pulls?per_page=100&state=all`;
            const allPulls = await fetchAllPages(pullsUrl, accessToken);
            if (allPulls.length > 0) {
              await mongoose.connection.db.collection('pulls').insertMany(allPulls);
              console.log(`Saved ${allPulls.length} pull requests for ${targetRepo.name}`);
            }
          } catch (error) {
            console.error(`Error fetching pull requests for ${targetRepo.name}:`, error.message);
          }

          try {
            // Fetch all issues with pagination
            const issuesUrl = `https://api.github.com/repos/${targetOwner}/${targetRepo.name}/issues?per_page=100&state=all`;
            const allIssues = await fetchAllPages(issuesUrl, accessToken);
            if (allIssues.length > 0) {
              await mongoose.connection.db.collection('issues').insertMany(allIssues);
              console.log(`Saved ${allIssues.length} issues for ${targetRepo.name}`);
            }
          } catch (error) {
            console.error(`Error fetching issues for ${targetRepo.name}:`, error.message);
          }
        } catch (error) {
          console.error(`Error processing repository ${repo.name}:`, error.message);
          continue; // Continue with next repository
        }
      }
    }

    // Fetch organization members for each org
    for (const org of orgs.data) {
      try {
        const members = await axios.get(`https://api.github.com/orgs/${org.login}/members`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { per_page: 100 }
        });
        if (members.data && members.data.length > 0) {
          await mongoose.connection.db.collection('users').insertMany(members.data);
        }
      } catch (error) {
        console.error(`Error fetching members for org ${org.login}:`, error.message);
        // Continue with other orgs even if one fails
        continue;
      }
    }
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    throw error;
  }
};