const core = require("@actions/core");
const exec = require("./exec");
const { getExtraHeaderKey, getUrlInsteadOfKey } = require("./input");

const run = (inputs) => {
  const githubHost = inputs.githubHost;
  const extraHeaderKey = getExtraHeaderKey(githubHost);
  const urlInsteadOfKey = getUrlInsteadOfKey(githubHost);
  try {
    exec("git", ["config", `--${inputs.scope}`, "--unset-all", extraHeaderKey, "^AUTHORIZATION: basic"]);
    exec("git", ["config", `--${inputs.scope}`, "--unset-all", urlInsteadOfKey, `git@${githubHost}:`]);
  } catch (error) {
    core.warning(error.message);
  }
};

module.exports = run;
