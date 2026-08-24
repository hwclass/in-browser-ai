export type CaptureMode = "metadata" | "redacted" | "full";

export type CaptureFailure = {
  mode: CaptureMode;
  reason: string;
};

export type MetadataCaptureResult = {
  mode: "metadata";
  inputCharacters?: number;
  outputCharacters?: number;
  failure?: CaptureFailure;
};

export type RedactedCaptureResult = {
  mode: "redacted";
  input?: string;
  output?: string;
  inputCharacters?: number;
  outputCharacters?: number;
  redactionSummary: string;
  failure?: CaptureFailure;
};

export type FullCaptureResult = {
  mode: "full";
  input?: string;
  output?: string;
  inputCharacters?: number;
  outputCharacters?: number;
  failure?: CaptureFailure;
};

export type CaptureResult = MetadataCaptureResult | RedactedCaptureResult | FullCaptureResult;
