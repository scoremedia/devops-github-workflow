const directRegex = /System\.(?:fetch_env!|fetch_env|get_env)\(*["']([^"']+)["'](?:,\s*([^)]+))?\)*/g
const pipedRegex = /["']([^"']+)["']\s*\n*\s*\|>\s*\n*\s*System\.(?:fetch_env!|fetch_env|get_env)/g

function extractReferencedEnvVars(fileData, ignoredKeys) {
  const directMatches = fileData.matchAll(directRegex);
  const pipedMatches = fileData.matchAll(pipedRegex);
  
  const extractedEnvVars = Array.from(directMatches, (match) => match[1]).concat(Array.from(pipedMatches, (match) => match[1]));

  return extractedEnvVars.filter((envVar) => !ignoredKeys.includes(envVar))
}

async function verifyVaultSecrets({ github, context, core }) {
  const retrievedVaultKeys = core.getInput('keys');
  const ignoredKeys = core.getInput('ignored_keys').split(',');

  const prFiles = await github.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number,
  });

  let referencedEnvVars = [];
  for (const file of prFiles.data) {
    if (file.status !== 'removed') {
      const fileContent = await github.rest.repos.getContent({
        owner: context.repo.owner,
        repo: context.repo.repo,
        path: file.filename,
        ref: context.payload.pull_request.head.sha,
      });

      const fileData = Buffer.from(fileContent.data.content, 'base64').toString();

      const fileEnvVars = extractReferencedEnvVars(fileData, ignoredKeys);

      referencedEnvVars = referencedEnvVars.concat(fileEnvVars);
    }
  }
  
  const undefinedEnvVars = referencedEnvVars.filter((envVar) => !retrievedVaultKeys.includes(envVar));

  if (undefinedEnvVars.length > 0) {
    core.error(`Environment variables missing from Vault: ${undefinedEnvVars}`);
    core.setFailed();
  } else {
    console.log('All secrets found.');
  }
};

if (process.env.NODE_ENV === 'test') {
  module.exports = {
    verifyVaultSecrets,
    extractReferencedEnvVars, // Exported for testing purposes
  };
} else {
  module.exports = verifyVaultSecrets;
}
