const core = require("@actions/core");
const exec = require("./exec");

const getInputs = () => {
  const keys = exec("git config -c").split("\n")
  const configs = keys
      .map(core.getInput)
      .filter(v => v)
      .reduce((a, v) => ({ ...a, [v]: v }), {})

  const scopes = core.getInput("scope").split(",")
  return {
    configs,
    scopes
  }
}

module.exports = getInputs
