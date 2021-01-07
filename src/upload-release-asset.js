const core = require('@actions/core');
const { GitHub } = require('@actions/github');
const fs = require('fs');
const path = require('path');
const glob = require('glob');

async function run() {
  try {
    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage
    const github = new GitHub(process.env.GITHUB_TOKEN);

    // Get the inputs from the workflow file: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    const uploadUrl = core.getInput('upload_url', { required: true });
    const assetPath = core.getInput('asset_path', { required: true });
    const assetName = core.getInput('asset_name', { required: true });
    const assetContentType = core.getInput('asset_content_type', { required: true });

    // Determine content-length for header to upload asset
    const contentLength = filePath => fs.statSync(filePath).size;

    // If we have a glob pattern then get the files matching the pattern and upload each
    // matched file with the base name as the asset name.
    if (assetPath.includes('*')) {
      /**
       * @type {string[]}
       */
      const files = await new Promise((resolve, reject) => {
        glob(assetPath, (error, files) => {
          if (error) {
            return reject(error)
          }
          return resolve(files)
        });
      });
      /**
       * @type {string[]}
       */
      const downloadUrls = [];
      // Iterate and upload each file.
      const uploadPromises = files.map(async (file) => {
        const assetName = path.basename(file);
        const headers = { 'content-type': assetContentType, 'content-length': contentLength(file) };
        const uploadAssetResponse = await github.repos.uploadReleaseAsset({
          url: uploadUrl,
          headers,
          name: assetName,
          file: fs.readFileSync(file)
        });
        const {
          data: { browser_download_url: browserDownloadUrl }
        } = uploadAssetResponse
        downloadUrls.push(browserDownloadUrl)
      });
      // Wait for all the uploads to finish.
      await Promise.all(uploadPromises);
      const uploadedPaths = downloadUrls.join(';');
      core.setOutput('browser_download_url', uploadedPaths);
      return
    }

    // If the path does not have a glob pattern then just upload a single asset as usual.

    // Setup headers for API call, see Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-upload-release-asset for more information
    const headers = { 'content-type': assetContentType, 'content-length': contentLength(assetPath) };

    // Upload a release asset
    // API Documentation: https://developer.github.com/v3/repos/releases/#upload-a-release-asset
    // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-upload-release-asset
    const uploadAssetResponse = await github.repos.uploadReleaseAsset({
      url: uploadUrl,
      headers,
      name: assetName,
      file: fs.readFileSync(assetPath)
    });

    // Get the browser_download_url for the uploaded release asset from the response
    const {
      data: { browser_download_url: browserDownloadUrl }
    } = uploadAssetResponse;

    // Set the output variable for use by other actions: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    core.setOutput('browser_download_url', browserDownloadUrl);
  } catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = run;
