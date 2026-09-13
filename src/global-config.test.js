const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const { setupGlobalConfig, cleanupGlobalConfig, parseGitVersion, compareVersions } = require("./global-config");

/**
 * Runs a callback with RUNNER_TEMP pointed at a throwaway directory, restoring the environment
 * afterwards so that the tests cannot touch the real ~/.gitconfig.
 */
const withRunnerTemp = (fn) => {
  const saved = { ...process.env };
  const runnerTemp = fs.mkdtempSync(path.join(os.tmpdir(), "global-config-test-"));
  process.env.RUNNER_TEMP = runnerTemp;
  delete process.env.GITHUB_ENV;
  delete process.env.GITHUB_STATE;
  delete process.env.GIT_CONFIG_GLOBAL;
  try {
    return fn(runnerTemp);
  } finally {
    process.env = saved;
    fs.rmSync(runnerTemp, { recursive: true, force: true });
  }
};

test("parseGitVersion handles platform-specific suffixes", () => {
  assert.deepEqual(parseGitVersion("git version 2.39.3 (Apple Git-145)"), [2, 39, 3]);
  assert.deepEqual(parseGitVersion("git version 2.45.0.windows.1"), [2, 45, 0]);
  assert.deepEqual(parseGitVersion("git version 2.32"), [2, 32, 0]);
  assert.throws(() => parseGitVersion("not a version"));
});

test("compareVersions orders the 2.32 cutoff correctly", () => {
  assert.equal(compareVersions([2, 31, 9], [2, 32, 0]) < 0, true);
  assert.equal(compareVersions([2, 32, 0], [2, 32, 0]), 0);
  assert.equal(compareVersions([2, 32, 1], [2, 32, 0]) > 0, true);
  // A leading-component difference must win over the later ones.
  assert.equal(compareVersions([10, 0, 0], [2, 99, 99]) > 0, true);
});

test("setupGlobalConfig requires RUNNER_TEMP", () => {
  const saved = process.env.RUNNER_TEMP;
  delete process.env.RUNNER_TEMP;
  try {
    assert.throws(() => setupGlobalConfig(), /RUNNER_TEMP/);
  } finally {
    if (saved !== undefined) process.env.RUNNER_TEMP = saved;
  }
});

test("setupGlobalConfig makes --global writes land in a 0600 job-local file", () => {
  withRunnerTemp((runnerTemp) => {
    const configPath = setupGlobalConfig();

    assert.equal(path.dirname(configPath), runnerTemp);
    assert.equal(process.env.GIT_CONFIG_GLOBAL, configPath);
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
    }
    // The pre-existing global config must stay reachable.
    assert.match(fs.readFileSync(configPath, "utf8"), /^\tpath = ~\/\.gitconfig$/m);

    // The real check: a --global write must land in this file, not in the user's ~/.gitconfig.
    execFileSync("git", ["config", "--global", "test.marker", "written-here"]);
    assert.match(fs.readFileSync(configPath, "utf8"), /written-here/);

    const homeConfig = path.join(os.homedir(), ".gitconfig");
    if (fs.existsSync(homeConfig)) {
      assert.doesNotMatch(fs.readFileSync(homeConfig, "utf8"), /written-here/);
    }
  });
});

test("cleanupGlobalConfig removes the file, and is a no-op without saved state", () => {
  withRunnerTemp(() => {
    const configPath = setupGlobalConfig();
    // saveState does not update process.env, so emulate what the runner hands to the post step.
    process.env.STATE_globalConfigPath = configPath;
    cleanupGlobalConfig();
    assert.equal(fs.existsSync(configPath), false);

    delete process.env.STATE_globalConfigPath;
    assert.doesNotThrow(() => cleanupGlobalConfig());
  });
});
