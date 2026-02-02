# Contributing to Agent Switchboard

Thank you for your interest in contributing to Agent Switchboard! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+
- Git

### Local Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/SaaSerge/agent-switchboard.git
cd agent-switchboard
```

2. **Install dependencies**

```bash
npm install
```

3. **Start development server**

```bash
npm run dev
```

4. **Open the UI**

Navigate to http://localhost:5000. Default credentials: `admin` / `admin123`

## Project Structure

```
agent-switchboard/
├── server/                  # Express.js backend
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API routes
│   ├── storage.ts          # Database operations
│   ├── auth.ts             # Authentication utilities
│   └── plugins/            # Capability plugins
│       ├── types.ts
│       ├── registry.ts
│       ├── risk-scoring.ts
│       └── builtin/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       ├── components/
│       └── hooks/
├── shared/                  # Shared schema
├── packages/
│   ├── shared/             # Shared types + Zod schemas (npm)
│   ├── sdk/                # Agent SDK (@agent-switchboard/sdk)
│   └── cli/                # CLI tool
└── examples/               # Example agent implementations
```

## Development Workflow

### Making Changes

1. Create a feature branch from `main`

```bash
git checkout -b feature/your-feature-name
```

2. Make your changes following the coding standards below

3. Test your changes locally

4. Commit with clear, descriptive messages

```bash
git commit -m "feat: add support for XYZ capability"
```

5. Push and create a pull request

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Build/tooling changes

## Coding Standards

### TypeScript

- Use strict TypeScript (`strict: true`)
- Prefer `unknown` over `any`
- Use explicit return types for public functions
- Document complex logic with comments

### Backend

- Keep routes thin - business logic belongs in storage/services
- Validate all inputs with Zod schemas
- Create audit events for security-relevant actions
- Handle errors explicitly, never swallow exceptions

### Frontend

- Use TanStack Query for server state
- Follow shadcn/ui component patterns
- Use Tailwind utility classes
- Add `data-testid` attributes to interactive elements

### Plugins

When creating new capability plugins:

1. Implement all methods from `CapabilityPlugin` interface
2. Include proper risk scoring in `dryRun`
3. Respect `safeModeEnabled` in context
4. Return detailed execution results
5. Add appropriate `uiHints` for admin UI

## Testing

### Manual Testing

1. Create a test agent in the UI
2. Enable the capability you're testing
3. Use the SDK or curl to submit requests
4. Verify dry-run previews are accurate
5. Approve and execute, verify results

### API Testing with curl

```bash
# Create a request
curl -X POST http://localhost:5000/api/agent/action-requests \
  -H "Authorization: Bearer sk_agent_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"echo","operation":"test","params":{"message":"hello"}}'

# Dry run
curl -X POST http://localhost:5000/api/agent/action-requests/1/dry-run \
  -H "Authorization: Bearer sk_agent_YOUR_KEY"

# Execute (after admin approval)
curl -X POST http://localhost:5000/api/agent/plans/1/execute \
  -H "Authorization: Bearer sk_agent_YOUR_KEY"
```

## Adding New Capabilities

1. **Create the plugin file**

```
server/plugins/builtin/your-plugin.ts
```

2. **Implement the interface**

```typescript
import type { CapabilityPlugin } from '../types';

export const yourPlugin: CapabilityPlugin = {
  id: 'builtin:your-plugin',
  displayName: 'Your Plugin',
  version: '1.0.0',
  capabilityType: 'your-type',
  // ... implement methods
};
```

3. **Register in registry.ts**

```typescript
import { yourPlugin } from './builtin/your-plugin';
pluginRegistry.register(yourPlugin);
```

4. **Add to shared types** (if needed)

Update `packages/shared/src/schemas.ts` with new operation types.

## Security Guidelines

- Never log or expose API keys or secrets
- Always validate and sanitize user input
- Respect the Safe Mode flag in all destructive operations
- Include appropriate risk flags in dry-run results
- Create audit events for security-relevant actions
- Test edge cases and error conditions

## Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Self-reviewed the changes
- [ ] Added/updated documentation as needed
- [ ] No new TypeScript errors
- [ ] Tested manually in browser
- [ ] Audit events created for security actions
- [ ] Risk scoring accurate for new operations

## Getting Help

- Open an issue for bugs or feature requests
- Join discussions for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
