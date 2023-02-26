const core = require("@actions/core");
const exec = require("./exec");

const getInputs = () => {
  const keys = exec("git help -c").split("\n");
  const configs = keys
    .map(core.getInput)
    .filter((v) => v)
    .reduce((a, v) => ({ ...a, [v]: v }), {});

  const scopes = core.getInput("scope").split(",");
  const ret = {
    configs,
    scopes,
  };
  console.info(ret);
  return ret;
};

module.exports = getInputs;
