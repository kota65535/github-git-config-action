const shelljsExec = require("shelljs.exec");
const core = require("@actions/core");

const exec = (cmd) => {
  core.info(`running command: ${cmd}`);
  const res = shelljsExec(cmd);
  if (res.code !== 0) {
    core.warning(res.stdout);
    throw new Error(`command: ${cmd} returned ${res.code}`);
  }
  return res.stdout
};

module.exports = exec;
