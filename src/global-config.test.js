const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const {
  setupGlobalConfig,
  setSecretConfig,
  cleanupGlobalConfig,
  listIncludePaths,
  quoteConfigValue,
  parseGitVersion,
  compareVersions,
} = require("./global-config");

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
    const expected = quoteConfigValue(path.join(os.homedir(), ".gitconfig"));
    assert.ok(fs.readFileSync(configPath, "utf8").includes(`\tpath = ${expected}`));

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

test("listIncludePaths chains an existing GIT_CONFIG_GLOBAL", () => {
  withRunnerTemp(() => {
    // Running the action twice in one job must be additive: the second run has to include the
    // file the first one set up, or everything the first one wrote disappears.
    process.env.GIT_CONFIG_GLOBAL = "/tmp/set-by-an-earlier-run.config";
    assert.deepEqual(listIncludePaths(), ["/tmp/set-by-an-earlier-run.config"]);
  });
});

test("listIncludePaths follows git's own order and honours XDG_CONFIG_HOME", () => {
  withRunnerTemp(() => {
    process.env.XDG_CONFIG_HOME = "/custom/xdg";
    // git reads the XDG file first and ~/.gitconfig second, and the last value read wins.
    assert.deepEqual(listIncludePaths(), ["/custom/xdg/git/config", path.join(os.homedir(), ".gitconfig")]);

    delete process.env.XDG_CONFIG_HOME;
    assert.deepEqual(listIncludePaths(), [
      path.join(os.homedir(), ".config", "git", "config"),
      path.join(os.homedir(), ".gitconfig"),
    ]);
  });
});

test("quoteConfigValue escapes what git treats as escapes", () => {
  assert.equal(quoteConfigValue("/home/runner/.gitconfig"), '"/home/runner/.gitconfig"');
  // A Windows path would otherwise lose its separators.
  assert.equal(quoteConfigValue("C:\\Users\\runner\\.gitconfig"), '"C:\\\\Users\\\\runner\\\\.gitconfig"');
});

test("setupGlobalConfig keeps the included config readable", () => {
  withRunnerTemp((runnerTemp) => {
    const included = path.join(runnerTemp, "included.config");
    fs.writeFileSync(included, "[user]\n\tname = from the included file\n");
    process.env.GIT_CONFIG_GLOBAL = included;

    setupGlobalConfig();
    // A scope flag makes git read that single file and skip its includes, so read without one,
    // the way git does when it actually needs the value. runnerTemp is not a repository, so
    // nothing local can interfere.
    const name = execFileSync("git", ["-C", runnerTemp, "config", "user.name"], { encoding: "utf8" }).trim();
    assert.equal(name, "from the included file");
  });
});

test("setSecretConfig writes the value without putting it on the command line", () => {
  withRunnerTemp(() => {
    const configPath = setupGlobalConfig();
    const secret = "s3cr3t-token-value";
    setSecretConfig("http.https://github.com/.extraHeader", (p) => `AUTHORIZATION: basic ${p}`, secret);

    const stored = execFileSync("git", ["config", "--global", "http.https://github.com/.extraHeader"], {
      encoding: "utf8",
    }).trim();
    // This key is written directly into the file, so reading it with --global is fine.
    assert.equal(stored, `AUTHORIZATION: basic ${secret}`);
    // The placeholder is a UUID, so no leftover of it may remain in the file.
    assert.doesNotMatch(fs.readFileSync(configPath, "utf8"), /[0-9a-f]{8}-[0-9a-f]{4}-/);
    if (process.platform !== "win32") {
      assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
    }
  });
});

test("setSecretConfig refuses to run before setup", () => {
  withRunnerTemp(() => {
    // The module remembers the path from the previous test, so only the message is checked here
    // when it is already set up. Reset it by requiring a fresh copy of the module.
    delete require.cache[require.resolve("./global-config")];
    const fresh = require("./global-config");
    assert.throws(() => fresh.setSecretConfig("user.name", (p) => p, "x"), /before the job-local global config/);
    delete require.cache[require.resolve("./global-config")];
  });
});
