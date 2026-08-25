# Ecommerce Extraction

This example demonstrates destination fanout for an already-normalized Prompt
API observation.

The default configuration sends metadata capture to both:

- `console`
- a generic same-origin OTLP/HTTP JSON endpoint at `/otlp/v1/logs`

The OTLP endpoint is local test infrastructure served by `npm run examples`; it
does not represent a hosted service and does not require private browser
credentials.

Inspect the page for:

- the product extraction application result;
- active capture mode;
- configured destination mode;
- console and OTLP delivery states;
- the shared observation id used across destinations;
- Worker mode and operational status where available.

Run it with:

```sh
npm run build
npm run examples
```

Then open `http://127.0.0.1:4173/examples/ecommerce-extraction/`.

If an OTLP endpoint fails, the failure is shown as destination status and should
not change the application extraction result or console delivery.
