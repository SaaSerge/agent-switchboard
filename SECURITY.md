# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainers directly or use GitHub's private vulnerability reporting feature
3. Include a detailed description of the vulnerability
4. Include steps to reproduce if possible

We will acknowledge receipt within 48 hours and provide a detailed response within 7 days.

## Security Considerations

Agent Switchboard is designed as a local-first security layer for AI agents. Key security features:

- **Default-Deny Capabilities**: Agents have no access until explicitly granted
- **Path Restrictions**: Filesystem operations are limited to configured allowed roots
- **Command Allowlisting**: Shell commands must match configured patterns
- **Plan Integrity**: Cryptographic verification ensures executed plans match approved plans
- **Audit Chain**: Tamper-evident logging with hash chaining

## Best Practices

When deploying Agent Switchboard:

1. **Change default credentials** immediately after first login
2. **Use strong SESSION_SECRET** in production
3. **Restrict allowed roots** to only necessary directories
4. **Use specific shell allowlist patterns** rather than broad wildcards
5. **Enable Safe Mode** when not actively working with agents
6. **Review audit logs** regularly for unexpected activity
7. **Keep dependencies updated** to patch known vulnerabilities

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | Yes                |
