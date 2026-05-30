# jawn

[![NPM](https://img.shields.io/npm/v/@syntax-syllogism/jawn.svg?label=%40syntax-syllogism%2Fjawn)](https://www.npmjs.com/package/@syntax-syllogism/jawn) [![Downloads/week](https://img.shields.io/npm/dw/@syntax-syllogism/jawn.svg)](https://npmjs.org/package/@syntax-syllogism/jawn) [![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://raw.githubusercontent.com/Syntax-Syllogism/jawn/blob/release/LICENSE)

a Salesforce CLI plugin for admin and developer workflows.

## Install

```bash
sf plugins install @syntax-syllogism/jawn@x.y.z
```

## Issues

Please report any issues at https://github.com/Syntax-Syllogism/jawn/issues.

## Contributing

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md).
2. Create a new issue before starting your project so that we can keep track of what you are trying to add/fix. That way, we can also offer suggestions or let you know if there is already an effort in progress.
3. Fork this repository.
4. [Build the plugin locally](#build).
5. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing using a fork.
6. Edit the code in your fork.
7. Write appropriate tests for your changes. Try to achieve at least 75% code coverage on any new code. No pull request will be accepted without unit tests.
8. Send us a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:Syntax-Syllogism/jawn

# Install the dependencies and compile
yarn && yarn build
```

To use your plugin, run using the local `./bin/dev.js` file.

```bash
# Run using local run file.
./bin/dev.js jawn user provision --help
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sf cli
sf plugins link .
# To verify
sf plugins
```

## Commands

<!-- commands -->

- [`sf jawn user provision`](#sf-jawn-user-provision)

## `sf jawn user provision`

Provision users from user and persona definition files.

```
USAGE
  $ sf jawn user provision -o <value> --users-def <value> --personas-def <value> [--json] [--flags-dir <value>]
    [--external-id <value>] [--no-prompt] [--dry-run] [--api-version <value>]

FLAGS
  -o, --target-org=<value>    (required) Target org username or alias.
      --api-version=<value>   Override the api version used for the org connection.
      --dry-run               Validate and plan actions without any write operations.
      --external-id=<value>   User field used to match existing users. If omitted, all entries are treated as inserts.
      --no-prompt             Skip warning confirmation prompts.
      --personas-def=<value>  (required) Path to persona definition JSON file.
      --users-def=<value>     (required) Path to user definition JSON file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Provision users from user and persona definition files.

  Provisions Salesforce users by merging persona defaults with user overrides, enforcing optional profile and role,
  activating and unfreezing users, and planning or applying assignment changes.

EXAMPLES
  Dry run with explicit external id:

    $ sf jawn user provision --users-def config/user-def.json --personas-def config/persona-def.json --external-id ^
      FederationIdentifier --target-org myOrg --dry-run

  Apply provisioning with no prompt:

    $ sf jawn user provision --users-def config/user-def.json --personas-def config/persona-def.json --target-org ^
      myOrg --no-prompt

FLAG DESCRIPTIONS
  --api-version=<value>  Override the api version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/user/provision.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.1.1/src/commands/jawn/user/provision.ts)_

<!-- commandsstop -->

- [`sf jawn user provision`](#sf-jawn-user-provision)

## `sf jawn user provision`

Provision users from user and persona definition files.

```
USAGE
  $ sf jawn user provision --target-org <value> --users-def <value> --personas-def <value>
    [--external-id <value>] [--no-prompt] [--dry-run] [--api-version <value>] [--json]

FLAGS
  --target-org=<value>    (required) Target org username or alias.
  --users-def=<value>     (required) Path to user definition JSON file.
  --personas-def=<value>  (required) Path to persona definition JSON file.
  --external-id=<value>   User field used to match existing users. If omitted, all entries are treated as inserts.
  --no-prompt             Skip warning confirmation prompts.
  --dry-run               Validate and plan actions without any write operations.
  --api-version=<value>   Override the api version used for the org connection.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Provisions Salesforce users by merging persona defaults with user overrides, enforcing optional profile
  and role, activating and unfreezing users, and planning or applying assignment changes.

EXAMPLES
  Dry run with explicit external id:

    $ sf jawn user provision --users-def config/user-def.json --personas-def config/persona-def.json \
        --external-id FederationIdentifier --target-org myOrg --dry-run

  Apply provisioning with no prompt:

    $ sf jawn user provision --users-def config/user-def.json --personas-def config/persona-def.json \
        --target-org myOrg --no-prompt
```

<!-- commandsstop -->

### User and persona definition files

User definitions and persona definitions live in two separate JSON files so that user-specific data stays decoupled from reusable access bundles.

#### Field naming

- User fields must be Salesforce `User` API field names.
- Input field names are accepted case-insensitively and canonicalized using `User` describe metadata before any DML.
- User-level fields override persona `userAttributes` when both supply a value.

#### Practical required fields for new user creation

- `Username`
- `LastName`
- `Alias`
- `TimeZoneSidKey`
- `LocaleSidKey`
- `EmailEncodingKey`
- `LanguageLocaleKey`
- `ProfileId` when persona `profile` is omitted

#### Reference lookup behavior

References are resolved by Id or developer/API name. Labels are intentionally unsupported because they are not reliably unique.

| Reference            | Resolved by                                              |
| -------------------- | -------------------------------------------------------- |
| Profile              | Id or `Profile.Name`                                     |
| Role                 | Id or `UserRole.DeveloperName` (falls back to `Name`)    |
| Permission Set       | Id or `PermissionSet.Name`                               |
| Permission Set Group | Id or `PermissionSetGroup.DeveloperName`                 |
| Public Group         | Id or `Group.DeveloperName` where `Group.Type='Regular'` |
| Queue                | Id or `Group.DeveloperName` where `Group.Type='Queue'`   |

Missing optional assignment targets produce a warning and are skipped. Missing required references (a persona `profile` or `role` that cannot be resolved) fail the affected user.

#### Assignment modes

Each assignment category has its own mode property. The default for every category is `additive`.

| Mode property            | Behavior                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `permissionSetMode`      | `additive` adds missing assignments. `sync` adds missing and removes any not listed. |
| `permissionSetGroupMode` | Same semantics as `permissionSetMode`, for permission set groups.                    |
| `publicGroupMode`        | Same semantics, for `GroupMember` records where `Group.Type='Regular'`.              |
| `queueMode`              | Same semantics, for `GroupMember` records where `Group.Type='Queue'`.                |

`sync` partitions `GroupMember` rows by `Group.Type`, so a public-group sync will not affect queue memberships and vice versa.

#### Dry run

`--dry-run` validates input, resolves references, queries current org state, and reports planned actions. It performs no inserts, updates, deletes, upserts, anonymous Apex, or Composite/Tooling write requests. Dry-run is intentionally planning-only and not rollback-backed.

#### Password handling

Password set/reset is intentionally out of scope.

### Example `user-def.json`

```json
{
  "users": [
    {
      "Username": "jdoe@email.com.mySalesforceOrg",
      "FederationIdentifier": "ABCD1234",
      "persona": "admin",
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "jdoe@email.com",
      "Alias": "jdoe",
      "LocaleSidKey": "en_US",
      "EmailEncodingKey": "UTF-8",
      "LanguageLocaleKey": "en_US",
      "TimeZoneSidKey": "America/Los_Angeles"
    }
  ]
}
```

### Example `persona-def.json`

```json
{
  "personas": {
    "admin": {
      "profile": "Admin",
      "role": "CEO",
      "permissionSetMode": "additive",
      "permissionSets": ["Admin_Permissions"],
      "permissionSetGroupMode": "additive",
      "permissionSetGroups": ["Admin_Group"],
      "publicGroupMode": "sync",
      "publicGroups": ["Admin_Public_Group"],
      "queueMode": "additive",
      "queues": ["Case_Queue"],
      "userAttributes": {
        "Title": "Salesforce Administrator",
        "Department": "Sales"
      }
    }
  }
}
```
