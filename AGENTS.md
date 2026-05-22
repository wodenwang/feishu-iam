# Agent Handoff Notes

## Project

`feishu-iam` is an IAM project integrated with Feishu as the identity and organization source of truth.

## Non-Negotiable Domain Rules

- Feishu is the only source for organization structure and users.
- The project must not add an independent username/password login system.
- All login and authentication flows depend on Feishu.
- System super administrator identities must still be bound to Feishu users.
- The system binds one dedicated self-built Feishu application.
- All Feishu API permissions must come from that dedicated self-built Feishu application.
- Feishu app credentials, tokens, exported user lists, and synchronization snapshots must not be committed.

## Current Repository State

This is the initial repository skeleton. No implementation framework has been selected yet.

## Source Of Truth Order

1. User instructions in the active conversation.
2. This `AGENTS.md`.
3. Documentation under `docs/`.
4. Implementation code.
