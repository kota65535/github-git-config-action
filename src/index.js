import * as core from "@actions/core";
import main from "./main.js";
import { getInputs } from "./input.js";
import post from "./post.js";

const isPost = core.getState("isPost");

try {
  const inputs = getInputs();
  if (isPost) {
    // cleanup
    try {
      post(inputs);
    } catch (error) {
      core.setFailed(error.message);
    }
  } else {
    // main
    try {
      main(inputs);
    } catch (error) {
      core.setFailed(error.message);
    } finally {
      // cf. https://github.com/actions/checkout/blob/main/src/state-helper.ts
      core.saveState("isPost", "true");
    }
  }
} catch (error) {
  core.setFailed(error.message);
  if (!isPost) {
    // Ensure the post step still runs so that any config already set can be cleaned up.
    core.saveState("isPost", "true");
  }
}
