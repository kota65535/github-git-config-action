const core = require("@actions/core");
const yaml = require("js-yaml");

/**
 * Flattens a parsed config object into dotted git config keys.
 *
 * Both dotted keys (`user.name: foo`) and nested keys (`user: {name: foo}`) are accepted,
 * so `{ "user.name": "foo" }` and `{ user: { name: "foo" } }` yield the same result.
 *
 * @param {object} obj - Object to flatten.
 * @param {string} prefix - Key prefix accumulated from the parent levels.
 * @param {object} out - Accumulator holding the flattened entries.
 * @returns {object} Mapping of git config key to its string value.
 * @throws {Error} If a value is empty, or is an array.
 */
const flatten = (obj, prefix, out) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) {
      throw new Error(`config: value of "${key}" is empty`);
    }
    if (Array.isArray(v)) {
      throw new Error(`config: value of "${key}" must be a scalar, but an array is given`);
    }
    if (typeof v === "object" && !(v instanceof Date)) {
      flatten(v, key, out);
      continue;
    }
    out[key] = String(v);
  }
  return out;
};

/**
 * Parses the `config` input.
 *
 * @param {string} raw - Raw YAML text given to the `config` input.
 * @returns {object} Mapping of git config key to its string value. Empty if the input is unset.
 * @throws {Error} If the input is not valid YAML, or is not a mapping.
 */
const parseConfig = (raw) => {
  if (!raw.trim()) {
    return {};
  }
  let doc;
  try {
    doc = yaml.load(raw);
  } catch (error) {
    throw new Error(`config: invalid YAML: ${error.message}`);
  }
  if (doc === null || doc === undefined) {
    return {};
  }
  if (typeof doc !== "object" || Array.isArray(doc)) {
    throw new Error("config: must be a mapping of git config keys to values");
  }
  return flatten(doc, "", {});
};

const getInputs = () => {
  const scope = core.getInput("scope");
  const githubToken = core.getInput("github-token");
  const githubHost = core.getInput("github-host");
  const configs = parseConfig(core.getInput("config"));

  const ret = {
    scope,
    githubToken,
    githubHost,
    configs,
  };
  // Never log the token itself.
  console.info({ ...ret, githubToken: githubToken ? "***" : "" });
  return ret;
};

const getExtraHeaderKey = (githubHost) => `http.https://${githubHost}/.extraHeader`;
const getUrlInsteadOfKey = (githubHost) => `url.https://${githubHost}/.insteadOf`;

module.exports = {
  getInputs,
  parseConfig,
  getExtraHeaderKey,
  getUrlInsteadOfKey,
};
