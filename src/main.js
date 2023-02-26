const exec = require("./exec");

const main = (inputs) => {
  for (const s of inputs.scopes) {
    for (const [k, v] of Object.entries(inputs.configs)) {
      const cmd = `git config --${s} '${k}'='${v}'`;
      console.info(cmd);
      exec(cmd);
    }
  }
};

module.exports = main;
