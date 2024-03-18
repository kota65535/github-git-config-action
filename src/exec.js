const { $ } = require("execa");
const core = require("@actions/core");

const exec = (file, options) => {
  core.info(`running command: ${file} ${(options || []).join(" ")}`);
  return $(options).sync(file);
};

module.exports = exec;
