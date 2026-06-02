export type AssignmentMode = 'additive' | 'sync';

export type PersonaDefinition = {
  profile?: string;
  role?: string;
  permissionSetMode?: AssignmentMode;
  permissionSetGroupMode?: AssignmentMode;
  publicGroupMode?: AssignmentMode;
  queueMode?: AssignmentMode;
  permissionSets?: string[];
  permissionSetGroups?: string[];
  publicGroups?: string[];
  queues?: string[];
  userAttributes?: Record<string, unknown>;
};

export type UserInput = Record<string, unknown> & { persona?: string };

export type ValidationWarning = { message: string; userKey?: string };
export type ValidationError = {
  messageKey: 'errorInvalidUserMatchField' | 'errorUserMatchFieldEmpty';
  messageArgs: string[];
};

export type CanonicalizedUser = {
  inputKey: string;
  persona: string;
  matchField?: string;
  fields: Record<string, unknown>;
  validationErrors?: ValidationError[];
};

export const modeKeys = ['permissionSetMode', 'permissionSetGroupMode', 'publicGroupMode', 'queueMode'] as const;

export const assignmentListKeys = ['permissionSets', 'permissionSetGroups', 'publicGroups', 'queues'] as const;
const reservedUserKeys = new Set(['persona', 'match']);

export type UserFieldMeta = {
  name: string;
  createable: boolean;
  updateable: boolean;
  externalId?: boolean;
};

/**
 * Lightweight shape check only.
 * Callers should apply object-specific Id prefix filtering at use sites.
 */
export const isSalesforceId = (value: string): boolean =>
  /^[a-zA-Z0-9]{3}[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/.test(value);

export const normalizeMode = (value: unknown): AssignmentMode => {
  if (value === undefined) return 'additive';
  if (value === 'additive' || value === 'sync') return value;
  throw new Error(`Invalid assignment mode "${String(value)}". Expected additive or sync.`);
};

export const buildFieldMap = (fields: UserFieldMeta[]): Map<string, UserFieldMeta> => {
  const map = new Map<string, UserFieldMeta>();
  for (const field of fields) map.set(field.name.toLowerCase(), field);
  return map;
};

export const canonicalizeFieldObject = (
  source: Record<string, unknown> | undefined,
  fieldMap: Map<string, UserFieldMeta>,
  context: string
): Record<string, unknown> => {
  if (!source) return {};
  const output: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(source)) {
    const meta = fieldMap.get(rawKey.toLowerCase());
    if (!meta) throw new Error(`${context}: unknown User field "${rawKey}".`);
    output[meta.name] = value;
  }
  return output;
};

export const validateExternalIdField = (externalId: string, fieldMap: Map<string, UserFieldMeta>): UserFieldMeta => {
  const meta = fieldMap.get(externalId.toLowerCase());
  if (!meta) throw new Error(`Invalid match field "${externalId}".`);
  if (meta.externalId) return meta;
  const allowed = new Set(['Username', 'Email', 'FederationIdentifier']);
  if (!allowed.has(meta.name)) {
    throw new Error(`Invalid match field "${externalId}".`);
  }
  return meta;
};

export const validateExternalIdFieldForFlag = (
  externalId: string | undefined,
  fieldMap: Map<string, UserFieldMeta>
): UserFieldMeta | undefined => {
  if (!externalId) return undefined;
  try {
    return validateExternalIdField(externalId, fieldMap);
  } catch {
    throw new Error(
      `Invalid --external-id field "${externalId}". Must be a User external ID field, or one of Username, Email, FederationIdentifier.`
    );
  }
};

const buildValidationError = (messageKey: ValidationError['messageKey'], messageArgs: string[]): ValidationError => ({
  messageKey,
  messageArgs,
});

