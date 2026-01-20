const core = require("@actions/core");
const path = require("path");
const exec = require("./exec");

const CHECKOUT_CREDENTIALS_PREFIX = "git-credentials-";
const CHECKOUT_CREDENTIALS_SUFFIX = ".config";
const INCLUDE_IF_KEY_REGEX = "^includeIf\\.gitdir:.*\\.path$";

const isWithin = (root, candidate) => {
  if (!root || !candidate) return false;
  const rel = path.relative(root, candidate);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
};

const isCheckoutCredentialsPath = (value) => {
  if (!value) {
    return false;
  }
  const normalized = path.normalize(value);
  const baseName = path.basename(normalized);
  if (!baseName.startsWith(CHECKOUT_CREDENTIALS_PREFIX) || !baseName.endsWith(CHECKOUT_CREDENTIALS_SUFFIX)) {
    return false;
  }
  return isWithin(process.env.RUNNER_TEMP, normalized);
};

const listIncludeIfPaths = () => {
  try {
    const { stdout } = exec("git", ["config", "--null", "--local", "--get-regexp", INCLUDE_IF_KEY_REGEX]);
    if (!stdout) {
      return [];
    }
    const lines = stdout.split("\0").filter(Boolean);
    const entries = [];
    for (const line of lines) {
      const parts = line.split("\n");
      entries.push({ key: parts[0], value: parts[1] });
    }
    return entries;
  } catch (error) {
    if (error.exitCode === 1) {
      return [];
    }
    core.warning(error.message);
    return [];
  }
};

const removeCheckoutV6Credentials = () => {
  const entries = listIncludeIfPaths();
  for (const { key, value } of entries) {
    if (!isCheckoutCredentialsPath(value)) {
      continue;
    }
    try {
      exec("git", ["config", "--local", "--unset-all", key]);
    } catch (error) {
      core.warning(error.message);
    }
  }
};

module.exports = { removeCheckoutCredentials: removeCheckoutV6Credentials };
