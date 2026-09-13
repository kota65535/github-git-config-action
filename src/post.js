const { unsetConfig } = require("./exec");
const { getExtraHeaderKey, getUrlInsteadOfKey } = require("./input");

const run = (inputs) => {
  const githubHost = inputs.githubHost;
  const extraHeaderKey = getExtraHeaderKey(githubHost);
  const urlInsteadOfKey = getUrlInsteadOfKey(githubHost);
  unsetConfig(inputs.scope, extraHeaderKey, "^AUTHORIZATION: basic");
  unsetConfig(inputs.scope, urlInsteadOfKey, `git@${githubHost}:`);
};

module.exports = run;
