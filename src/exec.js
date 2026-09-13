import execa from "execa";
import * as core from "@actions/core";

const exec = (file, options) => {
  core.info(`running command: ${file} ${(options || []).join(" ")}`);
  return execa.sync(file, options);
};

export default exec;
