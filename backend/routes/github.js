const express = require('express');
const router = express.Router();
const githubController = require('../controllers/githubController');

router.get('/auth', githubController.startGithubAuth);
router.get('/callback', githubController.handleGithubCallback);
router.get('/status', githubController.getIntegrationStatus);
router.get('/fetch-status', githubController.getFetchStatus);
router.delete('/remove', githubController.removeIntegration);
router.get('/data/:collection', githubController.getCollectionData);

module.exports = router;