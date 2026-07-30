# AgentPond data-access CLI

Run AgentPond through `npx` unless it is installed globally.

## Select data

Firebase project selection is owned by Firebase:

```bash
firebase use <alias-or-project-id>
npx agentpond@0.9.0 sync
```

AgentPond detects the Firebase root from `.firebaserc` or `firebase.json`, follows the active selection stored by the Firebase CLI even when `.firebaserc` is absent, uses that project ID for the local cache name, reads the Firebase project data, and ignores AgentPond environment selection.

`npx agentpond@0.9.0 init` verifies that both AgentPond skills exist after installation. Cancelling the Skills CLI stops setup without printing a success message or coding-agent prompt.

For non-Firebase storage, select an existing environment:

```bash
npx agentpond@0.9.0 env current
npx agentpond@0.9.0 env list
npx agentpond@0.9.0 env use production
npx agentpond@0.9.0 sync
```

Sync the selected environment before querying when recent data matters.

## Query commands

```bash
npx agentpond@0.9.0 sync
npx agentpond@0.9.0 sync --json

npx agentpond@0.9.0 traces list --limit 25
npx agentpond@0.9.0 traces get <trace-id>
npx agentpond@0.9.0 observations list --traceId <trace-id>

npx agentpond@0.9.0 sessions list
npx agentpond@0.9.0 sessions get <session-id>

npx agentpond@0.9.0 scores list --traceId <trace-id>
npx agentpond@0.9.0 scores list --observationId <observation-id>

npx agentpond@0.9.0 sql "select * from traces limit 10"
npx agentpond@0.9.0 sql "select * from scores where trace_id = '<trace-id>'" --json
```

Use JSON output when another tool needs to consume the result. Use focused commands for individual resources and SQL for aggregation, joins, time filtering, raw events, and cost analysis.
