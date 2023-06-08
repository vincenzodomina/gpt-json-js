export enum ResponseType {
  DICTIONARY = "DICTIONARY",
  LIST = "LIST"
}

class FixTransforms {
  constructor(public fixed_bools: boolean, public fixed_truncation: JsonFixEnum | null) { }
}

export enum JsonFixEnum {
  UNCLOSED_OBJECT = "unclosed_object",
  UNCLOSED_KEY = "unclosed_key",
  UNCLOSED_VALUE = "unclosed_value",
  MISSING_VALUE = "missing_value"
}

const listRegEx = /(\[[^\]]*$|\[.*\])/gs;
const dictRegEx = /({[^}]*$|{.*})/gs;

export function extractJsonFromCompletionResponse(completion_response: string, extract_type: ResponseType): { result: string, meta_data: FixTransforms | null } {
  let result: string = '';
  let meta_data: FixTransforms | null = null;

  const sanitizedCompletionResponse: string = completion_response.trim();
  if (sanitizedCompletionResponse === '') {
    return { result, meta_data };
  }

  const extracted_response = find_json_response(sanitizedCompletionResponse, extract_type);
  if (!extracted_response) {
    return { result, meta_data };
  }

  let [fixed_response, fixed_truncation] = fix_truncated_json(extracted_response);
  const [final_response, fixed_bools] = fix_bools(fixed_response);
  
  result = final_response;
  meta_data = new FixTransforms(fixed_bools, fixed_truncation);

  try {
    return { result, meta_data };
  } catch (e) {
    console.debug(`Extracted: ${extracted_response}`);
    console.debug(`Did parse: ${final_response}`);
    throw new Error(`JSON decode error, likely malformed json input: ${e}`);
  }
}

function find_json_response(full_response: string, extract_type: ResponseType): string | null {
  let extracted_responses: RegExpMatchArray | null;

  switch (extract_type) {
    case ResponseType.LIST:
      extracted_responses = full_response.match(listRegEx);
      break;
    case ResponseType.DICTIONARY:
      extracted_responses = full_response.match(dictRegEx);
      break;
    default:
      throw new Error(`Unknown extract_type: ${extract_type}`);
  }

  if (!extracted_responses) {
    console.log(`Unable to find any responses of the matching type \`${extract_type}\`: \`${full_response}\``);
    return null;
  }

  if (extracted_responses.length > 1) {
    console.log("Unexpected response > 1, continuing anyway...", extracted_responses);
  }

  const extracted_response: string = extracted_responses[0];

  return is_truncated(extracted_response)
    ? full_response.slice(extracted_response.indexOf(extracted_response))
    : extracted_response;
}

function build_stack(json_str: string): [string[], string, boolean, string | null] {
  let stack: string[] = [];
  let fixed_str: string = "";
  let open_quotes: boolean = false;
  let last_seen_comma_or_colon: string | null = null;

  for (let i = 0; i < json_str.length; i++) {
    let char = json_str[i];
    if (!open_quotes) {
      if (char === '{' || char === '[') {
        stack.push(char);
        last_seen_comma_or_colon = null;
      } else if (char === '}' || char === ']') {
        stack.pop();
        last_seen_comma_or_colon = null;
      }
      if (char === ',' || char === ':') {
        last_seen_comma_or_colon = char;
      }
    }
    if (char === '"' && i > 0 && json_str[i - 1] !== '\\') {
      open_quotes = !open_quotes;
    }
    fixed_str += char;
  }
  return [stack, fixed_str, open_quotes, last_seen_comma_or_colon];
}

function _is_missing_dict_value(stack: string[], fixed_str: string, open_quotes: boolean, last_seen_comma_or_colon: string | null): boolean {
  let inside_dict: boolean = stack.length > 0 && stack[stack.length - 1] === '{';
  let inside_dict_key: boolean = inside_dict && open_quotes && last_seen_comma_or_colon !== ':';
  let just_before_dict_value: boolean = inside_dict && !open_quotes && last_seen_comma_or_colon === ':';
  let just_closed_dict_key: boolean = inside_dict && !open_quotes && fixed_str.trim().slice(-1) === '"';
  let just_closed_dict_value: boolean = inside_dict && !open_quotes && fixed_str.trim().slice(-1) === '"' && last_seen_comma_or_colon === ':';
  let missing_dict_value: boolean = (inside_dict_key || just_before_dict_value || just_closed_dict_key) && !just_closed_dict_value;
  return missing_dict_value;
}

function is_truncated(json_str: string): boolean {
  let [stack] = build_stack(json_str);
  return stack.length > 0;
}

function fix_truncated_json(json_str: string): [string, JsonFixEnum | null] {
  let [stack, fixed_str, open_quotes, last_seen_colon_or_comma] = build_stack(json_str);
  let missing_value = _is_missing_dict_value(stack, fixed_str, open_quotes, last_seen_colon_or_comma);
  let is_truncated: boolean = stack.length > 0;
  if (!is_truncated) {
    return [json_str, null];
  }
  fixed_str = fixed_str.trim();
  if (open_quotes) {
    fixed_str += '"';
  }
  if (missing_value) {
    fixed_str = fixed_str.replace(/:$/g, ': null');
  }
  fixed_str = fixed_str.replace(/,$/g, '');
  if (stack.length > 0) {
    let close_stack = stack.map((char) => char === '[' ? ']' : '}');
    fixed_str += close_stack.reverse().join('');
  }

  let fix: JsonFixEnum = JsonFixEnum.UNCLOSED_OBJECT;
  if (open_quotes) {
    fix = missing_value ? JsonFixEnum.UNCLOSED_KEY : JsonFixEnum.UNCLOSED_VALUE;
  } else if (missing_value) {
    fix = JsonFixEnum.MISSING_VALUE;
  }

  return [fixed_str, fix];
}

function fix_bools(json_str: string): [string, boolean] {
  let modified: boolean = false;
  let open_quotes: boolean = false;
  let fixed_str: string = "";

  let i = 0;
  while (i < json_str.length) {
    let char = json_str[i];
    if (char === '"' && i > 0 && json_str[i - 1] !== '\\') {
      open_quotes = !open_quotes;
    }
    if (!open_quotes) {
      if (json_str.substring(i, i + 4) === "True") {
        fixed_str += "true";
        modified = true;
        i += 3;
      } else if (json_str.substring(i, i + 5) === "False") {
        fixed_str += "false";
        modified = true;
        i += 4;
      } else {
        fixed_str += char;
      }
    } else {
      fixed_str += char;
    }
    i += 1;
  }
  return [fixed_str, modified];
}
