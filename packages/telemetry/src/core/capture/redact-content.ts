export type RedactContentInput = {
  input?: unknown;
  output?: unknown;
};

export type RedactedContent = {
  input?: string;
  output?: string;
  inputCharacters?: number;
  outputCharacters?: number;
  redactionSummary: string;
};

function textFromValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  return String(value);
}

function lengthOf(value: string | undefined): number | undefined {
  return value === undefined ? undefined : value.length;
}

export function redactText(value: unknown): string | undefined {
  const text = textFromValue(value);
  if (text === undefined) return undefined;
  return `[redacted ${text.length} chars]`;
}

export function redactContent(content: RedactContentInput): RedactedContent {
  const inputText = textFromValue(content.input);
  const outputText = textFromValue(content.output);
  const inputCharacters = lengthOf(inputText);
  const outputCharacters = lengthOf(outputText);
  const summaryParts: string[] = [];
  if (inputCharacters !== undefined) summaryParts.push(`input: ${inputCharacters} chars redacted`);
  if (outputCharacters !== undefined) summaryParts.push(`output: ${outputCharacters} chars redacted`);

  const result: RedactedContent = {
    redactionSummary: summaryParts.length > 0 ? summaryParts.join("; ") : "no content available to redact"
  };
  const input = redactText(inputText);
  const output = redactText(outputText);
  if (input !== undefined) result.input = input;
  if (output !== undefined) result.output = output;
  if (inputCharacters !== undefined) result.inputCharacters = inputCharacters;
  if (outputCharacters !== undefined) result.outputCharacters = outputCharacters;
  return result;
}
