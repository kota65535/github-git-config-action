const core = require("@actions/core");
const fs = require("fs");
const path = require("path");
const exec = require("./exec");

const CHECKOUT_CREDENTIALS_PREFIX = "git-credentials-";
const CHECKOUT_CREDENTIALS_SUFFIX = ".config";

const normalizePath = (value) => {
  if (!value) {
    return "";
  }
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
};

const isWithin = (root, candidate) => {
  if (!root || !candidate) {
    return false;
  }
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return candidate === root || candidate.startsWith(rootWithSep);
};

const isCheckoutCredentialsPath = (value) => {
  if (!value) {
    return false;
  }
  const normalized = normalizePath(value);
  const baseName = path.basename(normalized);
  if (!baseName.startsWith(CHECKOUT_CREDENTIALS_PREFIX) || !baseName.endsWith(CHECKOUT_CREDENTIALS_SUFFIX)) {
    return false;
  }

  const runnerTemp = process.env.RUNNER_TEMP ? normalizePath(process.env.RUNNER_TEMP) : "";
  const containerTemp = normalizePath("/github/runner_temp");

  if (runnerTemp && isWithin(runnerTemp, normalized)) {
    return true;
  }
  return isWithin(containerTemp, normalized);
};

const listIncludeIfPaths = () => {
  try {
    const { stdout } = exec("git", ["config", "--null", "--local", "--get-regexp", "^includeIf\\.gitdir:.*\\.path$"]);
    if (!stdout) {
      return [];
    }
    const parts = stdout.split("\0").filter(Boolean);
    const entries = [];
    for (let i = 0; i < parts.length; i += 2) {
      entries.push({ key: parts[i], value: parts[i + 1] || "" });
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

const listCheckoutCredentialsPaths = () => {
  const entries = listIncludeIfPaths();
  if (entries.length === 0) {
    return [];
  }

  const credentialPaths = new Set();
  for (const { value } of entries) {
    if (!isCheckoutCredentialsPath(value)) {
      continue;
    }
    if (value) {
      credentialPaths.add(value);
    }
  }

  return [...credentialPaths];
};

const canWriteCredentialsPath = (filePath) => {
  const dirPath = path.dirname(filePath);
  return fs.existsSync(dirPath);
};

const setConfigInFile = (filePath, key, value) => {
  try {
    exec("git", ["config", "--file", filePath, "--unset-all", key]);
  } catch (error) {
    if (error.exitCode !== 5 && error.exitCode !== 1) {
      core.warning(error.message);
    }
  }

  exec("git", ["config", "--file", filePath, key, value]);
};

const configureCheckoutV6Credentials = (extraHeaderKey, extraHeaderValue, urlInsteadOfKey, urlInsteadOfValue) => {
  const credentialPaths = listCheckoutCredentialsPaths();
  if (credentialPaths.length === 0) {
    return false;
  }

  let configured = false;
  for (const filePath of credentialPaths) {
    if (!isCheckoutCredentialsPath(filePath)) {
      continue;
    }
    if (!canWriteCredentialsPath(filePath)) {
      core.warning(`credentials path is not writable: ${filePath}`);
      continue;
    }
    try {
      setConfigInFile(filePath, extraHeaderKey, extraHeaderValue);
      setConfigInFile(filePath, urlInsteadOfKey, urlInsteadOfValue);
      configured = true;
    } catch (error) {
      core.warning(error.message);
    }
  }

  return configured;
};

module.exports = { configureCheckoutCredentials: configureCheckoutV6Credentials };
