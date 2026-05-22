# feishu-iam Architecture Notes

## Identity Model

Feishu is the upstream source of truth for:

- departments
- users
- user status
- identity binding
- login authentication
- super administrator identity

The system should store only the local projection needed for authorization decisions, auditability, and application behavior. It should not become a competing identity provider.

## Feishu Application Boundary

The system is bound to a dedicated self-built Feishu application. All Feishu API calls must use permissions granted to this application.

The implementation should make this boundary explicit in configuration:

- Feishu app ID
- Feishu app secret or private credential material
- tenant identity
- callback URLs
- OAuth scopes
- event subscription settings
- synchronization permissions

Secrets must be loaded from runtime configuration or a secret manager, never from committed files.

## Login And Authorization

Login must be Feishu-backed. Local accounts and local password authentication are outside the project boundary.

The expected shape is:

1. User starts login.
2. System redirects to or invokes Feishu authentication.
3. Feishu returns the authenticated user identity.
4. System resolves the Feishu user against its synchronized local projection.
5. System grants local application permissions based on Feishu identity, department, role mappings, and admin bindings.

## Synchronization

Organization and user synchronization should be treated as a first-class subsystem:

- full sync for bootstrap and repair
- incremental sync or event-driven sync for normal operation
- idempotent upserts
- deletion or disable handling
- audit logs for sync runs
- clear error reporting for permission or token failures

## Super Administrator

Super administrator access must be assigned to Feishu users. It should not rely on an independent local root account.

Bootstrap should define how the first Feishu-backed super administrator is selected, validated, and audited.
