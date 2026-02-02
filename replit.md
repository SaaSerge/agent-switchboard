# Agent Switchboard (OSS)

## Overview

Agent Switchboard is a local-first control plane that provides a web UI to safely manage AI agents. It acts as a security/control layer that agent runtimes can call over localhost HTTP.

**Core Features:**
- Register and manage AI agents with unique API keys
- Toggle capabilities per agent (filesystem, shell commands, network egress)
- Dry Run Preview workflow: agents request actions, system generates plans without executing, user approves/rejects, then execution proceeds
- Tamper-evident audit log of all requests, approvals, and executions
- Plugin SDK for extensible capability modules
- Risk scoring (0-100) for dry run previews
- Safe Mode kill switch for read-only operation
- Emergency Lockdown (enables safe mode + rotates all agent keys)
- **Reasoning Traces** - Agents can provide "show your work" explanations
- **MCP Server** - Model Context Protocol endpoints for agentic AI integration
- **Agent Metrics Dashboard** - Track success rates, approval rates, avg risk scores
- **Per-Agent Rate Limiting** - Prevent runaway agents with minute/hour/day limits

**Important:** This is entirely local-first with no cloud dependencies and no LLM calls required.

## Monorepo Structure (npm workspaces)

```
agent-switchboard/
├── apps/
│   ├── server/          # Express.js backend + API
│   └── web/             # React frontend (Vite)
├── packages/
│   ├── shared/          # Shared types + Zod schemas
│   ├── sdk/             # Agent client SDK (@agent-switchboard/sdk)
│   └── cli/             # CLI installer (npx agent-switchboard)
├── examples/
│   └── basic-agent-client.ts
└── package.json         # npm workspaces root
```

## Quick Start

```bash
npm install
npm run dev
```

Default credentials: `admin` / `admin123`

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight router)
- **State Management:** TanStack React Query for server state
- **Styling:** Tailwind CSS with shadcn/ui components (New York style)
- **Build Tool:** Vite with path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Runtime:** Node.js with TypeScript (tsx for development)
- **Framework:** Express.js REST API
- **Session Management:** express-session with MemoryStore
- **Authentication:** bcryptjs for password hashing, SHA256 for API key hashing

### Database
- **Engine:** SQLite via better-sqlite3
- **ORM:** Drizzle ORM with drizzle-kit for migrations
- **Schema Location:** `shared/schema.ts`
- **Tables:** users, agents, agentCapabilities, settings, actionRequests, plans, approvals, executionReceipts, auditEvents

### Plugin System
- Plugin interface defined in `server/plugins/types.ts`
- Registry loader in `server/plugins/registry.ts`
- Built-in plugins: filesystem, shell, network, echo (test)
- Plugins loaded at startup from `server/plugins/builtin/`
- Each plugin implements: validateRequest, dryRun, execute, getDefaultConfig

### Security Model
- Default-deny capability model
- Filesystem operations restricted to configured allowed roots
- Shell execution limited to allowlisted command patterns
- Network egress validated against allowlisted domains
- Plan approval uses cryptographic hash verification to ensure execution matches approved plan
- Tamper-evident audit log with hash chaining

### API Structure
- Routes defined in `shared/routes.ts` with Zod schemas
- RESTful endpoints under `/api/`
- Session-based admin authentication
- API key authentication for agents

## External Dependencies

### Core Dependencies
- **Database:** SQLite (file-based, stored as `sqlite.db` in project root)
- **UI Components:** Radix UI primitives via shadcn/ui
- **Form Handling:** react-hook-form with @hookform/resolvers
- **Date Handling:** date-fns
- **Diff Generation:** diff library for file change previews

### Development Tools
- **TypeScript:** Strict mode enabled
- **Build:** esbuild for server, Vite for client
- **Replit Plugins:** vite-plugin-runtime-error-modal, cartographer, dev-banner

### No External Services
This application is intentionally local-first with no cloud services, external APIs, or LLM integrations required.