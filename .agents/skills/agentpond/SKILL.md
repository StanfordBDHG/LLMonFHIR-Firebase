---
name: agentpond
description: Inspect and analyze AgentPond traces, observations, sessions, and scores with focused CLI commands and DuckDB SQL. Use when investigating agent behavior, querying trace data, comparing sessions, reviewing annotations, or diagnosing failures after traces have already been collected.
---

# AgentPond trace analytics

Use AgentPond to inspect collected trace data.

Read these references when relevant:

- Data-access commands and environment selection: [references/cli.md](references/cli.md)
- DuckDB tables and SQL examples: [references/duckdb-schema.md](references/duckdb-schema.md)
- Trace investigation workflow: [references/error-analysis.md](references/error-analysis.md)

## Select the data source

First determine whether the current directory is inside a Firebase project.

For Firebase, select the project with Firebase:

```bash
firebase use <alias-or-project-id>
npx agentpond@0.9.0 sync
```

AgentPond follows the Firebase CLI's active project selection, including
selections stored globally when the project has no `.firebaserc`.
If skill installation is cancelled, `init` stops without printing the coding-agent prompt.

For non-Firebase storage, inspect and select an existing AgentPond environment:

```bash
npx agentpond@0.9.0 env current
npx agentpond@0.9.0 env list
npx agentpond@0.9.0 env use <name>
npx agentpond@0.9.0 sync
```

Select only an existing non-Firebase environment as part of an analysis request.

## Inspect traces

Start with focused commands:

```bash
npx agentpond@0.9.0 traces list --limit 25
npx agentpond@0.9.0 traces get <trace-id>
npx agentpond@0.9.0 observations list --traceId <trace-id>
npx agentpond@0.9.0 scores list --traceId <trace-id>
```

Inspect a session when behavior spans multiple traces:

```bash
npx agentpond@0.9.0 sessions list
npx agentpond@0.9.0 sessions get <session-id>
```

Use SQL for joins, aggregation, time windows, raw event inspection, or cost analysis:

```bash
npx agentpond@0.9.0 sql "select id, name, session_id, total_cost from traces order by start_time desc limit 10"
```

## Report findings

Separate confirmed observations from inference. Include the trace or session IDs inspected, commands or SQL used, the observed pattern, the likely cause, and the smallest useful code, prompt, or workflow change.
