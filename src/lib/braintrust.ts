import { initLogger, wrapAISDK } from "braintrust";
import * as ai from "ai";

let _generateObject: typeof ai.generateObject | null = null;

function init() {
  const apiKey = process.env.BRAINTRUST_API_KEY;
  if (apiKey) {
    initLogger({ projectName: "darwin-capital", apiKey });
    const wrapped = wrapAISDK(ai);
    _generateObject = wrapped.generateObject;
  } else {
    _generateObject = ai.generateObject;
  }
}

export function tracedGenerateObject(): typeof ai.generateObject {
  if (!_generateObject) init();
  return _generateObject!;
}
