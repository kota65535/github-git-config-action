const core = require("@actions/core");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const exec = require("./exec");

const STATE_KEY = "globalConfigPath";

// GIT_CONFIG_GLOBAL was added in git 2.32 (2021-06-06). Older versions silently ignore it and fall
// back to ~/.gitconfig, which would leak the token to the host, so we refuse to run instead.
const MIN_GIT_VERSION = [2, 32, 0];

// Pull in the pre-existing global config so that settings the runner relies on (safe.directory
// written by the checkout action, for one) keep working once we take over GIT_CONFIG_GLOBAL.
// git expands "~" itself, and silently skips include paths that do not exist.
const INCLUDE_HEADER = [
  "# Written by kota65535/github-git-config-action.",
  "# Includes the pre-existing global config so that its settings are not lost.",
  "[include]",
  "\tpath = ~/.gitconfig",
  "\tpath = ~/.config/git/config",
  "",
].join("\n");

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
 * Points GIT_CONFIG_GLOBAL at a config file private to the current job.
 *
 * The file lives under RUNNER_TEMP with mode 0600, so the token written into it never reaches
 * ~/.gitconfig or .git/config. Because GIT_CONFIG_GLOBAL is exported through GITHUB_ENV, it only
 * applies to the remaining steps of this job: a later job on the same self-hosted runner starts
 * without it and reads the untouched ~/.gitconfig. Only the path, never the token, is exposed to
 * the process environment.
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

  const configPath = path.join(runnerTemp, `git-config-${crypto.randomUUID()}.config`);
  fs.writeFileSync(configPath, INCLUDE_HEADER, { mode: 0o600 });
  // writeFileSync applies the umask to the mode, so set it again to be sure.
  fs.chmodSync(configPath, 0o600);

  // Also updates process.env, so the git commands run later in this same process are covered.
  core.exportVariable("GIT_CONFIG_GLOBAL", configPath);
  core.saveState(STATE_KEY, configPath);
  core.info(`using a job-local global config: ${configPath}`);

  return configPath;
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
  const configPath = core.getState(STATE_KEY);
  if (!configPath) {
    return;
  }
  try {
    fs.rmSync(configPath, { force: true });
    core.info(`removed the job-local global config: ${configPath}`);
  } catch (error) {
    core.warning(error.message);
  }
};

module.exports = { setupGlobalConfig, cleanupGlobalConfig, parseGitVersion, compareVersions };
