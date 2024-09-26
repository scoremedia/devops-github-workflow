const systemEnvPattern = `System\\.(fetch_env!|fetch_env|get_env)`;
const stringLiteralPattern = `(["']([^"']+)["'])`;
const pipe_operator = `\\|\\>`;
const envVarPipelinePattern = `(${stringLiteralPattern}(\\s+(${pipe_operator}\\s+[.\\w\\!\\?]+\\(.*\\))|(\\s*#\\s+.+)?)*\\s+(${pipe_operator})\\s+${systemEnvPattern}\\(\\))`;
const envVarStandardCallPattern = `(${systemEnvPattern}\\(${stringLiteralPattern}+(?:,\\s*([^)]+))?\\))`;
const envVarsRegex = new RegExp(`${envVarPipelinePattern}|${envVarStandardCallPattern}`, "gm");

function extractReferencedEnvVars(fileData, ignoredKeys) {
  const matches = fileData.matchAll(envVarsRegex);
  const extractedEnvVars = Array.from(matches, (match) => match[3] ?? match[12]);

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
