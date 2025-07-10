const { extractReferencedEnvVars, verifyVaultSecrets } = require('./verifyVaultSecrets');
const github = require('@actions/github');
const core = require('@actions/core');

describe('extractReferencedEnvVars', () => {
  test('should extract referenced environment variables from file content', () => {
    const fileContent = `
    config :app, App.Repo,
      url: System.fetch_env!("DATABASE_URL")
      
    some_var = System.fetch_env("API_KEY")
    other_var = System.get_env("API_KEY_2", "default")

    config :app, 
      thing: fetch_env!("KEY3"),
      thing: env_atom!("KEY4"),
      thing: env_int!("KEY5"),
      thing: env_csv!("KEY6"),
      thing: env_str!("KEY7")
    `;
    const extractedEnvVars = extractReferencedEnvVars(fileContent, []);
    expect(extractedEnvVars).toEqual(['DATABASE_URL', 'API_KEY', 'API_KEY_2', 'KEY3', 'KEY4', 'KEY5', 'KEY6', 'KEY7']);
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
      |> other_func()  # and if they are piped afterwards
    "KEY3"
    |> fetch_env!()
    "KEY4" 
    |> env_csv!() 
    |> Enum.map()
    "KEY5" |> env_int!() |> Timex.from_unix()
    "KEY6"
    |> env_atom!()
    "KEY7" |> env_str!() |> String.downcase()
    `;

    const extractedEnvVars = extractReferencedEnvVars(fileContent, []);

    expect(extractedEnvVars).toEqual(['DATABASE_URL', 'API_KEY', 'API_KEY_2', 'KEY3', 'KEY4', 'KEY5', 'KEY6', 'KEY7']);
  });

  test('should filter out ignored environment variables', () => {
    const runtimeContent = 'System.fetch_env!("DATABASE_URL") + System.fetch_env!("API_KEY") + env_str!("API_KEY")';
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
