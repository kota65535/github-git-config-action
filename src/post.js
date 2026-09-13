import * as core from "@actions/core";
import exec from "./exec.js";
import { getExtraHeaderKey, getUrlInsteadOfKey } from "./input.js";

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

export default run;
