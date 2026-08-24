import assert from "assert";
import { observePromptApi } from "../../dist/src/public/index.js";

function createConsoleSink() {
  const observations = [];
  return {
    destination: { type: "console", write: (observation) => observations.push(observation) },
    observations
  };
}

function createClock(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(String(chunk));
  }
  return chunks;
}

const successSink = createConsoleSink();
const successSession = {
  usage: { outputTokens: 3 },
  promptStreaming(input) {
    assert.equal(input, "stream please");
    return (async function* () {
      yield "alpha";
      yield "-";
      yield "omega";
    })();
  }
};

const successController = observePromptApi({
  session: successSession,
  destinations: [successSink.destination],
  runtime: { availability: "available", streamingSupport: "supported" },
  now: createClock([100, 120, 130, 150, 175])
});

const successChunks = await collect(successController.promptStreaming("stream please"));
assert.deepEqual(successChunks, ["alpha", "-", "omega"]);
assert.equal(successSink.observations.length, 1);
assert.equal(successSink.observations[0].operation, "promptStreaming");
assert.equal(successSink.observations[0].outcome, "success");
assert.equal(successSink.observations[0].timeToFirstOutputMs, 20);
assert.equal(successSink.observations[0].durationMs, 75);
assert.deepEqual(successSink.observations[0].stream, { outputCount: 3, producedOutput: true });
assert.equal("input" in successSink.observations[0], false);
assert.equal("output" in successSink.observations[0], false);
assert.equal("chunks" in successSink.observations[0], false);

const noOutputSink = createConsoleSink();
const noOutputController = observePromptApi({
  session: {
    promptStreaming() {
      return (async function* () {})();
    }
  },
  destinations: [noOutputSink.destination],
  runtime: { availability: "available", streamingSupport: "supported" },
  now: createClock([200, 240])
});
assert.deepEqual(await collect(noOutputController.promptStreaming("empty")), []);
assert.equal(noOutputSink.observations[0].timeToFirstOutputMs, undefined);
assert.deepEqual(noOutputSink.observations[0].stream, { outputCount: 0, producedOutput: false });

const streamError = new TypeError("stream failed");
const errorSink = createConsoleSink();
const errorController = observePromptApi({
  session: {
    promptStreaming() {
      return (async function* () {
        yield "before";
        throw streamError;
      })();
    }
  },
  destinations: [errorSink.destination],
  runtime: { availability: "available", streamingSupport: "supported" },
  now: createClock([300, 315, 340])
});
await assert.rejects(async () => collect(errorController.promptStreaming("fail")), streamError);
assert.equal(errorSink.observations[0].outcome, "error");
assert.equal(errorSink.observations[0].error.name, "TypeError");
assert.deepEqual(errorSink.observations[0].stream, { outputCount: 1, producedOutput: true });

const cancelSink = createConsoleSink();
const cancelController = observePromptApi({
  session: {
    promptStreaming() {
      return (async function* () {
        yield "first";
        yield "second";
      })();
    }
  },
  destinations: [cancelSink.destination],
  runtime: { availability: "available", streamingSupport: "supported" },
  now: createClock([400, 420, 430])
});
const iterator = cancelController.promptStreaming("cancel")[Symbol.asyncIterator]();
assert.equal((await iterator.next()).value, "first");
await iterator.return?.();
assert.equal(cancelSink.observations[0].outcome, "cancelled");
assert.deepEqual(cancelSink.observations[0].stream, { outputCount: 1, producedOutput: true });
