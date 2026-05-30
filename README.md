# @weiseer/status-aggregator-mcp

> Cross-vendor SaaS status as a stdio MCP server. For AI agents deciding retry/fallback.

Probe **P-003** by [weiseer](https://github.com/weiseer).

## What it does

Aggregates the status pages of 14+ SaaS providers AI agents depend on (Anthropic, OpenAI, Google AI, Mistral, GitHub, npm, Cloudflare, AWS, Vercel, Netlify, Render, Stripe, Algolia, Linear) into one MCP server.

Your agent can:
- `list_services` — list monitored providers + last-known status
- `get_status` — full status for one provider with cited status-page URL
- `get_incidents_today` — active incidents across all
- `check_all` — quick health summary (counts by status)

## Why use this instead of your agent fetching each status page

| | Agent DIY (per call) | status-aggregator |
|---|---|---|
| Status pages to fetch | 14 individual API calls | 1 MCP call |
| Token cost | $0.05-0.15 | $0 free / $0.00005 paid |
| Latency | 3-8 seconds | <100ms |
| Schema normalization | Per-vendor parsing | Pre-normalized |

## Install

```bash
npm install -g @weiseer/status-aggregator-mcp
```

## Use with Claude Desktop / Cursor / Cline / Continue / Windsurf

```json
{
  "mcpServers": {
    "status-aggregator": {
      "command": "npx",
      "args": ["-y", "@weiseer/status-aggregator-mcp"]
    }
  }
}
```

## Environment

- `STATUS_AGG_URL` — override remote snapshot URL
- `STATUS_AGG_LOCAL_ONLY=1` — skip remote fetch

## Related weiseer services

- `@weiseer/llm-oracle-mcp` — LLM pricing + availability oracle
- `@weiseer/bounty-mcp` — live coding-bounty deal-flow
- `@weiseer/api-changelog-mcp` — SDK breaking-change tracker
- github.com/weiseer — all weiseer services

## License

Apache-2.0
