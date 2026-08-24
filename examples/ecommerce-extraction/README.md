# Ecommerce Extraction

This example demonstrates Slice 4 destination fanout for an already-normalized
Prompt API observation.

The default configuration sends metadata capture to both:

- `console`
- a generic same-origin OTLP/HTTP JSON endpoint at `/otlp/v1/logs`

The OTLP endpoint is local test infrastructure served by `npm run examples`; it
does not represent a hosted service and does not require private browser
credentials.

Run it with:

```sh
npm run build
npm run examples
```

Then open `http://127.0.0.1:4173/examples/ecommerce-extraction/`.
