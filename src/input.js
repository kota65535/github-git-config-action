const core = require("@actions/core");
const exec = require("./exec");

const getInputs = () => {
  const { stdout } = exec("git", ["help", "-c"]);
  const configs = stdout.split("\n").reduce((a, k) => {
    const v = core.getInput(k);
    if (!v) {
      return a;
    }
    return { ...a, [k]: v };
  }, {});

  const scopes = core.getInput("scope").split(",");
  const ret = {
    configs,
    scopes,
  };
  console.info(ret);
  return ret;
};

module.exports = getInputs;
