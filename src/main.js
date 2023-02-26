const exec = require("./exec");

const main = (inputs) => {
  for (const s of inputs.scopes) {
    for (const [k, v] of Object.entries(inputs.configs)) {
      exec("git", ["config", `--${s}`, k, v]);
    }
  }
};

module.exports = main;
