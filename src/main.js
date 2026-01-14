const exec = require("./exec");
const core = require("@actions/core");
const { getExtraHeaderKey, getUrlInsteadOfKey } = require("./input");

function main(inputs) {
  // Set configs from dynamic inputs
  for (const [k, v] of Object.entries(inputs.configs)) {
    exec("git", ["config", `--${inputs.scope}`, k, v]);
  }

  // Configure credentials if github-token input presents
  if (inputs.githubToken) {
    // cf. https://github.com/actions/checkout/blob/main/src/git-auth-helper.ts#L57
    const base64Token = Buffer.from(`x-access-token:${inputs.githubToken}`, "utf8").toString("base64");
    core.setSecret(base64Token);

    const githubHost = inputs.githubHost;
    const extraHeaderKey = getExtraHeaderKey(githubHost);
    const urlInsteadOfKey = getUrlInsteadOfKey(githubHost);

    // Remove checkout action's persistent credentials to avoid duplication of Authorization headers.
    // cf. https://github.com/actions/checkout/issues/162
    // Value pattern should be case-insensitive, but the current git version (2.36.1) does not allow the flag "(?i)".
    // So we have to use the exact pattern to match.
    // cf. https://github.com/actions/checkout/blob/main/src/git-auth-helper.ts#L62
    try {
      exec("git", ["config", "--local", "--unset-all", extraHeaderKey, "^AUTHORIZATION: basic"]);
    } catch (error) {
      core.warning(error.message);
    }

    exec("git", ["config", `--${inputs.scope}`, extraHeaderKey, `AUTHORIZATION: basic ${base64Token}`]);
    exec("git", ["config", `--${inputs.scope}`, urlInsteadOfKey, `git@${githubHost}:`]);
  }
}

module.exports = main;
