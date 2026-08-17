# jawn

[![NPM](https://img.shields.io/npm/v/@syntax-syllogism/jawn.svg?label=%40syntax-syllogism%2Fjawn)](https://www.npmjs.com/package/@syntax-syllogism/jawn) [![Downloads/week](https://img.shields.io/npm/dw/@syntax-syllogism/jawn.svg)](https://npmjs.org/package/@syntax-syllogism/jawn) [![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://raw.githubusercontent.com/Syntax-Syllogism/jawn/blob/release/LICENSE)

a Salesforce CLI plugin for admin and developer workflows.

## IMPORTANT: 

This project is *no longer maintained*. It has been succeeded by [apx](https://github.com/Syntax-Syllogism/apx) and [warden](https://github.com/Syntax-Syllogism/warden). 

## Install

```bash
sf plugins install @syntax-syllogism/jawn@x.y.z
```

## Issues

Please report any issues at <https://github.com/Syntax-Syllogism/jawn/issues>.

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
* [`sf jawn aep generate`](#sf-jawn-aep-generate)
* [`sf jawn aep generate action`](#sf-jawn-aep-generate-action)
* [`sf jawn aep generate criteria`](#sf-jawn-aep-generate-criteria)
* [`sf jawn aep generate domain`](#sf-jawn-aep-generate-domain)
* [`sf jawn aep generate selector`](#sf-jawn-aep-generate-selector)
* [`sf jawn aep generate selector field-injection`](#sf-jawn-aep-generate-selector-field-injection)
* [`sf jawn aep generate selector method`](#sf-jawn-aep-generate-selector-method)
* [`sf jawn aep generate service`](#sf-jawn-aep-generate-service)
* [`sf jawn aep generate unitofwork`](#sf-jawn-aep-generate-unitofwork)
* [`sf jawn user access`](#sf-jawn-user-access)
* [`sf jawn user diff`](#sf-jawn-user-diff)
* [`sf jawn user freeze`](#sf-jawn-user-freeze)
* [`sf jawn user provision`](#sf-jawn-user-provision)
* [`sf jawn user restore`](#sf-jawn-user-restore)
* [`sf jawn user snapshot`](#sf-jawn-user-snapshot)
* [`sf jawn user strip`](#sf-jawn-user-strip)
* [`sf jawn user unfreeze`](#sf-jawn-user-unfreeze)

## `sf jawn aep generate`

Generate multiple AEP artifact groups in one command run.

```
USAGE
  $ sf jawn aep generate -o <value> -s <value> [--json] [--flags-dir <value>] [--at4dx] [--fflib] [-a <value>] [-b
    <value>] [-p <value>] [--prefix <value>] [-r] [-d] [-u] [--dry-run]

FLAGS
  -a, --api-version=<value>       Override the API version used for the org connection.
  -b, --binding-sequence=<value>  Binding sequence value for AT4DX unit-of-work metadata.
  -d, --domain                    Include domain artifacts in aggregate generation.
  -o, --target-org=<value>        (required) Target org username or alias.
  -p, --output-path=<value>       [default: generated-files] Output folder relative to the Salesforce project root.
  -r, --selector                  Include selector artifacts in aggregate generation.
  -s, --sobject=<value>           (required) SObject API name used for generated artifacts.
  -u, --unit-of-work              Include unit-of-work artifacts in aggregate generation.
      --at4dx                     Generate AT4DX-flavor artifacts.
      --dry-run                   Render and validate generation output without writing files.
      --fflib                     Generate fflib-flavor artifacts.
      --prefix=<value>            Optional namespace-style class prefix.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate multiple AEP artifact groups in one command run.

  Builds selector/domain/unit-of-work plans from one SObject describe and writes all selected outputs in a single
  manifest.

EXAMPLES
  Generate selector, domain, and unit-of-work in AT4DX style:

    $ sf jawn aep generate --target-org myOrg --sobject Account --selector --domain --unit-of-work --at4dx

FLAG DESCRIPTIONS
  -a, --api-version=<value>  Override the API version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/aep/generate.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/aep/generate.ts)_

## `sf jawn aep generate action`

Generate an AT4DX domain-process action class, test, and binding metadata.

```
USAGE
  $ sf jawn aep generate action -s <value> -c <value> [--json] [--flags-dir <value>] [--trigger-operation
    Before_Insert|Before_Update|Before_Delete|After_Insert|After_Update|After_Delete|After_Undelete] [--order <value>]
    [--process-name <value>] [--description <value>] [-a <value>] [-p <value>] [--dry-run]

FLAGS
  -a, --api-version=<value>         Override the API version used for the org connection.
  -c, --class-name=<value>          (required) Selector method-injection class name.
  -p, --output-path=<value>         [default: generated-files] Output folder relative to the Salesforce project root.
  -s, --sobject=<value>             (required) SObject API name used for generated artifacts.
      --description=<value>         Optional description value written into generated metadata.
      --dry-run                     Render and validate generation output without writing files.
      --order=<value>               Order-of-execution token used for AT4DX domain-process bindings (for example, 10.1).
      --process-name=<value>        Optional process token used to build AT4DX binding developer names.
      --trigger-operation=<option>  Trigger operation enum value for AT4DX domain-process bindings.
                                    <options: Before_Insert|Before_Update|Before_Delete|After_Insert|After_Update|After_
                                    Delete|After_Undelete>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate an AT4DX domain-process action class, test, and binding metadata.

  Creates offline action scaffolding and a DomainProcessBinding record without requiring an org connection.

EXAMPLES
  Generate action artifacts with defaults:

    $ sf jawn aep generate action -s Account -c DefaultAccountSloganBasedOnNameAction

FLAG DESCRIPTIONS
  -a, --api-version=<value>  Override the API version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/aep/generate/action.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/aep/generate/action.ts)_

## `sf jawn aep generate criteria`

Generate an AT4DX domain-process criteria class, test, and binding metadata.

```
USAGE
  $ sf jawn aep generate criteria -s <value> -c <value> [--json] [--flags-dir <value>] [--trigger-operation
    Before_Insert|Before_Update|Before_Delete|After_Insert|After_Update|After_Delete|After_Undelete] [--order <value>]
    [--process-name <value>] [--description <value>] [-a <value>] [-p <value>] [--dry-run]

FLAGS
  -a, --api-version=<value>         Override the API version used for the org connection.
  -c, --class-name=<value>          (required) Selector method-injection class name.
  -p, --output-path=<value>         [default: generated-files] Output folder relative to the Salesforce project root.
  -s, --sobject=<value>             (required) SObject API name used for generated artifacts.
      --description=<value>         Optional description value written into generated metadata.
      --dry-run                     Render and validate generation output without writing files.
      --order=<value>               Order-of-execution token used for AT4DX domain-process bindings (for example, 10.1).
      --process-name=<value>        Optional process token used to build AT4DX binding developer names.
      --trigger-operation=<option>  Trigger operation enum value for AT4DX domain-process bindings.
                                    <options: Before_Insert|Before_Update|Before_Delete|After_Insert|After_Update|After_
                                    Delete|After_Undelete>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate an AT4DX domain-process criteria class, test, and binding metadata.

  Creates offline criteria scaffolding and a DomainProcessBinding record without requiring an org connection.

EXAMPLES
  Generate criteria artifacts with defaults:

    $ sf jawn aep generate criteria -s Account -c AccountNameContainsFishCriteria

FLAG DESCRIPTIONS
  -a, --api-version=<value>  Override the API version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/aep/generate/criteria.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/aep/generate/criteria.ts)_

## `sf jawn aep generate domain`

Generate domain classes, tests, triggers, and metadata for an SObject.

```
USAGE
  $ sf jawn aep generate domain -o <value> -s <value> [--json] [--flags-dir <value>] [--at4dx] [--fflib] [-a <value>] [-p
    <value>] [--prefix <value>] [--dry-run]

FLAGS
  -a, --api-version=<value>  Override the API version used for the org connection.
  -o, --target-org=<value>   (required) Target org username or alias.
  -p, --output-path=<value>  [default: generated-files] Output folder relative to the Salesforce project root.
  -s, --sobject=<value>      (required) SObject API name used for generated artifacts.
      --at4dx                Generate AT4DX-flavor artifacts.
      --dry-run              Render and validate generation output without writing files.
      --fflib                Generate fflib-flavor artifacts.
      --prefix=<value>       Optional namespace-style class prefix.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate domain classes, tests, triggers, and metadata for an SObject.

  Describes the target SObject and scaffolds domain artifacts in either AT4DX or fflib flavor.

EXAMPLES
  Generate AT4DX domain files:

    $ sf jawn aep generate domain --target-org myOrg --sobject Account --at4dx

FLAG DESCRIPTIONS
  -a, --api-version=<value>  Override the API version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/aep/generate/domain.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/aep/generate/domain.ts)_

## `sf jawn aep generate selector`

Generate selector classes, tests, and metadata for an SObject.

```
USAGE
  $ sf jawn aep generate selector -o <value> -s <value> [--json] [--flags-dir <value>] [--at4dx] [--fflib] [-a <value>] [-p
    <value>] [--prefix <value>] [--dry-run]

FLAGS
  -a, --api-version=<value>  Override the API version used for the org connection.
  -o, --target-org=<value>   (required) Target org username or alias.
  -p, --output-path=<value>  [default: generated-files] Output folder relative to the Salesforce project root.
  -s, --sobject=<value>      (required) SObject API name used for generated artifacts.
      --at4dx                Generate AT4DX-flavor artifacts.
      --dry-run              Render and validate generation output without writing files.
      --fflib                Generate fflib-flavor artifacts.
      --prefix=<value>       Optional namespace-style class prefix.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate selector classes, tests, and metadata for an SObject.

  Describes the target SObject and scaffolds selector artifacts in either AT4DX or fflib flavor.

EXAMPLES
  Generate AT4DX selector files:

    $ sf jawn aep generate selector --target-org myOrg --sobject Account --at4dx

  Generate fflib selector files with a prefix:

    $ sf jawn aep generate selector --target-org myOrg --sobject Property__c --fflib --prefix foobar

FLAG DESCRIPTIONS
  -a, --api-version=<value>  Override the API version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/aep/generate/selector.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/aep/generate/selector.ts)_

## `sf jawn aep generate selector field-injection`

Generate AT4DX selector field-injection metadata (fieldset + binding).

```
USAGE
  $ sf jawn aep generate selector field-injection -s <value> --fields <value> [--json] [--flags-dir <value>] [--fieldset-name <value>] [--label
    <value>] [--description <value>] [-p <value>] [--dry-run]

FLAGS
  -p, --output-path=<value>    [default: generated-files] Output folder relative to the Salesforce project root.
  -s, --sobject=<value>        (required) SObject API name used for generated artifacts.
      --description=<value>    Optional description value written into generated metadata.
      --dry-run                Render and validate generation output without writing files.
      --fields=<value>         (required) Comma-separated API names for field-set displayed fields.
      --fieldset-name=<value>  Optional field-set API name for selector field injection.
      --label=<value>          Optional label value for generated metadata artifacts.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate AT4DX selector field-injection metadata (fieldset + binding).

  Creates a FieldSet and SelectorConfig_FieldSetInclusion binding offline from a comma-separated field list.

EXAMPLES
  Generate field-injection metadata:

    $ sf jawn aep generate selector field-injection -s Account --fields Name,Industry
```

_See code: [src/commands/jawn/aep/generate/selector/field-injection.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/aep/generate/selector/field-injection.ts)_

## `sf jawn aep generate selector method`

Generate an AT4DX selector method-injection class and test.

```
USAGE
  $ sf jawn aep generate selector method -s <value> -c <value> --sobject-selector-class-name <value> [--json] [--flags-dir <value>] [-a
    <value>] [-p <value>] [--dry-run]

FLAGS
  -a, --api-version=<value>                  Override the API version used for the org connection.
  -c, --class-name=<value>                   (required) Selector method-injection class name.
  -p, --output-path=<value>                  [default: generated-files] Output folder relative to the Salesforce project
                                             root.
  -s, --sobject=<value>                      (required) SObject API name used for generated artifacts.
      --dry-run                              Render and validate generation output without writing files.
      --sobject-selector-class-name=<value>  (required) Selector implementation class name used by method injection.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate an AT4DX selector method-injection class and test.

  Creates method-injection scaffolding for an existing selector without requiring an org describe.

EXAMPLES
  Generate selector method scaffolding:

    $ sf jawn aep generate selector method -c SelectBySloganMethod --sobject-selector-class-name AccountsSelector -s ^
      Account

FLAG DESCRIPTIONS
  -a, --api-version=<value>  Override the API version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/aep/generate/selector/method.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/aep/generate/selector/method.ts)_

## `sf jawn aep generate service`

Generate service facade/interface/implementation classes and metadata.

```
USAGE
  $ sf jawn aep generate service --service-basename <value> [--json] [--flags-dir <value>] [-o <value>] [--at4dx] [--fflib] [-a
    <value>] [-p <value>] [--prefix <value>] [--dry-run]

FLAGS
  -a, --api-version=<value>       Override the API version used for the org connection.
  -o, --target-org=<value>        Target org username or alias.
  -p, --output-path=<value>       [default: generated-files] Output folder relative to the Salesforce project root.
      --at4dx                     Generate AT4DX-flavor artifacts.
      --dry-run                   Render and validate generation output without writing files.
      --fflib                     Generate fflib-flavor artifacts.
      --prefix=<value>            Optional namespace-style class prefix.
      --service-basename=<value>  (required) Base name used for generated service classes.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate service facade/interface/implementation classes and metadata.

  Builds service-layer Apex artifacts for the provided basename and flavor.

EXAMPLES
  Generate an AT4DX service set:

    $ sf jawn aep generate service --target-org myOrg --service-basename LimitMonitors --at4dx

FLAG DESCRIPTIONS
  -a, --api-version=<value>  Override the API version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/aep/generate/service.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/aep/generate/service.ts)_

## `sf jawn aep generate unitofwork`

Generate unit-of-work binding metadata for an SObject.

```
USAGE
  $ sf jawn aep generate unitofwork -o <value> -s <value> [--json] [--flags-dir <value>] [--at4dx] [--fflib] [-a <value>] [-b
    <value>] [-p <value>] [--prefix <value>] [--dry-run]

FLAGS
  -a, --api-version=<value>       Override the API version used for the org connection.
  -b, --binding-sequence=<value>  Binding sequence value for AT4DX unit-of-work metadata.
  -o, --target-org=<value>        (required) Target org username or alias.
  -p, --output-path=<value>       [default: generated-files] Output folder relative to the Salesforce project root.
  -s, --sobject=<value>           (required) SObject API name used for generated artifacts.
      --at4dx                     Generate AT4DX-flavor artifacts.
      --dry-run                   Render and validate generation output without writing files.
      --fflib                     Generate fflib-flavor artifacts.
      --prefix=<value>            Optional namespace-style class prefix.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate unit-of-work binding metadata for an SObject.

  Creates AT4DX unit-of-work binding metadata or prints the fflib Application snippet.

EXAMPLES
  Generate AT4DX unit-of-work binding:

    $ sf jawn aep generate unitofwork --target-org myOrg --sobject Account --at4dx

FLAG DESCRIPTIONS
  -a, --api-version=<value>  Override the API version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/aep/generate/unitofwork.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/aep/generate/unitofwork.ts)_

## `sf jawn user access`

Audit active-user access for a permission target.

```
USAGE
  $ sf jawn user access -o <value> --type field|object|apex-class|vf-page|custom-permission|tab --target <value>
    [--json] [--flags-dir <value>] [--output human|csv|json] [--api-version <value>]

FLAGS
  -o, --target-org=<value>   (required) Target org username or alias.
      --api-version=<value>  Override the api version used for the org connection.
      --output=<option>      [default: human] Output format: human, csv, or json. Defaults to human.
                             <options: human|csv|json>
      --target=<value>       (required) Target API name. Use Object.Field for field, Object for object, Apex class name
                             for apex-class, Visualforce page name for vf-page, custom permission DeveloperName for
                             custom-permission, or tab API name for tab.
      --type=<option>        (required) Target type to audit: field, object, apex-class, vf-page, custom-permission, or
                             tab.
                             <options: field|object|apex-class|vf-page|custom-permission|tab>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Audit active-user access for a permission target.

  Resolves active users who have access to a target and attributes each access path to Profile, Permission Set, or
  Permission Set Group sources.

EXAMPLES
  Field access in human output (default):

    $ sf jawn user access --type field --target Account.CustomField__c --target-org myOrg

  Object access in csv output:

    $ sf jawn user access --type object --target Account --target-org myOrg --output csv

  Field access in json output:

    $ sf jawn user access --type field --target Account.CustomField__c --target-org myOrg --output json

  Apex class access in human output:

    $ sf jawn user access --type apex-class --target MyController --target-org myOrg

  Visualforce page access in csv output:

    $ sf jawn user access --type vf-page --target MyPage --target-org myOrg --output csv

  Custom permission access in json output:

    $ sf jawn user access --type custom-permission --target Can_Edit_Accounts --target-org myOrg --output json

  Tab visibility in human output:

    $ sf jawn user access --type tab --target Account --target-org myOrg

FLAG DESCRIPTIONS
  --api-version=<value>  Override the api version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/user/access.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/user/access.ts)_

## `sf jawn user diff`

Compare user assignments against intended persona state or another user.

```
USAGE
  $ sf jawn user diff -o <value> [--json] [--flags-dir <value>] [--user <value> --against <value>] [--users-def
    <value> --personas-def <value>] [--external-id <value>] [--output human|csv|json] [--verbose] [--api-version
    <value>]

FLAGS
  -o, --target-org=<value>    (required) Target org username or alias.
      --against=<value>       Reference user to compare against using `field:value`.
      --api-version=<value>   Override the api version used for the org connection.
      --external-id=<value>   Default User field used to match entries in `--users-def`.
      --output=<option>       [default: human] Output format when not using global `--json`.
                              <options: human|csv|json>
      --personas-def=<value>  Path to persona definition JSON file.
      --user=<value>          Target user to compare using `field:value`.
      --users-def=<value>     Path to user definition JSON file.
      --verbose               Include assignments that are already present in both sides in human output.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Compare user assignments against intended persona state or another user.

  Reports read-only drift across profile, role, permission sets, permission set groups, public groups, and queues
  without applying changes.

EXAMPLES
  Compare users in a definition file against their personas:

    $ sf jawn user diff --users-def config/user-def.json --personas-def config/persona-def.json --external-id ^
      FederationIdentifier --target-org myOrg

  Compare one user against another:

    $ sf jawn user diff --user username:new@example.com --against username:template@example.com --target-org myOrg ^
      --output csv

FLAG DESCRIPTIONS
  --api-version=<value>  Override the api version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/user/diff.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/user/diff.ts)_

## `sf jawn user freeze`

Freeze one or more users.

```
USAGE
  $ sf jawn user freeze -o <value> [--json] [--flags-dir <value>] [--user <value>] [--users-def <value>]
    [--external-id <value>] [--no-prompt] [--dry-run] [--api-version <value>]

FLAGS
  -o, --target-org=<value>   (required) Target org username or alias.
      --api-version=<value>  Override the api version used for the org connection.
      --dry-run              Validate and plan actions without any write operations.
      --external-id=<value>  Default User field used to match entries in `--users-def`.
      --no-prompt            Skip confirmation prompts before write operations.
      --user=<value>         Target a single user using `field:value`.
      --users-def=<value>    Path to a user definition JSON file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Freeze one or more users.

  Freezes matching users by setting `UserLogin.IsFrozen = true` and leaving all other access untouched.

EXAMPLES
  Preview a single freeze by field match:

    $ sf jawn user freeze --user username:someone@example.com --dry-run --target-org myOrg

  Freeze users from a definition file without prompts:

    $ sf jawn user freeze --users-def config/user-def.json --external-id FederationIdentifier --target-org myOrg ^
      --no-prompt

FLAG DESCRIPTIONS
  --api-version=<value>  Override the api version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/user/freeze.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/user/freeze.ts)_

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
      --external-id=<value>   User field used to match existing users by default. Per-user `match` overrides this for
                              individual rows. If omitted, all entries are treated as inserts.
      --no-prompt             Skip warning confirmation prompts.
      --personas-def=<value>  (required) Path to persona definition JSON file.
      --users-def=<value>     (required) Path to user definition JSON file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Provision users from user and persona definition files.

  Provisions Salesforce users by merging multiple personas per user into an effective persona (unioning assignment
  lists, enforcing singular-value agreement), applying insert-only Username and Alias defaults, enforcing optional
  profile and role, activating and unfreezing users, and planning or applying assignment changes.

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

_See code: [src/commands/jawn/user/provision.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/user/provision.ts)_

## `sf jawn user restore`

Restore user assignment state from a snapshot file.

```
USAGE
  $ sf jawn user restore -o <value> --snapshot <value> [--json] [--flags-dir <value>] [--no-prompt] [--dry-run]
    [--api-version <value>]

FLAGS
  -o, --target-org=<value>   (required) Target org username or alias.
      --api-version=<value>  Override the api version used for the org connection.
      --dry-run              Validate and plan actions without any write operations.
      --no-prompt            Skip confirmation prompts before write operations.
      --snapshot=<value>     (required) Path to a user snapshot JSON file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Restore user assignment state from a snapshot file.

  Re-resolves users by the snapshot match key, reactivates and unfreezes them, and adds missing assignments without
  removing existing access.

EXAMPLES
  Preview a restore:

    $ sf jawn user restore --snapshot snapshots/user.json --dry-run --target-org myOrg

  Restore without prompts:

    $ sf jawn user restore --snapshot snapshots/user.json --target-org myOrg --no-prompt

FLAG DESCRIPTIONS
  --api-version=<value>  Override the api version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/user/restore.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/user/restore.ts)_

## `sf jawn user snapshot`

Capture user assignment state to a portable snapshot file.

```
USAGE
  $ sf jawn user snapshot -o <value> [--json] [--flags-dir <value>] [--user <value>] [--users-def <value>]
    [--external-id <value>] [--out <value>] [--api-version <value>]

FLAGS
  -o, --target-org=<value>   (required) Target org username or alias.
      --api-version=<value>  Override the api version used for the org connection.
      --external-id=<value>  Default User field used to match entries in `--users-def`.
      --out=<value>          Path to write the snapshot JSON file.
      --user=<value>         Target a single user using `field:value`.
      --users-def=<value>    Path to a user definition JSON file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Capture user assignment state to a portable snapshot file.

  Captures matching users' active/frozen state and access assignments using developer/API names so the snapshot can be
  restored later.

EXAMPLES
  Snapshot a single user:

    $ sf jawn user snapshot --user username:someone@example.com --out snapshots/user.json --target-org myOrg

  Snapshot users from a definition file:

    $ sf jawn user snapshot --users-def config/user-def.json --external-id FederationIdentifier --out ^
      snapshots/users.json --target-org myOrg

FLAG DESCRIPTIONS
  --api-version=<value>  Override the api version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/user/snapshot.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/user/snapshot.ts)_

## `sf jawn user strip`

Strip and deactivate one or more users.

```
USAGE
  $ sf jawn user strip -o <value> [--json] [--flags-dir <value>] [--user <value>] [--users-def <value>]
    [--external-id <value>] [--no-prompt] [--dry-run] [--no-freeze] [--no-deactivate] [--keep-permsets]
    [--keep-permset-groups] [--keep-licenses] [--keep-public-groups] [--keep-queues] [--snapshot <value>] [--api-version
    <value>]

FLAGS
  -o, --target-org=<value>   (required) Target org username or alias.
      --api-version=<value>  Override the api version used for the org connection.
      --dry-run              Validate and plan actions without any write operations.
      --external-id=<value>  Default User field used to match entries in `--users-def`.
      --keep-licenses        Keep permission set license assignments.
      --keep-permset-groups  Keep permission set group assignments.
      --keep-permsets        Keep permission set assignments.
      --keep-public-groups   Keep public group memberships.
      --keep-queues          Keep queue memberships.
      --no-deactivate        Skip the final deactivation step.
      --no-freeze            Skip the initial freeze step.
      --no-prompt            Skip confirmation prompts before write operations.
      --snapshot=<value>     Write a portable user snapshot JSON file before stripping access, including during dry-run.
      --user=<value>         Target a single user using `field:value`.
      --users-def=<value>    Path to a user definition JSON file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Strip and deactivate one or more users.

  Freezes matching users, removes access grants, and deactivates the user unless the corresponding opt-out flags are
  set.

EXAMPLES
  Preview a strip for a single user:

    $ sf jawn user strip --user username:someone@example.com --dry-run --target-org myOrg

  Strip users from a definition file without prompts:

    $ sf jawn user strip --users-def config/user-def.json --external-id FederationIdentifier --target-org myOrg ^
      --no-prompt

  Keep permission set licenses while stripping everything else:

    $ sf jawn user strip --users-def config/user-def.json --keep-licenses --target-org myOrg --dry-run

  Capture a restorable snapshot before stripping:

    $ sf jawn user strip --user username:someone@example.com --snapshot snapshots/user.json --target-org myOrg ^
      --no-prompt

FLAG DESCRIPTIONS
  --api-version=<value>  Override the api version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/user/strip.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/user/strip.ts)_

## `sf jawn user unfreeze`

Unfreeze one or more users.

```
USAGE
  $ sf jawn user unfreeze -o <value> [--json] [--flags-dir <value>] [--user <value>] [--users-def <value>]
    [--external-id <value>] [--no-prompt] [--dry-run] [--api-version <value>]

FLAGS
  -o, --target-org=<value>   (required) Target org username or alias.
      --api-version=<value>  Override the api version used for the org connection.
      --dry-run              Validate and plan actions without any write operations.
      --external-id=<value>  Default User field used to match entries in `--users-def`.
      --no-prompt            Skip confirmation prompts before write operations.
      --user=<value>         Target a single user using `field:value`.
      --users-def=<value>    Path to a user definition JSON file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Unfreeze one or more users.

  Unfreezes matching users by setting `UserLogin.IsFrozen = false` and leaving all other access untouched.

EXAMPLES
  Preview a single unfreeze by field match:

    $ sf jawn user unfreeze --user username:someone@example.com --dry-run --target-org myOrg

  Unfreeze users from a definition file without prompts:

    $ sf jawn user unfreeze --users-def config/user-def.json --external-id FederationIdentifier --target-org myOrg ^
      --no-prompt

FLAG DESCRIPTIONS
  --api-version=<value>  Override the api version used for the org connection.

    Override the api version used for api requests made by this command
```

_See code: [src/commands/jawn/user/unfreeze.ts](https://github.com/Syntax-Syllogism/jawn/blob/v0.5.0/src/commands/jawn/user/unfreeze.ts)_
<!-- commandsstop -->

### `user provision` - User and persona definition files

User definitions and persona definitions live in two separate JSON files so that user-specific data stays decoupled from reusable access bundles.

#### Field naming

* User fields must be Salesforce `User` API field names.
* Input field names are accepted case-insensitively and canonicalized using `User` describe metadata before any DML.
* User-level fields override persona `userAttributes` when both supply a value.
* A user may also include a `match` meta key to choose its own lookup field.

#### Multiple personas per user

Each user entry must include a `personas` array listing one or more persona names defined in `persona-def.json`. The command merges all named personas into a single effective persona before planning:

* **Assignment lists** (`permissionSets`, `permissionSetGroups`, `publicGroups`, `queues`) are unioned across all personas, with duplicates removed in first-seen order.
* **Singular values** (`profile`, `role`, per-category modes) must agree across all personas. If two personas specify different values for the same singular field, that user fails with a per-row conflict error — the rest of the batch continues.
* **`userAttributes` keys** are also conflict-checked. If two personas supply the same key with different values, the user fails unless the user entry itself overrides that field (user-level value always wins).

> **Breaking change from earlier versions:** the old single-string `"persona"` key is no longer supported. A user entry with `"persona": "..."` produces a per-row migration error. Replace it with `"personas": ["..."]`.

#### Username and Alias defaults (insert only)

When creating a new user (no matching existing record), `Username` and `Alias` are automatically derived if omitted:

* **`Username`** — defaults to `<Email>.<myDomain>`, where `<myDomain>` is the first DNS label of the org's My Domain hostname (e.g. `jdoe@acme.com` + org `mycompany.my.salesforce.com` → `jdoe@acme.com.mycompany`). If the domain cannot be derived, the field is left unset and the normal missing-required-field error is reported.
* **`Alias`** — derived from `FirstName` and `LastName`: take up to 3 letters from each; when one name is shorter than 3 letters, borrow from the other to target 6 total; lowercase; truncated to Salesforce's 8-char limit. Examples: `John`/`Doe` → `johdoe`; `Jo`/`Anderson` → `joande`; `Al`/`Bo` → `albo`.

Defaults are never applied to users matched for update, and explicit `Username`/`Alias` values in the user entry are always used as-is.

#### Field precedence

User-level values override persona values for every overlapping field. The only place a persona "wins" outright is by contributing assignment-list entries (which union) and by supplying a value the user left unset.

| Setting                                                       | Set on a user (`user-def.json`)                           | Set on a persona (`persona-def.json`) | Who wins                                              | Notes                                                                                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Profile**                                                   | `profile` (name or 15/18-char Id) **or** raw `ProfileId`  | `profile` (name or Id)                | user `profile` → user `ProfileId` → persona `profile` | `Profile.Name` resolution. Setting both `profile` and `ProfileId` on one user is a per-row error. Required on insert. |
| **Role**                                                      | `role` (DeveloperName/Name or Id) **or** raw `UserRoleId` | `role`                                | user `role` → user `UserRoleId` → persona `role`      | `UserRole.DeveloperName`/`Name` resolution. Both `role`+`UserRoleId` is a per-row error. Optional.                    |
| **Username**                                                  | `Username`                                                | persona `userAttributes.Username`     | explicit value > computed default                     | Default `<Email>.<myDomain>`, **insert only**.                                                                        |
| **Alias**                                                     | `Alias`                                                   | persona `userAttributes.Alias`        | explicit value > computed default                     | Default 3+3 name derivation, **insert only**.                                                                         |
| **Permission-flag fields** (`UserPermissionKnowledgeUser`, …) | direct boolean field                                      | persona `userAttributes`              | user field > persona `userAttributes`                 | Written onto `User`; subject to org licenses.                                                                         |
| **Other writeable `User` fields** (`Title`, `Department`, …)  | direct field                                              | persona `userAttributes`              | user field > persona `userAttributes`                 | Canonicalized case-insensitively against `User` describe.                                                             |
| **Assignment lists** (permission sets, groups, queues)        | — (not settable per user)                                 | persona lists + per-category `…Mode`  | union across all personas                             | Resolved by name/Id; `additive` keeps existing, `sync` removes unlisted.                                              |
| **Match field** (upsert key)                                  | `match` meta key                                          | —                                     | per-user `match` > `--external-id` flag               | Must be an external-Id field or `Username`/`Email`/`FederationIdentifier`.                                            |
| **IsActive**                                                  | —                                                         | —                                     | always `true`                                         | Provisioning always activates and unfreezes.                                                                          |

A user-level `profile` or `role` also suppresses the corresponding persona-vs-persona conflict error for that field — if you name your own profile it no longer matters that two personas disagreed.

#### Match resolution

* `--external-id` sets the default field used to match existing users.
* A per-user `match` value overrides the flag for that row only.
* If neither is present, the user is treated as an insert.

#### Mixed-source example

```json
{
  "users": [
    { "personas": ["ops"], "match": "FederationIdentifier", "FederationIdentifier": "ABC123", "LastName": "Park" },
    { "personas": ["csr"], "match": "Username", "Username": "bob@acme.com.dev", "LastName": "Bob" },
    { "personas": ["finance"], "match": "Employee_ID__c", "Employee_ID__c": "E-9981", "LastName": "Su" },
    { "personas": ["creator"], "Username": "alice@acme.com.dev", "LastName": "Alice" }
  ]
}
```

#### Practical required fields for new user creation

The following fields are required when inserting a new user. `Username` and `Alias` can be omitted and will be defaulted automatically (see above); all others must be explicitly provided.

* `Username` _(auto-defaulted from `Email` + org My Domain if omitted)_
* `LastName`
* `Alias` _(auto-defaulted from `FirstName`/`LastName` if omitted)_
* `TimeZoneSidKey`
* `LocaleSidKey`
* `EmailEncodingKey`
* `LanguageLocaleKey`
* `ProfileId` when no persona specifies `profile`

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

Each assignment category has its own mode property. The default for every category is `additive`. When multiple personas are merged, the mode for each category must agree across all personas that specify it; a disagreement is a per-row conflict error.

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

#### Example `user-def.json`

```json
{
  "users": [
    {
      "personas": ["admin"],
      "FederationIdentifier": "ABCD1234",
      "FirstName": "John",
      "LastName": "Doe",
      "Email": "jdoe@email.com",
      "LocaleSidKey": "en_US",
      "EmailEncodingKey": "UTF-8",
      "LanguageLocaleKey": "en_US",
      "TimeZoneSidKey": "America/Los_Angeles"
    }
  ]
}
```

`Username` and `Alias` are omitted above and will be defaulted on insert to `jdoe@email.com.<myDomain>` and `johdoe` respectively.

#### Example `persona-def.json`

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

### `user access` -- command notes

* The command is read-only and performs no DML.
* `--type field` expects a qualified field target such as `Account.CustomField__c`.
* `--type object` expects an object API name such as `Account`.
* Supported output modes are `human`, `csv`, and `json`.
* Muted access from Muting Permission Sets is excluded when evaluating Permission Set Group pathways.
* If a field has no explicit `FieldPermissions` rows (common for some standard fields), the command returns success with a warning; base visibility may still exist outside explicit FLS grants.
* Very large orgs are constrained by Salesforce query/API limits; the command paginates through query results using `queryMore` until Salesforce indicates completion.

#### Access examples

```bash
# Human output (default)
sf jawn user access --type field --target Account.CustomField__c --target-org myOrg

# CSV output
sf jawn user access --type object --target Account --target-org myOrg --output csv

# JSON output
sf jawn user access --type field --target Account.CustomField__c --target-org myOrg --output json
```
