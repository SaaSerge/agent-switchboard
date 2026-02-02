# Agent Switchboard

A **local-first control plane** for safely managing AI agents. Provides a web UI and security layer that agent runtimes call over localhost HTTP.

**No cloud dependencies. No LLM calls required. Fully self-hosted.**

## Features

- **Agent Management** - Register agents with unique API keys, toggle capabilities per agent
- **Dry Run Preview** - Agents request actions, system generates execution plans without running them
- **Approval Workflow** - Review and approve/reject plans before execution
- **Risk Scoring** - Each operation gets a risk score (0-100) with detailed flags
- **Tamper-Evident Audit Log** - Cryptographically chained log of all requests, approvals, and executions
- **Safe Mode** - Global kill switch that blocks all destructive operations
- **Emergency Lockdown** - Enables safe mode and rotates all agent API keys instantly
- **Plugin SDK** - Extensible capability modules (filesystem, shell, network, + custom)

## Quick Start

```bash
git clone https://github.com/SaaSerge/agent-switchboard.git
cd agent-switchboard
npm install
npm run dev
```

Open http://localhost:5000

**Default credentials:** `admin` / `admin123`

> Change the default password immediately in production environments.

## Project Structure

```
agent-switchboard/
├── server/              # Express.js backend
├── client/              # React frontend (Vite)
├── shared/              # Shared schema and types
├── packages/
│   ├── shared/          # Shared types + Zod schemas (npm)
│   ├── sdk/             # Agent client SDK (npm)
│   └── cli/             # CLI installer
├── examples/
│   └── basic-agent-client.ts
└── package.json
```

## SDK Usage

Install the SDK in your agent project:

```bash
npm install @agent-switchboard/sdk
```

### Example

```typescript
import { createClient } from '@agent-switchboard/sdk';

const client = createClient({
  baseUrl: 'http://localhost:5000',
  apiKey: 'sk_agent_your_key_here',
});

// 1. Request an action
const { requestId } = await client.requestAction({
  type: 'filesystem',
  operation: 'read',
  params: { path: './sandbox/example.txt' },
});

// 2. Generate dry-run preview
const { planId, steps, riskScore } = await client.dryRun(requestId);
console.log(`Plan ${planId} has risk score: ${riskScore}/100`);

// 3. Wait for admin approval in the web UI...

// 4. Execute approved plan
const result = await client.execute(planId);
console.log('Execution result:', result.status);
```

## Capabilities

### Built-in Plugins

| Plugin | Operations | Description |
|--------|-----------|-------------|
| `filesystem` | read, write, delete, list, move | File system operations within allowed roots |
| `shell` | run | Execute shell commands matching allowlist patterns |
| `network` | allow | Approve network egress to specified domains |
| `echo` | echo | Test plugin for development |

### Risk Scoring

| Risk Level | Score Range | Examples |
|------------|-------------|----------|
| Low | 0-29 | File reads, directory listings |
| Medium | 30-69 | File writes, simple shell commands |
| High | 70-100 | sudo, rm, curl\|sh, dotfile modifications |

### Risk Flags

- `sudo` - Command uses sudo
- `rm` - Deletion command detected
- `curl_pipe_sh` - Dangerous curl to shell pattern
- `dotfile_modification` - Modifying hidden config files
- `potential_secret_file` - Accessing .env, .key, .pem files
- `bulk_delete` - Deleting more than 10 files

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5000 | Server port |
| `SESSION_SECRET` | (random) | Session encryption secret |
| `DATABASE_PATH` | ./data/switchboard.db | SQLite database path |
| `SANDBOX_PATH` | ./sandbox | Default allowed root for filesystem operations |

### Admin Settings

Configure via the web UI:

- **Allowed Roots** - Directories agents can access
- **Shell Allowlist** - Regex patterns for permitted shell commands
- **Safe Mode** - Toggle read-only operation mode

## API Reference

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/admin/login | Admin login |
| POST | /api/admin/logout | Admin logout |
| GET | /api/admin/me | Current user info |
| GET | /api/admin/agents | List all agents |
| POST | /api/admin/agents | Create new agent |
| POST | /api/admin/agents/:id/rotate-key | Rotate agent API key |
| PATCH | /api/admin/agents/:id/capabilities/:type | Toggle capability |
| GET | /api/admin/settings | Get all settings |
| PUT | /api/admin/settings/:key | Update setting |
| GET | /api/admin/action-requests | List action requests |
| POST | /api/admin/plans/:id/approve | Approve/reject plan |
| GET | /api/admin/safe-mode | Get safe mode status |
| POST | /api/admin/safe-mode | Set safe mode |
| POST | /api/admin/lockdown | Emergency lockdown |
| GET | /api/admin/plugins | List loaded plugins |
| GET | /api/admin/audit | Get audit log |

### Agent Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/agent/action-requests | Create action request |
| POST | /api/agent/action-requests/:id/dry-run | Generate execution plan |
| POST | /api/agent/plans/:id/execute | Execute approved plan |

## Security Model

1. **Default-Deny** - Agents have no capabilities until explicitly enabled
2. **Path Restriction** - Filesystem operations limited to configured allowed roots
3. **Command Allowlist** - Shell execution requires matching regex patterns
4. **Plan Integrity** - Execution verifies cryptographic hash matches approved plan
5. **Audit Chain** - Every event cryptographically linked to previous event

## Development

```bash
npm install
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run db:push      # Push database schema
```

## Plugin Development

Create a new plugin in `server/plugins/builtin/`:

```typescript
import type { CapabilityPlugin } from '../types';

export const myPlugin: CapabilityPlugin = {
  id: 'custom:my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  capabilityType: 'my-capability',

  validateRequest(input) {
    return { valid: true, errors: [], normalizedRequest: input };
  },

  async dryRun(ctx, normalizedRequest) {
    return { steps: [...], riskScore: 10 };
  },

  async execute(ctx, approvedPlan) {
    return [{ stepId: '...', status: 'success', output: '...' }];
  },

  getDefaultConfig() {
    return {};
  },
};
```

Register in `server/plugins/registry.ts`.

## License

MIT - See [LICENSE](./LICENSE)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.
