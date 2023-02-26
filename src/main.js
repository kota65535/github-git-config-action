const exec = require("./exec");

function main(inputs) {
  for (const s of inputs.scopes) {
    for (const [k, v] of Object.entries(inputs.configs)) {
      exec("git", ["config", `--${s}`, k, v]);
    }
  }
  configureGitHubToken(inputs.githubToken);
}

function configureGitHubToken(inputs) {
  if (!inputs.githubToken) {
    return;
  }

  const base64Token = Buffer.from(`${inputs.githubToken}:`).toString("base64");

  for (const s of inputs.scopes) {
    exec("git", ["config", `--${s}`, "http.https://github.com/.extraheader", `Authorization: Basic ${base64Token}`]);
    exec("git", ["config", `--${s}`, "url.https://github.com/.insteadOf", "git@github.com:"]);
  }
}

module.exports = main;
