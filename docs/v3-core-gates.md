# V3 Core acceptance ledger

The Core sequence is **shared features → Text → Search → Image → official Code → integrated QA → release**. It does not introduce a new storage architecture, mirror an Arena workspace, or reinstall a local sandbox. The [Phase 1 checkpoint](v3-phase-1.md) was tested and upgraded in [run 355](https://github.com/themuhammad-personal/Arenapilot/actions/runs/44330079914). Subsequent partial checkpoints on `main` are `[verify-only]`, not releases.

## Phase 2 — shared features, in progress

- **Remote MCP transport:** the bridge previously accepted a caller-supplied URL/key, read one discovery page, ignored JSON-RPC response IDs, and could replay tool calls on session errors. The native client now uses the original `bds_mcp_servers` configuration, negotiates its supported protocol versions, checks tool capabilities, reads bounded paginated catalogs, correlates JSON and SSE replies, and distinguishes connection, authentication, protocol, execution and size errors. Only a discovered tool on an enabled server is callable. Disable/delete/credential changes invalidate its cached session. No new persistent store. Local evidence: debug APK built, 47 bridge/policy JVM tests passed, including MockWebServer pagination, headers, refusal, multiline SSE, expiration and no replay. Not a claim of full MCP protocol coverage. Reference: [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

**Phase gate:** exercise user permission and connection status, memory suggestion/approval/CRUD/retrieval and project isolation, project/conversation switching, personas and skill relevance, settings/preferences, and Android attachment/history/download paths. A passing transport unit test does not establish these behaviors. Run JS, browser harness, Android build/unit, emulator and connected tests. Do not start Phase 3 on a partial Phase 2 result.

## Remaining acceptance gates

| Phase | What counts as evidence |
|---|---|
| 3: Text | Conversations, writing and analysis with the intended project/persona/relevant skills, memory and tools; independent negative isolation cases |
| 4: Search | Actual search/research outcomes with verified sources, cross-checks and citations; no purchased or fabricated search capability |
| 5: Image | Generation, reference upload, prompt reuse/editing within model capabilities; unchanged user prompt and attachments on the wire |
| 6: Code | An actual official Arena sandbox session with observed availability, schemas and model compatibility, multi-file changes, execution/tests/build. A fixture or an assistant writing source is not this proof. No local substitute. |
| 7: Integrated QA | All Direct modes and unaffected non-Direct modes, navigation, auth, native file operations, lifecycle, performance, recovery, persisted data and a release-signed upgrade. Report skips. |
| 8: Release | Only after the above pass, use the existing Actions workflow; verify the published artifact, signature, version, installation and update path. |

Prompt precedence: platform/safety → current user → active mode/tool restrictions → active project → applicable active persona → relevant memory **as context** → matched skills. Settings never grant a capability that the platform or mode does not offer. Image content must not receive a hidden instruction prefix.
