const core = require("@actions/core");
const exec = require("./exec");

const getInputs = () => {
  // Defined inputs
  const scope = core.getInput("scope");
  const githubToken = core.getInput("github-token");
  const githubHost = core.getInput("github-host");

  // Dynamic inputs
  const { stdout } = exec("git", ["help", "-c"]);
  const configs = stdout.split("\n").reduce((a, k) => {
    const v = core.getInput(k);
    if (!v) {
      return a;
    }
    return { ...a, [k]: v };
  }, {});

  const ret = {
    scope,
    githubToken,
    githubHost,
    configs,
  };
  console.info(ret);
  return ret;
};

const getExtraHeaderKey = (githubHost) => `http.https://${githubHost}/.extraHeader`;
const getUrlInsteadOfKey = (githubHost) => `url.https://${githubHost}/.insteadOf`;

module.exports = {
  getInputs,
  getExtraHeaderKey,
  getUrlInsteadOfKey,
};
