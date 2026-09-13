const core = require("@actions/core");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const exec = require("./exec");

const STATE_KEY = "globalConfigPath";

// GIT_CONFIG_GLOBAL was added in git 2.32 (2021-06-06). Older versions silently ignore it and fall
// back to ~/.gitconfig, which would leak the token to the host, so we refuse to run instead.
const MIN_GIT_VERSION = [2, 32, 0];

// Path of the file this module owns, once set up. Kept here rather than read back from the state,
// because saveState does not update the environment of the running process.
let configPath = null;

/**
 * Compares two semantic-ish version triples.
 *
 * @param {number[]} a - Version triple to compare.
 * @param {number[]} b - Version triple to compare against.
 * @returns {number} Negative if `a` is older than `b`, zero if equal, positive if newer.
 *
 * @example
 * compareVersions([2, 32, 0], [2, 39, 1]); // -1
 */
const compareVersions = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) {
      return diff < 0 ? -1 : 1;
    }
  }
  return 0;
};

/**
 * Parses the output of `git --version` into a version triple.
 *
 * Handles the platform-specific suffixes git appends, such as
 * `git version 2.39.3 (Apple Git-145)` or `git version 2.45.0.windows.1`.
 *
 * @param {string} stdout - Raw output of `git --version`.
 * @returns {number[]} Version triple, ex. `[2, 39, 3]`.
 * @throws {Error} If no version number can be found in the output.
 *
 * @example
 * parseGitVersion("git version 2.39.3 (Apple Git-145)"); // [2, 39, 3]
 */
const parseGitVersion = (stdout) => {
  const matched = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(stdout || "");
  if (!matched) {
    throw new Error(`could not parse git version from: ${stdout}`);
  }
  return [Number(matched[1]), Number(matched[2]), Number(matched[3] || 0)];
};

/**
 * Lists the config files the new global config should include, in the order git would read them.
 *
 * If GIT_CONFIG_GLOBAL is already set, that file is the current global config, so including it is
 * enough: whatever it already includes comes along. This is what makes running the action twice in
 * one job additive rather than destructive.
 *
 * Otherwise the two files git looks for are used. git reads the XDG one first and ~/.gitconfig
 * second, and the last value read wins, so the order is kept.
 * cf. https://git-scm.com/docs/git-config#FILES
 *
 * @returns {string[]} Absolute paths, which may or may not exist. git skips the missing ones.
 */
const listIncludePaths = () => {
  const existing = process.env.GIT_CONFIG_GLOBAL;
  if (existing) {
    return [existing];
  }
  const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return [path.join(xdgConfigHome, "git", "config"), path.join(os.homedir(), ".gitconfig")];
};

/**
 * Quotes a path for use as a git config value.
 *
 * git treats a backslash as an escape character even outside quotes, and would otherwise eat the
 * separators of a Windows path, so quote the value and escape what git escapes.
 *
 * @param {string} value - Path to quote.
 * @returns {string} Quoted and escaped value.
 *
 * @example
 * quoteConfigValue("C:\\Users\\runner\\.gitconfig"); // '"C:\\\\Users\\\\runner\\\\.gitconfig"'
 */
