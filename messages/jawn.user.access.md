# summary

Audit active-user access for a permission target.

# description

Resolves active users who have access to a target and attributes each access path to Profile, Permission Set, or Permission Set Group sources.

# flags.target-org.summary

Target org username or alias.

# flags.type.summary

Target type to audit. Phase 1 supports field and object.

# flags.target.summary

Target API name. Use Object.Field for field type and Object for object type.

# flags.output.summary

Output format: human, csv, or json. Defaults to human.

# flags.api-version.summary

Override the api version used for the org connection.

# errorUnsupportedAccessType

Unsupported access type: %s.

# errorInvalidTarget

Invalid target value: %s.

# errorFieldTargetMustBeQualified

Field target must be qualified as ObjectApiName.FieldApiName: %s.

# errorObjectNotFound

Object not found: %s.

# errorFieldNotFound

Field %2$s was not found on object %1$s.

# errorAccessQueryFailed

Failed to resolve access for %s target %s.

# info.noResults

No active users matched this target.

# examples

- Field access in human output (default):

  <%= config.bin %> <%= command.id %> --type field --target Account.CustomField\_\_c --target-org myOrg

- Object access in csv output:

  <%= config.bin %> <%= command.id %> --type object --target Account --target-org myOrg --output csv

- Field access in json output:

  <%= config.bin %> <%= command.id %> --type field --target Account.CustomField\_\_c --target-org myOrg --output json
