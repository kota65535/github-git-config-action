const exec = require("./exec");
const core = require("@actions/core");

function main(inputs) {
  // Set configs from dynamic inputs
  for (const s of inputs.scopes) {
    for (const [k, v] of Object.entries(inputs.configs)) {
      exec("git", ["config", `--${s}`, k, v]);
    }
  }

  // Configure credentials if github-token input presents
  if (inputs.githubToken) {
    const base64Token = Buffer.from(`${inputs.githubToken}:`).toString("base64");
    core.setSecret(base64Token);
    for (const s of inputs.scopes) {
      exec("git", ["config", `--${s}`, "http.https://github.com/.extraheader", `Authorization: Basic ${base64Token}`]);
      exec("git", ["config", `--${s}`, "url.https://github.com/.insteadOf", "git@github.com:"]);
    }
  }
}

module.exports = main;