const quoteConfigValue = (value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * Points GIT_CONFIG_GLOBAL at a config file private to the current job.
 *
 * The file lives under RUNNER_TEMP with mode 0600, so the token written into it never reaches
 * ~/.gitconfig or .git/config. Because GIT_CONFIG_GLOBAL is exported through GITHUB_ENV, it only
 * applies to the remaining steps of this job: a later job on the same self-hosted runner starts
 * without it and reads the untouched ~/.gitconfig. Only the path is exported, never the token.
 *
 * git still treats the file as the global config, so callers keep using `git config --global`.
 *
 * @returns {string} Path of the created config file.
 * @throws {Error} If RUNNER_TEMP is unset, or git is older than 2.32.
 */
const setupGlobalConfig = () => {
  const runnerTemp = process.env.RUNNER_TEMP;
  if (!runnerTemp) {
    throw new Error('scope "global" requires the RUNNER_TEMP environment variable, but it is not set');
  }

  const { stdout } = exec("git", ["--version"]);
  const version = parseGitVersion(stdout);
  if (compareVersions(version, MIN_GIT_VERSION) < 0) {
    throw new Error(
      `scope "global" requires git ${MIN_GIT_VERSION.join(".")} or later for GIT_CONFIG_GLOBAL, ` +
        `but ${version.join(".")} is installed. ` +
        "Older versions would silently write the token to ~/.gitconfig, where a later job on the " +
        'same runner could read it. Upgrade git, or use scope "local" to write to .git/config.',
    );
  }

  // Pull in the config git was reading until now, so that settings the runner relies on, such as
  // the safe.directory entries written by the checkout action, keep working.
  const header = [
    "# Written by kota65535/github-git-config-action.",
    "# Includes the config that was in effect before, so that its settings are not lost.",
    "[include]",
    ...listIncludePaths().map((p) => `\tpath = ${quoteConfigValue(p)}`),
    "",
  ].join("\n");

  configPath = path.join(runnerTemp, `git-config-${crypto.randomUUID()}.config`);
  fs.writeFileSync(configPath, header, { mode: 0o600 });
  // writeFileSync applies the umask to the mode, so set it again to be sure.
  fs.chmodSync(configPath, 0o600);

  // Also updates process.env, so the git commands run later in this same process are covered.
  core.exportVariable("GIT_CONFIG_GLOBAL", configPath);
  core.saveState(STATE_KEY, configPath);
  core.info(`using a job-local global config: ${configPath}`);

  return configPath;
};

/**
 * Sets a config value without ever passing it on the command line.
 *
 * `git config` takes its value as an argument, which `ps` and process audit logs can capture, so
 * a random placeholder is written instead and then replaced inside the file. Letting git write
 * first means git decides the section layout and the escaping of the key.
 *
 * Only works for the job-local global config, whose path this module owns.
 *
 * @param {string} key - Git config key to set.
 * @param {(placeholder: string) => string} buildValue - Builds the value from the placeholder that
 *   stands in for the secret, ex. `` (p) => `AUTHORIZATION: basic ${p}` ``.
 * @param {string} secret - Value substituted for the placeholder once it is in the file.
 * @returns {void}
 * @throws {Error} If called before {@link setupGlobalConfig}, or if the placeholder is not found.
 */
const setSecretConfig = (key, buildValue, secret) => {
  if (!configPath) {
    throw new Error("setSecretConfig was called before the job-local global config was set up");
  }
  const placeholder = crypto.randomUUID();
  exec("git", ["config", "--global", key, buildValue(placeholder)]);

  const content = fs.readFileSync(configPath, "utf8");
  if (!content.includes(placeholder)) {
    throw new Error(`could not find the placeholder for "${key}" in ${configPath}`);
  }
  fs.writeFileSync(configPath, content.replace(placeholder, secret), { mode: 0o600 });
};

/**
 * Removes the config file created by {@link setupGlobalConfig}.
 *
 * Nothing leaks if this never runs: a cancelled or killed job leaves the file behind, but no later
 * job has GIT_CONFIG_GLOBAL pointing at it, and RUNNER_TEMP is cleared when the next job starts.
 *
 * @returns {void}
 */
const cleanupGlobalConfig = () => {
  const savedPath = core.getState(STATE_KEY);
  if (!savedPath) {
    return;
  }
  try {
    fs.rmSync(savedPath, { force: true });
    core.info(`removed the job-local global config: ${savedPath}`);
  } catch (error) {
    core.warning(error.message);
  }
};

module.exports = {
  setupGlobalConfig,
  setSecretConfig,
  cleanupGlobalConfig,
  listIncludePaths,
  quoteConfigValue,
  parseGitVersion,
  compareVersions,
};
