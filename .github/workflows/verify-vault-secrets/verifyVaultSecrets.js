const axios = require('axios');

module.exports = async ({ inputs, runtimeContent, core }) => {
  const { vault_token, service, edges, environments } = inputs;
  const VAULT_ADDR_PROD = 'https://vault.prod.thescore.is';
  const VAULT_ADDR_NON_PROD = 'https://vault.non-prod.thescore.is';
  const envVarsRegex = /System\.fetch_env!\("(\\.|[^"\\])*"\)/g;

  const extractEnvVars = (runtimeContent) => {
    console.log('runtimeContent: ', runtimeContent);
    const matches = runtimeContent.matchAll(envVarsRegex);
    console.log('matches: ', matches);
    return Array.from(matches, (match) => match[1]);
  };

  const getVaultAddr = (environment) => {
    return environment === 'production' ? VAULT_ADDR_PROD : VAULT_ADDR_NON_PROD;
  };

  const checkVaultSecrets = async (vaultToken, environment, edge, service) => {
    const vaultAddr = getVaultAddr(environment);
    const url = `${vaultAddr}/v1/scorebet/subkeys/${service}/${environment}/${edge}`;
    
    try {
      const response = await axios({
        method: 'get',
        url,
        headers: { 'X-Vault-Token': vaultToken },
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

  const envVars = extractEnvVars(runtimeContent);
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
