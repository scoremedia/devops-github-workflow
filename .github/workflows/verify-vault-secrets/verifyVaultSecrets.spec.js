const { extractReferencedEnvVars, verifyVaultSecrets } = require('./verifyVaultSecrets');
const github = require('@actions/github');
const core = require('@actions/core');

describe('extractReferencedEnvVars', () => {
  test('should extract referenced environment variables from file content', () => {
    const fileContent = 'System.fetch_env!("DATABASE_URL") + System.fetch_env("API_KEY") + System.get_env("API_KEY_2", "default")';
    const extractedEnvVars = extractReferencedEnvVars(fileContent, []);
    expect(extractedEnvVars).toEqual(['DATABASE_URL', 'API_KEY', 'API_KEY_2']);
  });

  test('should extract referenced environment variables when the pipe syntax is used', () => {
    const fileContent = `
    "DATABASE_URL" |> System.fetch_env!()
    "API_KEY" |> String.trim_leading("_") |> System.fetch_env()
    "API_KEY_2" # should match pipelines like this, too, even with comments, as long as
      |> baz() #
      |> foo_bar() # they start with a string literal
      # and even if they are broken by comments in between lines
      |> System.fetch_env!() # and with comments after the env call
      |> other_func()  # and if they are piped afterwards`;

    const extractedEnvVars = extractReferencedEnvVars(fileContent, []);

    expect(extractedEnvVars).toEqual(['DATABASE_URL', 'API_KEY', 'API_KEY_2']);
  });

  test('should filter out ignored environment variables', () => {
    const runtimeContent = 'System.fetch_env!("DATABASE_URL") + System.fetch_env!("API_KEY")';
    const ignoredKeys = ['API_KEY'];

    const extractedEnvVars = extractReferencedEnvVars(runtimeContent, ignoredKeys);
    
    const filteredEnvVars = extractedEnvVars.filter((envVar) => !ignoredKeys.includes(envVar));
    expect(filteredEnvVars).toEqual(['DATABASE_URL']);
  });

  test('should return an empty array if no environment variables are referenced', () => {
    const runtimeContent = 'console.log("Hello, world!")';
    const extractedEnvVars = extractReferencedEnvVars(runtimeContent);
    expect(extractedEnvVars).toEqual([]);
  });
});

// Mock GitHub API for unit testing
jest.mock('@actions/github', () => ({
  rest: {
    pulls: {
      listFiles: jest.fn(() => ({
        data: [
          { filename: 'config.js', status: 'modified' },
        ],
      })),
    },
    repos: {
      getContent: jest.fn((params) => ({
        data: { content: btoa('System.fetch_env!("DATABASE_URL")\nSystem.fetch_env!("API_KEY")') },
      })),
    },
  },
}));

describe('GitHub Action Script', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const context = { repo: { owner: 'user', repo: 'repo' }, payload: { pull_request: { number: 123, head: { sha: 'abc123' } } } };

  test('should detect missing environment variables', async () => {
    // retrieved keys = DATABASE_URL, ignored keys = ''
    core.getInput = jest.fn().mockReturnValue('').mockReturnValueOnce('DATABASE_URL');
    const coreErrorSpy = jest.spyOn(core, 'error');

    await verifyVaultSecrets({ github, context, core });
    expect(coreErrorSpy).toHaveBeenCalledWith('Environment variables missing from Vault: API_KEY');
  });

  test('should succeed when missing environment variables have been explicitly ignored', async () => {
    // retrieved keys = DATABASE_URL, ignored keys = API_KEY
    core.getInput = jest.fn().mockReturnValue('').mockReturnValueOnce('DATABASE_URL').mockReturnValueOnce('API_KEY');
    const coreErrorSpy = jest.spyOn(core, 'error');
    const consoleSpy = jest.spyOn(global.console, 'log')

    await verifyVaultSecrets({ github, context, core });
    expect(coreErrorSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('All secrets found.');
  });

  test('should log success message if all secrets are found', async () => {
    // retrieved keys = DATABASE_URL, ignored keys = ''
    core.getInput = jest.fn().mockReturnValue('').mockReturnValue('DATABASE_URL,API_KEY');
    const coreErrorSpy = jest.spyOn(core, 'error');
    const consoleSpy = jest.spyOn(global.console, 'log')

    await verifyVaultSecrets({ github, context, core });
    expect(coreErrorSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('All secrets found.');
  });
});