const resolveUserMatchField = (
  rawMatch: unknown,
  merged: Record<string, unknown>,
  fieldMap: Map<string, UserFieldMeta>
): { matchField?: string; validationErrors: ValidationError[] } => {
  if (rawMatch === undefined) return { validationErrors: [] };
  if (typeof rawMatch !== 'string') {
    return {
      validationErrors: [buildValidationError('errorInvalidUserMatchField', [String(rawMatch)])],
    };
  }
  try {
    const meta = validateExternalIdField(rawMatch, fieldMap);
    const matchField = meta.name;
    const matchValue = merged[matchField];
    if (typeof matchValue !== 'string' || matchValue.length === 0) {
      return {
        matchField,
        validationErrors: [buildValidationError('errorUserMatchFieldEmpty', [matchField])],
      };
    }
    return { matchField, validationErrors: [] };
  } catch {
    return {
      validationErrors: [buildValidationError('errorInvalidUserMatchField', [rawMatch])],
    };
  }
};

export const mergeUserFields = (
  personaUserAttributes: Record<string, unknown>,
  userFields: Record<string, unknown>
): Record<string, unknown> => ({
  ...personaUserAttributes,
  ...userFields,
});

export const validateAndCanonicalizeUsers = (
  rawUsers: unknown,
  personas: Record<string, PersonaDefinition>,
  fieldMap: Map<string, UserFieldMeta>
): CanonicalizedUser[] => {
  if (!Array.isArray(rawUsers)) throw new Error('user-def.json must contain a users array.');
  const users: CanonicalizedUser[] = [];
  for (const rawUser of rawUsers) {
    if (!rawUser || typeof rawUser !== 'object') throw new Error('Each user entry must be an object.');
    const input = rawUser as UserInput;
    const personaName = input.persona;
    if (!personaName || typeof personaName !== 'string') throw new Error('Each user entry must include persona.');
    const persona = personas[personaName];
    if (!persona) throw new Error(`Unknown persona "${personaName}".`);
    const candidateFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (!reservedUserKeys.has(k.toLowerCase())) candidateFields[k] = v;
    }
    const personaFields = canonicalizeFieldObject(persona.userAttributes, fieldMap, `persona ${personaName}`);
    const userFields = canonicalizeFieldObject(candidateFields, fieldMap, `user persona=${personaName}`);
    const merged = mergeUserFields(personaFields, userFields);
    const rawMatch = Object.entries(input).find(([k]) => k.toLowerCase() === 'match')?.[1];
    const { matchField, validationErrors } = resolveUserMatchField(rawMatch, merged, fieldMap);
    const inputKey =
      (typeof merged.FederationIdentifier === 'string' && merged.FederationIdentifier) ||
      (typeof merged.Username === 'string' && merged.Username) ||
      (typeof merged.Email === 'string' && merged.Email) ||
      `${personaName}:${users.length + 1}`;
    users.push({
      inputKey,
      persona: personaName,
      matchField,
      fields: merged,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    });
  }
  return users;
};

export const validatePersonaModes = (personas: Record<string, PersonaDefinition>): void => {
  for (const [personaKey, persona] of Object.entries(personas)) {
    for (const modeKey of modeKeys) normalizeMode(persona[modeKey]);
    for (const listKey of assignmentListKeys) {
      const candidate = persona[listKey];
      if (candidate !== undefined && !Array.isArray(candidate)) {
        throw new Error(`Persona "${personaKey}" has non-array ${listKey}.`);
      }
    }
  }
};

export const practicalRequiredUserFields = [
  'Username',
  'LastName',
  'Alias',
  'TimeZoneSidKey',
  'LocaleSidKey',
  'EmailEncodingKey',
  'LanguageLocaleKey',
] as const;

export const missingRequiredFieldsForInsert = (
  fields: Record<string, unknown>,
  persona: PersonaDefinition
): string[] => {
  const missing: string[] = practicalRequiredUserFields.filter((field) => !fields[field]);
  if (!persona.profile && !fields.ProfileId) missing.push('ProfileId');
  return missing;
};
