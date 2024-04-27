module.exports = async ({ github, context, core }) => {
  const retrievedKeys = core.getInput('keys');

  console.log('keys', keys);

  const envVarsRegex = /System\.fetch_env!\("([^"]+)"\)/g;

  const extractEnvVars = (runtimeContent) => {
    const matches = runtimeContent.matchAll(envVarsRegex);
    return Array.from(matches, (match) => match[1]);
  };

  const prFiles = await github.rest.pulls.listFiles({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number,
  });

  let envVars = [];
  for (const file of prFiles.data) {
    if (file.status !== 'removed') {
      const fileContent = await github.rest.repos.getContent({
        owner: context.repo.owner,
        repo: context.repo.repo,
        path: file.filename,
        ref: context.payload.pull_request.head.sha,
      });

      const fileData = Buffer.from(fileContent.data.content, 'base64').toString();
      const fileEnvVars = extractEnvVars(fileData);

      envVars = envVars.concat(fileEnvVars);
    }
  }

  let missingVar = false;
  let failureFlag = false;
  
  envVars.filter((envVar) => !retrievedKeys.includes(envVar));

  if (failureFlag) {
    core.error('Failed to retrieve secrets from Vault for one or more environment or edge');
    core.setFailed();
  } else if (missingVar) {
    core.error('One or more environment variables are missing from Vault');
    core.setFailed();
  } else {
    console.log('All secrets found.');
  }
};
