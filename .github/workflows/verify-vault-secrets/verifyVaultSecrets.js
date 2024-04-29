module.exports = async ({ github, context, core }) => {
  const retrievedVaultKeys = core.getInput('keys');
  const ignoredKeys =  core.getInput('ignored_keys');

  const envVarsRegex = /System\.fetch_env!\("([^"]+)"\)/g;

  const extractReferencedEnvVars = (runtimeContent) => {
    const matches = runtimeContent.matchAll(envVarsRegex);
    const extractedEnvVars = Array.from(matches, (match) => match[1]);

    return extractedEnvVars.filter((envVar) => !ignoredKeys.includes(envVar))
  };

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
      const fileEnvVars = extractReferencedEnvVars(fileData);

      envVars = envVars.concat(fileEnvVars);
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
