const exec = require("./exec");

const main = (inputs) => {
  for (const s of inputs.scopes) {
    for (const c of inputs.configs) {
      const cmd = `git config --${s} ${c}`
      console.info(cmd)
      exec(cmd)
    }
  }
};

module.exports = main;
