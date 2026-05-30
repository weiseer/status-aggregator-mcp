#!/usr/bin/env node
/**
 * @weiseer/status-aggregator-mcp
 * Cross-vendor SaaS status aggregator. Probe P-003.
 * License: Apache-2.0
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLED_PATH = join(__dirname, "services.json");
const REMOTE_URL = process.env.STATUS_AGG_URL || "https://oracle.weiseer.com/status_agg.json";
const LOCAL_ONLY = !!process.env.STATUS_AGG_LOCAL_ONLY;
const CACHE_TTL_MS = 60 * 1000;

let _c = null, _t = 0;
async function load() {
  const now = Date.now();
  if (_c && now - _t < CACHE_TTL_MS) return _c;
  if (!LOCAL_ONLY) {
    try {
      const ctrl = new AbortController();
      const tt = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(REMOTE_URL, { signal: ctrl.signal });
      clearTimeout(tt);
      if (r.ok) { _c = await r.json(); _c._source = "remote"; _t = now; return _c; }
    } catch {}
  }
  _c = JSON.parse(readFileSync(BUNDLED_PATH, "utf-8"));
  _c._source = "bundled"; _t = now;
  return _c;
}
function _prov(d) { return { snapshot_as_of: d.as_of, snapshot_source: d._source, served_by: "weiseer/status-aggregator", served_at: new Date().toISOString() }; }
function _related() { return {
  llm_routing:   "npx -y @weiseer/llm-oracle-mcp  (LLM pricing + availability)",
  bounty_market: "npx -y @weiseer/bounty-mcp  (live coding-bounty deal-flow)",
  api_changelog: "npx -y @weiseer/api-changelog-mcp  (SDK breaking-change tracker)",
  org_index:     "https://github.com/weiseer  (all weiseer services + status)"
}; }

async function listServices({ category, current_status } = {}) {
  const d = await load();
  let s = d.services || [];
  if (category) s = s.filter(x => x.category === category);
  if (current_status) s = s.filter(x => x.last_known_status === current_status);
  return { ..._prov(d), count: s.length, services: s, related_services: _related() };
}
async function getStatus({ service_id }) {
  if (!service_id) return { error: "service_id required" };
  const d = await load();
  const s = (d.services || []).find(x => x.service_id === service_id);
  if (!s) return { error: `service_id '${service_id}' not found`, available: (d.services || []).map(x => x.service_id) };
  return { ...s, ..._prov(d) };
}
async function getIncidentsToday() {
  const d = await load();
  return { ..._prov(d), count: (d.incidents_today || []).length, incidents: d.incidents_today || [], related_services: _related() };
}
async function checkAll({ category } = {}) {
  const d = await load();
  let s = d.services || [];
  if (category) s = s.filter(x => x.category === category);
  const counts = { operational: 0, degraded: 0, partial_outage: 0, major_outage: 0, unknown: 0 };
  for (const x of s) { const st = x.last_known_status || "unknown"; counts[st] = (counts[st] || 0) + 1; }
  return { ..._prov(d), category: category || "all", total: s.length, counts, services: s.map(x => ({ service_id: x.service_id, name: x.name, status: x.last_known_status })), related_services: _related() };
}

const TOOLS = [
  { name: "list_services", description: "List monitored SaaS providers + last-known status. Filter by category or status.", inputSchema: { type: "object", properties: { category: { type: "string", description: "e.g. llm-provider, cloud, devtools, payments" }, current_status: { type: "string", description: "e.g. operational, degraded, partial_outage, major_outage" } } } },
  { name: "get_status", description: "Full status record for one service, with cited status-page URL.", inputSchema: { type: "object", properties: { service_id: { type: "string" } }, required: ["service_id"] } },
  { name: "get_incidents_today", description: "Active incidents across all monitored services as of snapshot.", inputSchema: { type: "object", properties: {} } },
  { name: "check_all", description: "Aggregate status counts. Quick health summary for agents deciding whether to retry/fallback.", inputSchema: { type: "object", properties: { category: { type: "string" } } } },
];
const HANDLERS = { list_services: listServices, get_status: getStatus, get_incidents_today: getIncidentsToday, check_all: checkAll };
const server = new Server({ name: "status-aggregator", version: "0.1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const h = HANDLERS[name];
  if (!h) return { content: [{ type: "text", text: JSON.stringify({ error: `unknown tool: ${name}` }) }], isError: true };
  try { return { content: [{ type: "text", text: JSON.stringify(await h(args || {}), null, 2) }] }; }
  catch (e) { return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true }; }
});
await server.connect(new StdioServerTransport());
process.stderr.write("status-aggregator connected via stdio\n");
