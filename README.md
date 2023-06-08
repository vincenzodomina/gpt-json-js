This is an yet uncompleted, unofficial attempt to translate the awesome library [piercefreeman/gpt-json](https://github.com/piercefreeman/gpt-json) into TypeScript.

For now I only extracted the transformation of the completion response into valid JSON as I needed this feature only. Help with adding more features from the original library is welcome.

# GPT-JSON-JS: Generate Structured JSON from Language Models.

gpt-json-js is a wrapper around GPT- Responses that allows for declarative definition of expected output format. Set up a schema, write a prompt telling GPT to respond with data formatted like it, and get results back as parsable JSON object.

TLDR: GPT Response in -> JSON Object string out

Specifically this library:

- Allows GPT to respond with both single-objects and lists of objects
- Includes some lightweight transformations of the output to remove superfluous context and fix broken json

## Getting Started

```bash
npm install @vincenzodomina/gpt-json-js
```

```TypeScript
import { ResponseType, extractJsonFromCompletionResponse } from "gpt-json-js";

// gptResponse is the string response from GPT

const extractedJSON = extractJsonFromCompletionResponse(gptResponse, ResponseType.DICTIONARY);
if (extractedJSON?.meta_data) {
  console.log(`JSON has been fixed: Bools: ${extractedJSON?.meta_data?.fixed_bools}, FixType: ${extractedJSON?.meta_data?.fixed_truncation}`);
};
const parsedJson = JSON.parse(extractedJSON.result);
```

## Transformations

GPT (especially GPT-4) is relatively good at formatting responses at JSON, but it's not perfect. Some of the more common issues are:

- _Response truncation_: Since GPT is not internally aware of its response length limit, JSON payloads will sometimes exhaust the available token space. This results in a broken JSON payload where much of the data is valid but the JSON object is not closed, which is not valid syntax. There are many cases where this behavior is actually okay for production applications - for instance, if you list 100 generated strings, it's sometimes okay for you to take the 70 that actually rendered. In this case, `gpt-json` will attempt to fix the truncated payload by recreating the JSON object and closing it.
- _Boolean variables_: GPT will sometimes confuse valid JSON boolean values with the boolean tokens that are used in other languages. The most common is generating `True` instead of `true`. `gpt-json` will attempt to fix these values.

The first object is your generated JSON as a string. The second object is our correction storage object `FixTransforms`. This dataclass contains flags for each of the supported transformation cases that are sketched out above. This allows you to determine whether the response was explicitly parsed from the GPT JSON, or was passed through some middlelayers to get a correct output. From there you can accept or reject the response based on your own business logic.

_Where you can help_: There are certainly more areas of common (and not-so-common failures). If you see these, please add a test case to the unit tests. If you can write a handler to help solve the general case, please do so.

## Testing

_Where you can help_: Tests have to be set up still.

Our focus is on making unit tests as robust as possible. The variability with GPT should be in its language model, not in its JSON behavior! This is still certainly a work in progress. If you see an edge case that isn't covered, please add it to the test suite.

## Comparison to Other Libraries

A non-exhaustive list of other libraries that address the same problem. None of them were fully compatible with my deployment (hence this library), but check them out:

[jsonformer](https://github.com/1rgs/jsonformer) - Works with any Huggingface model, whereas `gpt-json` is specifically tailored towards the GPT-X family. GPT doesn't output logit probabilities or allow fixed decoder templating so the same approach can't apply.

## License

gpt-json-js is released under the MIT License. You are free to use, modify, and distribute this software for any purpose, commercial or non-commercial, as long as the original copyright and license notice are included.
