const execa = require("execa");
const core = require("@actions/core");

// Exit code of `git config --unset-all` when the given key does not exist.
const GIT_CONFIG_KEY_NOT_FOUND = 5;

const exec = (file, options) => {
  core.info(`running command: ${file} ${(options || []).join(" ")}`);
  return execa.sync(file, options);
};

/**
 * Unsets a git config entry, ignoring the "key not found" case.
 *
 * The key is often absent (e.g. the checkout action did not store credentials there),
 * which is a normal situation and should not be reported as a warning.
 *
 * @param {string} scope - Config scope, e.g. "local" or "global".
 * @param {string} key - Config key to unset.
 * @param {string} [valuePattern] - Optional regex matching the values to unset.
 */
const unsetConfig = (scope, key, valuePattern) => {
  const args = ["config", `--${scope}`, "--unset-all", key];
  if (valuePattern !== undefined) {
    args.push(valuePattern);
  }
  try {
    exec("git", args);
  } catch (error) {
    if (error.exitCode !== GIT_CONFIG_KEY_NOT_FOUND) {
      core.warning(error.message);
    }
  }
};

module.exports = exec;
module.exports.unsetConfig = unsetConfig;
