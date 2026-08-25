# ADR 0005: Capture and Privacy Model

## Status

Accepted for PoC release candidate

## Context

Browser AI telemetry can expose sensitive prompt input, model output, or private
document text if the SDK treats content as ordinary telemetry. The PoC requires
developers to control what leaves the page while preserving Prompt API behavior
and keeping the Functional Core deployment-neutral.

## Decision

The telemetry package exposes three capture modes: `metadata`, `redacted`, and
`full`.

`metadata` is the default. It allows operation identity, timing, runtime
summary, safe usage/context fields, stream summary, and character counts, but no
raw prompt, response, or generated chunk content. The Prompt API shell applies
this policy before Worker message construction.

`redacted` is explicit. It performs deterministic local transformation to
placeholder strings before content crosses the Worker boundary.

`full` is explicit. It permits prompt/response content in telemetry only when a
developer configures `capture: "full"`.

Invalid or unknown capture configuration resolves to `metadata`. No runtime
condition, Worker state, destination, or fallback path may escalate capture to a
more permissive mode.

## Consequences

The Worker protocol carries capture results as part of the normalized
observation input, but it never receives raw content in metadata mode. A
boundary validator rejects metadata observation messages with string
content-bearing fields.

Redaction remains deterministic and vendor-neutral for the PoC. It is not an AI
redaction service and does not introduce a policy language.

Full capture is useful for debugging and local examples, but it is deliberately
visible in API configuration and examples because it may export sensitive
content.
