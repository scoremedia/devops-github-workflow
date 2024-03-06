const axios = require('axios');
const action = require('./verifyVaultSecrets');

jest.mock('axios');

describe('Verify Vault Secrets Tests', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should handle successful retrieval of secrets', async () => {
    axios.mockResolvedValue({ data: 'SECRET1 SECRET2'});

    const core = {
      error: jest.fn(),
      setFailed: jest.fn(),
    };

    const inputs = {
      vault_token: 'dummyToken',
      service: 'dummyService',
      edges: 'edge1,edge2',
      environments: 'production,staging',
    };

    const runtimeContent = 'System.fetch_env!("SECRET1") System.fetch_env!("SECRET2")';

    await action({ inputs, runtimeContent, core });

    expect(axios).toHaveBeenCalledTimes(4);

    expect(core.error).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('should handle missing environment variables', async () => {
    axios.mockResolvedValue({ data: 'SECRET1 SECRET3'});

    const core = {
      error: jest.fn(),
      setFailed: jest.fn(),
    };

    const inputs = {
      vault_token: 'dummyToken',
      service: 'dummyService',
      edges: 'edge1,edge2',
      environments: 'production,staging',
    };

    const runtimeContent = 'System.fetch_env!("SECRET1") System.fetch_env!("SECRET2") System.fetch_env!("SECRET3")';

    await action({ inputs, runtimeContent, core });

    expect(core.error).toHaveBeenCalledWith('One or more environment variables are missing from Vault');
    expect(core.setFailed).toHaveBeenCalled();
  });

  it('should handle error in axios call', async () => {
    axios.mockRejectedValue(new Error('Failed to retrieve secrets'));

    const core = {
      error: jest.fn(),
      setFailed: jest.fn(),
    };

    const inputs = {
      vault_token: 'dummyToken',
      service: 'dummyService',
      edges: 'edge1,edge2',
      environments: 'production,staging',
    };

    const runtimeContent = 'System.fetch_env!("SECRET1") System.fetch_env!("SECRET2")';

    await action({ inputs, runtimeContent, core });

    expect(core.error).toHaveBeenCalledWith('Failed to retrieve secrets from Vault for one or more environment or edge');
    expect(core.setFailed).toHaveBeenCalled();
  });
});
