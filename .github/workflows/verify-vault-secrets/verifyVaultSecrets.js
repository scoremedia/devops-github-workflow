const axios = require('axios');

module.exports = async ({ github, context, core }) => {
  const nonProdVaultToken = core.getInput('non_prod_vault_token');
  const prodVaultToken = core.getInput('prod_vault_token');
  const service = core.getInput('service');
  const edges = core.getInput('edges');
  const environments = core.getInput('environments');
  const vaultAddrProd = core.getInput('vault_addr_prod');
  const vaultAddrNonProd = core.getInput('vault_addr_non_prod');

  console.log('service', service);
  console.log('edges', edges);
  console.log('environments', environments);
  console.log('vault_addr_prod', vaultAddrProd);
  console.log('vault_addr_non_prod', vaultAddrNonProd);

  const envVarsRegex = /System\.fetch_env!\("([^"]+)"\)/g;

  const extractEnvVars = (runtimeContent) => {
    console.log(runtimeContent);
    const matches = runtimeContent.matchAll(envVarsRegex);
    return Array.from(matches, (match) => match[1]);
  };

  const getVaultAddr = (environment) => {
    return environment === 'production' ? vaultAddrProd : vaultAddrNonProd;
  };

  const getVaultToken = (environment) => {
    return environment === 'production' ? prodVaultToken : nonProdVaultToken;
  };

  const checkVaultSecrets = async (vaultToken, environment, edge, service) => {
    const url = `${getVaultAddr(environment)}/v1/scorebet/subkeys/${service}/${environment}/${edge}`;
    
    try {
      const response = await axios({
        method: 'get',
        url,
        headers: { 'X-Vault-Token': getVaultToken(environment) },
      });

      return response.data;
    } catch (error) {
      console.error(`Failed to retrieve secrets from ${url}`);
      throw error;
    }
  };

  const checkEnvVarsInResponse = (envVars, response) => {
    const missingVars = envVars.filter((envVar) => !response.includes(envVar));
    return missingVars;
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

  for (const environment of environments.split(',')) {
    console.log(`Processing environment: ${environment}`);
    const vaultAddr = getVaultAddr(environment);

    for (const edge of edges.split(',')) {
      console.log(`Processing edge: ${edge}`)
      try {
        const response = await checkVaultSecrets(vault_token, environment, edge, service);
        const missingVars = checkEnvVarsInResponse(envVars, response);

        if (missingVars.length > 0) {
          console.error(`Secrets ${missingVars.join(', ')} not found at ${vaultAddr}/v1/scorebet/subkeys/${service}/${environment}/${edge}`);
          missingVar = true;
        }
      } catch (error) {
        failureFlag = true;
      }
    }
  }

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
