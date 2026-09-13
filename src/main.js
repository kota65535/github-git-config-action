const exec = require("./exec");
const core = require("@actions/core");
const { getExtraHeaderKey, getUrlInsteadOfKey } = require("./input");
const { removeCheckoutCredentials } = require("./checkout-v6");
const { setupGlobalConfig } = require("./global-config");

function main(inputs) {
  // The "global" scope writes to a config file private to this job, via GIT_CONFIG_GLOBAL,
  // so that the token never reaches ~/.gitconfig. git still treats that file as the global
  // config, so the --global flag below is unchanged.
  const scope = inputs.scope;
  if (scope === "global") {
    setupGlobalConfig();
  }

  // Set configs from dynamic inputs
  for (const [k, v] of Object.entries(inputs.configs)) {
    exec("git", ["config", `--${scope}`, k, v]);
  }

  // Configure credentials if github-token input presents
  if (inputs.githubToken) {
    // cf. https://github.com/actions/checkout/blob/main/src/git-auth-helper.ts#L57
    const base64Token = Buffer.from(`x-access-token:${inputs.githubToken}`, "utf8").toString("base64");
    core.setSecret(base64Token);

    const githubHost = inputs.githubHost;
    const extraHeaderKey = getExtraHeaderKey(githubHost);
    const urlInsteadOfKey = getUrlInsteadOfKey(githubHost);
    const extraHeaderValue = `AUTHORIZATION: basic ${base64Token}`;
    const urlInsteadOfValue = `git@${githubHost}:`;

    // Remove checkout action's persistent credentials to avoid duplication of Authorization headers.
    // checkout v6+ stores credentials under RUNNER_TEMP and includes them via includeIf.
    removeCheckoutCredentials();

    // Remove checkout action's legacy local config (pre v6).
    // cf. https://github.com/actions/checkout/issues/162
    // Value pattern should be case-insensitive, but the current git version (2.36.1) does not allow the flag "(?i)".
    // So we have to use the exact pattern to match.
    // cf. https://github.com/actions/checkout/blob/main/src/git-auth-helper.ts#L62
    try {
      exec("git", ["config", "--local", "--unset-all", extraHeaderKey, "^AUTHORIZATION: basic"]);
    } catch (error) {
      core.warning(error.message);
    }

    exec("git", ["config", `--${scope}`, extraHeaderKey, extraHeaderValue]);
    exec("git", ["config", `--${scope}`, urlInsteadOfKey, urlInsteadOfValue]);
  }
}

module.exports = main;
