const core = require("@actions/core");
const exec = require("./exec");
const { getExtraHeaderKey, getUrlInsteadOfKey } = require("./input");
const { cleanupGlobalConfig } = require("./global-config");

const unset = (scope, key, valuePattern) => {
  try {
    exec("git", ["config", `--${scope}`, "--unset-all", key, valuePattern]);
  } catch (error) {
    core.warning(error.message);
  }
};

const run = (inputs) => {
  // The "global" scope keeps everything in a single throwaway file, so deleting it is the
  // whole cleanup.
  if (inputs.scope === "global") {
    cleanupGlobalConfig();
    return;
  }

  const githubHost = inputs.githubHost;
  // Unset each key on its own, so that a failure to unset one does not skip the rest.
  unset(inputs.scope, getExtraHeaderKey(githubHost), "^AUTHORIZATION: basic");
  unset(inputs.scope, getUrlInsteadOfKey(githubHost), `git@${githubHost}:`);
};

module.exports = run;
