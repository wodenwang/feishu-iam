# feishu-iam

`feishu-iam` is an IAM system whose identities, organization tree, login, and authorization entrypoints are anchored in Feishu.

## Product Boundary

- Organization departments and users are synchronized from Feishu.
- The system does not maintain an independent login system.
- All user authentication depends on Feishu.
- System super administrators are also resolved through Feishu identities.
- The system binds to one dedicated self-built Feishu application.
- All Feishu API permissions used by the system come from that dedicated application.

## Current Status

This repository is initialized as the source home for the project. The implementation stack is intentionally not selected yet.

## Initial Documentation

- [Architecture notes](docs/architecture.md)
- [Agent handoff notes](AGENTS.md)

## Security Notes

Do not commit Feishu app secrets, tenant access tokens, private keys, local `.env` files, exported user data, or synchronization snapshots.
