# LLM client fixtures

These files are **byte-identical** captures of what the local OpenAI-compatible
server at `http://localhost:1234/v1` actually returns. They are the source of
truth for `src/lib/llm/client.spec.ts`. The `llmController` in
`src/lib/stores/llm.svelte.ts` defaults to this same base URL.

## Files

- `models.json` — response body of `GET /v1/models`.
- `chat-stream.sse` — raw SSE bytes of `POST /v1/chat/completions` with
  `stream: true`, sent for a single-turn `hi` prompt at `max_tokens: 20`.

## How they were captured

```sh
curl -s http://localhost:1234/v1/models \
  -o tests/fixtures/llm/models.json

curl -sN -X POST http://localhost:1234/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL",
       "messages":[{"role":"user","content":"hi"}],
       "max_tokens":20,"stream":true}' \
  --max-time 30 \
  -o tests/fixtures/llm/chat-stream.sse
```

## Refreshing

Re-run the commands above **only when intentionally refreshing the test
baseline** (e.g. the server changed, the model was upgraded, or the test
assertions need updating). The test file's hard-coded expected values are
derived from the current contents; a refresh requires updating both the
fixture and the test in the same commit.
