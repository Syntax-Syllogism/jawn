# summary

Generate an AT4DX domain-process action class, test, and binding metadata.

# description

Creates offline action scaffolding and a DomainProcessBinding record without requiring an org connection.

# info.created

Generated %s files (%s skipped).

# info.reviewBinding

Review the generated binding defaults: RelatedDomainBindingSObjectAlternate**c (nil), ExecuteAsynchronous**c=false, LogicalInverse**c=false, PreventRecursive**c=false, ProcessContext**c=TriggerExecution, DomainMethodToken**c (nil), and Description\_\_c.

# error.invalidOrder

`--order` must be a decimal-like value such as `10.1` or `10.2`.

# error.bindingNameTooLong

The generated binding developer name `%s` is longer than the 40-character Salesforce limit.

# examples

- Generate action artifacts with defaults:

  <%= config.bin %> <%= command.id %> -s Account -c DefaultAccountSloganBasedOnNameAction
