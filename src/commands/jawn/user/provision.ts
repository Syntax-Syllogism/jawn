import { readFile } from 'node:fs/promises';
import { Connection, Messages, SfError } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  buildFieldMap,
  CanonicalizedUser,
  isSalesforceId,
  missingRequiredFieldsForInsert,
  normalizeMode,
  PersonaDefinition,
  UserFieldMeta,
  validateAndCanonicalizeUsers,
  validateExternalIdField,
  validatePersonaModes,
} from '../../../userProvisioning/planner.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@syntax-syllogism/jawn', 'jawn.user.provision');

type JsonRecord = Record<string, unknown>;
type SaveError = { message: string; statusCode?: string; fields?: string[] };
type SaveResult = { success: boolean; id?: string; errors: SaveError[] };
type ExistingUser = { Id: string; IsActive?: boolean; matchKey: string };
type ExistingAssignment = { Id: string; PermissionSetId?: string; PermissionSetGroupId?: string };
type ExistingMembership = { Id: string; GroupId: string; GroupType?: string };
type AssignmentPlan = { adds: string[]; removes: string[] };

type ResolvedRefs = {
  profilesByRef: Map<string, string>;
  rolesByRef: Map<string, string>;
  permissionSetIdsByRef: Map<string, string>;
  permissionSetGroupIdsByRef: Map<string, string>;
  publicGroupIdsByRef: Map<string, string>;
  queueIdsByRef: Map<string, string>;
  warnings: string[];
};

type UserPlan = {
  planId: string;
  order: number;
  key: string;
  persona: string;
  target: JsonRecord;
  existing?: ExistingUser;
  actions: string[];
  errors: string[];
};

type UserSaveOutcome = {
  plan: UserPlan;
  success: boolean;
  id?: string;
  errors: string[];
};
type OrderedUserResult = UserResult & { order: number; planId: string };

type UserResult = {
  key: string;
  id?: string;
  persona: string;
  status: 'created' | 'updated' | 'failed' | 'planned';
  actions: string[];
  errors: string[];
};

export type ProvisionResult = {
  summary: { total: number; created: number; updated: number; failed: number; warnings: number };
  users: UserResult[];
};

const DRY_RUN_CREATE_ID = 'dry-run-create';
const USER_PROCESS_CONCURRENCY = 10;
const esc = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
const soqlIn = (values: string[]): string => values.map((v) => `'${esc(v)}'`).join(',');
const asArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);
const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8')) as unknown;

const readJsonOrThrow = async (path: string): Promise<unknown> => {
  try {
    return await readJson(path);
  } catch (error) {
    throw new SfError(
      messages.getMessage('errorInvalidJson', [path, error instanceof Error ? error.message : String(error)])
    );
  }
};

const formatSaveError = (error: SaveError): string => {
  const fieldSuffix = error.fields && error.fields.length > 0 ? ` (fields: ${error.fields.join(', ')})` : '';
  return error.statusCode ? `${error.statusCode}: ${error.message}${fieldSuffix}` : error.message;
};

const appendCrossReferenceCandidates = (errors: string[], target: JsonRecord): string[] => {
  const hasCrossRefError = errors.some((e) => e.includes('INVALID_CROSS_REFERENCE_KEY'));
  if (!hasCrossRefError) return errors;
  const candidateFields = Object.entries(target)
    .filter(([field]) => field.endsWith('Id') && field !== 'Id')
    .map(([field, value]) => `${field}=${String(value)}`);
  if (candidateFields.length === 0) return errors;
  return errors.concat(messages.getMessage('errorCrossReferenceCandidates', [candidateFields.join(', ')]));
};

const pushErrors = (errors: string[], saveResults: SaveResult | SaveResult[] | undefined): void => {
  if (!saveResults) return;
  for (const result of asArray(saveResults))
    if (!result.success) errors.push(...result.errors.map((e) => formatSaveError(e)));
};

const collectPersonaRefs = (personas: Record<string, PersonaDefinition>): Record<string, Set<string>> => {
  const refs = {
    profiles: new Set<string>(),
    roles: new Set<string>(),
    permissionSets: new Set<string>(),
    permissionSetGroups: new Set<string>(),
    publicGroups: new Set<string>(),
    queues: new Set<string>(),
  };
  for (const persona of Object.values(personas)) {
    if (persona.profile) refs.profiles.add(persona.profile);
    if (persona.role) refs.roles.add(persona.role);
    for (const value of persona.permissionSets ?? []) refs.permissionSets.add(value);
    for (const value of persona.permissionSetGroups ?? []) refs.permissionSetGroups.add(value);
    for (const value of persona.publicGroups ?? []) refs.publicGroups.add(value);
    for (const value of persona.queues ?? []) refs.queues.add(value);
  }
  return refs;
};

const resolveByIdOrName = async (
  conn: Connection,
  table: string,
  idOrNameRefs: Set<string>,
  nameField: string,
  whereClause: string | undefined,
  warnings: string[],
  idPrefixes?: string[]
): Promise<Map<string, string>> => {
  const resolved = new Map<string, string>();
  const ids = [...idOrNameRefs].filter((r) => isSalesforceId(r) && (!idPrefixes || idPrefixes.includes(r.slice(0, 3))));
  const names = [...idOrNameRefs].filter((r) => !isSalesforceId(r));
  if (ids.length > 0) {
    const where = [`Id IN (${soqlIn(ids)})`, whereClause].filter(Boolean).join(' AND ');
    const rows = (await conn.query<{ Id: string }>(`SELECT Id FROM ${table} WHERE ${where}`)).records;
    for (const row of rows) resolved.set(row.Id, row.Id);
  }
  if (names.length > 0) {
    const where = [`${nameField} IN (${soqlIn(names)})`, whereClause].filter(Boolean).join(' AND ');
    const rows = (
      await conn.query<{ Id: string } & Record<string, string>>(`SELECT Id, ${nameField} FROM ${table} WHERE ${where}`)
    ).records;
    for (const row of rows) resolved.set(row[nameField], row.Id);
  }
  for (const ref of idOrNameRefs)
    if (!resolved.has(ref)) warnings.push(messages.getMessage('warningReferenceMissing', [table, ref]));
  return resolved;
};

const resolveByRoleRef = async (
  conn: Connection,
  refs: Set<string>,
  warnings: string[]
): Promise<Map<string, string>> => {
  const resolved = new Map<string, string>();
  const ids = [...refs].filter((r) => isSalesforceId(r) && r.startsWith('00E'));
  const names = [...refs].filter((r) => !isSalesforceId(r));
  if (ids.length > 0) {
    const rows = (await conn.query<{ Id: string }>(`SELECT Id FROM UserRole WHERE Id IN (${soqlIn(ids)})`)).records;
    for (const row of rows) resolved.set(row.Id, row.Id);
  }
  if (names.length > 0) {
    const rows = (
      await conn.query<{ Id: string; DeveloperName: string; Name: string }>(
        `SELECT Id, DeveloperName, Name FROM UserRole WHERE DeveloperName IN (${soqlIn(names)}) OR Name IN (${soqlIn(
          names
        )})`
      )
    ).records;
    for (const row of rows) {
      if (names.includes(row.DeveloperName)) resolved.set(row.DeveloperName, row.Id);
      if (names.includes(row.Name)) resolved.set(row.Name, row.Id);
    }
  }
  for (const ref of refs)
    if (!resolved.has(ref)) warnings.push(messages.getMessage('warningReferenceMissing', ['UserRole', ref]));
  return resolved;
};

const resolveReferences = async (
  conn: Connection,
  personas: Record<string, PersonaDefinition>
): Promise<ResolvedRefs> => {
  const warnings: string[] = [];
  const refs = collectPersonaRefs(personas);
  const [
    profilesByRef,
    rolesByRef,
    permissionSetIdsByRef,
    permissionSetGroupIdsByRef,
    publicGroupIdsByRef,
    queueIdsByRef,
  ] = await Promise.all([
    resolveByIdOrName(conn, 'Profile', refs.profiles, 'Name', undefined, warnings, ['00e']),
    resolveByRoleRef(conn, refs.roles, warnings),
    resolveByIdOrName(conn, 'PermissionSet', refs.permissionSets, 'Name', undefined, warnings, ['0PS']),
    resolveByIdOrName(conn, 'PermissionSetGroup', refs.permissionSetGroups, 'DeveloperName', undefined, warnings, [
      '0PG',
    ]),
    resolveByIdOrName(conn, 'Group', refs.publicGroups, 'DeveloperName', "Type = 'Regular'", warnings, ['00G']),
    resolveByIdOrName(conn, 'Group', refs.queues, 'DeveloperName', "Type = 'Queue'", warnings, ['00G']),
  ]);
  return {
    profilesByRef,
    rolesByRef,
    permissionSetIdsByRef,
    permissionSetGroupIdsByRef,
    publicGroupIdsByRef,
    queueIdsByRef,
    warnings,
  };
};

const getExistingUsers = async (
  conn: Connection,
  users: CanonicalizedUser[],
  externalIdField: string | undefined
): Promise<{ existingByKey: Map<string, ExistingUser>; duplicates: Set<string> }> => {
  const existingByKey = new Map<string, ExistingUser>();
  const duplicates = new Set<string>();
  if (!externalIdField) return { existingByKey, duplicates };
  const matchValues = [
    ...new Set(
      users.map((u) => u.fields[externalIdField]).filter((v): v is string => typeof v === 'string' && v.length > 0)
    ),
  ];
  if (matchValues.length === 0) return { existingByKey, duplicates };
  const rows = (
    await conn.query<{ Id: string; IsActive: boolean } & Record<string, string>>(
      `SELECT Id, IsActive, ${externalIdField} FROM User WHERE ${externalIdField} IN (${soqlIn(matchValues)})`
    )
  ).records;
  for (const row of rows) {
    const key = row[externalIdField];
    if (existingByKey.has(key)) {
      duplicates.add(key);
      continue;
    }
    existingByKey.set(key, { Id: row.Id, IsActive: row.IsActive, matchKey: key });
  }
  return { existingByKey, duplicates };
};

const ensureWritableFields = (
  target: JsonRecord,
  existing: ExistingUser | undefined,
  fieldMap: Map<string, UserFieldMeta>,
  errors: string[]
): void => {
  for (const field of Object.keys(target)) {
    if (field === 'Id') continue;
    const meta = fieldMap.get(field.toLowerCase());
    if (!meta) continue;
    if (existing ? !meta.updateable : !meta.createable) {
      errors.push(messages.getMessage('errorFieldNotWritable', [field, existing ? 'updateable' : 'createable']));
    }
  }
};

const buildTarget = (
  user: CanonicalizedUser,
  persona: PersonaDefinition,
  refs: ResolvedRefs,
  errors: string[]
): JsonRecord => {
  const target: JsonRecord = { ...user.fields, IsActive: true };
  if (persona.profile) {
    const profileId = refs.profilesByRef.get(persona.profile);
    if (!profileId) errors.push(messages.getMessage('errorReferenceRequiredMissing', ['Profile', persona.profile]));
    else target.ProfileId = profileId;
  }
  if (persona.role) {
    const roleId = refs.rolesByRef.get(persona.role);
    if (!roleId) errors.push(messages.getMessage('errorReferenceRequiredMissing', ['UserRole', persona.role]));
    else target.UserRoleId = roleId;
  }
  return target;
};

export const getMembershipPlans = (
  existingMemberships: ExistingMembership[],
  publicTargets: string[],
  queueTargets: string[],
  publicMode: string | undefined,
  queueMode: string | undefined
): { publicAdds: string[]; publicRemoves: string[]; queueAdds: string[]; queueRemoves: string[] } => {
  const publicCurrent = existingMemberships.filter((m) => m.GroupType === 'Regular');
  const queueCurrent = existingMemberships.filter((m) => m.GroupType === 'Queue');
  const compute = (
    current: ExistingMembership[],
    targetIds: string[],
    modeRaw: string | undefined
  ): { adds: string[]; removes: string[] } => {
    const currentIds = new Set(current.map((c) => c.GroupId));
    const target = new Set(targetIds);
    const adds = [...target].filter((id) => !currentIds.has(id));
    const mode = normalizeMode(modeRaw);
    const removes = mode === 'sync' ? current.filter((c) => !target.has(c.GroupId)).map((c) => c.Id) : [];
    return { adds, removes };
  };
  const publicPlan = compute(publicCurrent, publicTargets, publicMode);
  const queuePlan = compute(queueCurrent, queueTargets, queueMode);
  return {
    publicAdds: publicPlan.adds,
    publicRemoves: publicPlan.removes,
    queueAdds: queuePlan.adds,
    queueRemoves: queuePlan.removes,
  };
};

const computeAssignmentPlan = (
  current: ExistingAssignment[],
  targetIds: string[],
  modeRaw: string | undefined,
  getId: (row: ExistingAssignment) => string | undefined
): AssignmentPlan => {
  const currentIds = new Set(current.map(getId).filter((v): v is string => Boolean(v)));
  const target = new Set(targetIds);
  const adds = [...target].filter((id) => !currentIds.has(id));
  const removes =
    normalizeMode(modeRaw) === 'sync'
      ? current.filter((c) => getId(c) && !target.has(getId(c) as string)).map((c) => c.Id)
      : [];
  return { adds, removes };
};

const appendAssignmentActions = (
  actions: string[],
  dryRun: boolean,
  permSetPlan: AssignmentPlan,
  permSetGroupPlan: AssignmentPlan,
  membershipPlan: { publicAdds: string[]; publicRemoves: string[]; queueAdds: string[]; queueRemoves: string[] }
): void => {
  const addActionIfAny = (values: unknown[], action: string): void => {
    if (values.length > 0) actions.push(action);
  };
  addActionIfAny(permSetPlan.adds, dryRun ? 'wouldAssignPermissionSet' : 'assignedPermissionSet');
  addActionIfAny(permSetPlan.removes, dryRun ? 'wouldRemovePermissionSet' : 'removedPermissionSet');
  addActionIfAny(permSetGroupPlan.adds, dryRun ? 'wouldAssignPermissionSetGroup' : 'assignedPermissionSetGroup');
  addActionIfAny(permSetGroupPlan.removes, dryRun ? 'wouldRemovePermissionSetGroup' : 'removedPermissionSetGroup');
  addActionIfAny(membershipPlan.publicAdds, dryRun ? 'wouldAddPublicGroupMember' : 'addedPublicGroupMember');
  addActionIfAny(membershipPlan.publicRemoves, dryRun ? 'wouldRemovePublicGroupMember' : 'removedPublicGroupMember');
  addActionIfAny(membershipPlan.queueAdds, dryRun ? 'wouldAddQueueMember' : 'addedQueueMember');
  addActionIfAny(membershipPlan.queueRemoves, dryRun ? 'wouldRemoveQueueMember' : 'removedQueueMember');
};

const performAssignmentDml = async (
  conn: Connection,
  userId: string,
  permSetPlan: AssignmentPlan,
  permSetGroupPlan: AssignmentPlan,
  membershipPlan: { publicAdds: string[]; publicRemoves: string[]; queueAdds: string[]; queueRemoves: string[] },
  errors: string[]
): Promise<void> => {
  const runDml = async (op: () => Promise<SaveResult | SaveResult[]>): Promise<void> => {
    pushErrors(errors, await op());
  };
  await runDml(() =>
    conn.sobject('PermissionSetAssignment').create(
      permSetPlan.adds.map((id) => ({ AssigneeId: userId, PermissionSetId: id })),
      { allOrNone: false }
    )
  );
  await runDml(() => conn.sobject('PermissionSetAssignment').delete(permSetPlan.removes, { allOrNone: false }));
  await runDml(() =>
    conn.sobject('PermissionSetAssignment').create(
      permSetGroupPlan.adds.map((id) => ({ AssigneeId: userId, PermissionSetGroupId: id })),
      { allOrNone: false }
    )
  );
  await runDml(() => conn.sobject('PermissionSetAssignment').delete(permSetGroupPlan.removes, { allOrNone: false }));
  await runDml(() =>
    conn.sobject('GroupMember').create(
      membershipPlan.publicAdds.map((groupId) => ({ GroupId: groupId, UserOrGroupId: userId })),
      { allOrNone: false }
    )
  );
  await runDml(() => conn.sobject('GroupMember').delete(membershipPlan.publicRemoves, { allOrNone: false }));
  await runDml(() =>
    conn.sobject('GroupMember').create(
      membershipPlan.queueAdds.map((groupId) => ({ GroupId: groupId, UserOrGroupId: userId })),
      { allOrNone: false }
    )
  );
  await runDml(() => conn.sobject('GroupMember').delete(membershipPlan.queueRemoves, { allOrNone: false }));
};

const applyAssignments = async (
  conn: Connection,
  userId: string,
  persona: PersonaDefinition,
  refs: ResolvedRefs,
  dryRun: boolean,
  actions: string[],
  errors: string[]
): Promise<void> => {
  const permissionSetTargets = (persona.permissionSets ?? [])
    .map((r) => refs.permissionSetIdsByRef.get(r))
    .filter((v): v is string => Boolean(v));
  const permissionSetGroupTargets = (persona.permissionSetGroups ?? [])
    .map((r) => refs.permissionSetGroupIdsByRef.get(r))
    .filter((v): v is string => Boolean(v));
  const publicTargets = (persona.publicGroups ?? [])
    .map((r) => refs.publicGroupIdsByRef.get(r))
    .filter((v): v is string => Boolean(v));
  const queueTargets = (persona.queues ?? [])
    .map((r) => refs.queueIdsByRef.get(r))
    .filter((v): v is string => Boolean(v));
  const hasAssignmentIntent =
    permissionSetTargets.length > 0 ||
    permissionSetGroupTargets.length > 0 ||
    publicTargets.length > 0 ||
    queueTargets.length > 0 ||
    normalizeMode(persona.permissionSetMode) === 'sync' ||
    normalizeMode(persona.permissionSetGroupMode) === 'sync' ||
    normalizeMode(persona.publicGroupMode) === 'sync' ||
    normalizeMode(persona.queueMode) === 'sync';
  if (!hasAssignmentIntent) return;

  const loadExistingAssignmentState = async (): Promise<{
    assignmentRows: ExistingAssignment[];
    membershipRows: ExistingMembership[];
  }> => {
    if (userId === DRY_RUN_CREATE_ID) return { assignmentRows: [], membershipRows: [] };
    const assignmentRows = (
      await conn.query<ExistingAssignment>(
        `SELECT Id, PermissionSetId, PermissionSetGroupId FROM PermissionSetAssignment WHERE AssigneeId = '${esc(
          userId
        )}'`
      )
    ).records;
    const membershipRows = (
      await conn.query<ExistingMembership & { Group: { Type: string } }>(
        `SELECT Id, GroupId, Group.Type FROM GroupMember WHERE UserOrGroupId = '${esc(userId)}'`
      )
    ).records.map((r) => ({ Id: r.Id, GroupId: r.GroupId, GroupType: r.Group?.Type }));
    return { assignmentRows, membershipRows };
  };
  const { assignmentRows, membershipRows } = await loadExistingAssignmentState();

  const permSetPlan = computeAssignmentPlan(
    assignmentRows.filter((r) => Boolean(r.PermissionSetId)),
    permissionSetTargets,
    persona.permissionSetMode,
    (r) => r.PermissionSetId
  );
  const permSetGroupPlan = computeAssignmentPlan(
    assignmentRows.filter((r) => Boolean(r.PermissionSetGroupId)),
    permissionSetGroupTargets,
    persona.permissionSetGroupMode,
    (r) => r.PermissionSetGroupId
  );
  const membershipPlan = getMembershipPlans(
    membershipRows,
    publicTargets,
    queueTargets,
    persona.publicGroupMode,
    persona.queueMode
  );

  appendAssignmentActions(actions, dryRun, permSetPlan, permSetGroupPlan, membershipPlan);
  if (dryRun) return;
  await performAssignmentDml(conn, userId, permSetPlan, permSetGroupPlan, membershipPlan, errors);
};

const batch = <T>(items: T[], size: number): T[][] =>
  items.reduce<T[][]>((groups, item, idx) => {
    if (idx % size === 0) groups.push([]);
    groups[groups.length - 1].push(item);
    return groups;
  }, []);

const summarize = (results: UserResult[], globalWarningCount: number): ProvisionResult['summary'] => ({
  total: results.length,
  created: results.filter((r) => r.status === 'created').length,
  updated: results.filter((r) => r.status === 'updated').length,
  failed: results.filter((r) => r.status === 'failed').length,
  warnings: globalWarningCount,
});

const runBatches = async <T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const itemBatches = batch(items, size);
  return itemBatches.reduce<Promise<R[]>>(async (accPromise, itemBatch) => {
    const acc = await accPromise;
    const next = await Promise.all(itemBatch.map(fn));
    return acc.concat(next);
  }, Promise.resolve([]));
};

const executeBulkUserSaves = async (conn: Connection, plans: UserPlan[]): Promise<UserSaveOutcome[]> => {
  const validPlans = plans.filter((p) => p.errors.length === 0);
  const createPlans = validPlans.filter((p) => !p.existing);
  const updatePlans = validPlans.filter((p): p is UserPlan & { existing: ExistingUser } => Boolean(p.existing));
  const outcomes: UserSaveOutcome[] = [];

  if (createPlans.length > 0) {
    const createResults = asArray(
      await conn.sobject('User').create(
        createPlans.map((p) => p.target),
        { allOrNone: false }
      )
    );
    outcomes.push(
      ...createPlans.map((plan, idx) => ({
        plan,
        success: createResults[idx]?.success === true && Boolean(createResults[idx]?.id),
        id: createResults[idx]?.id,
        errors: (createResults[idx]?.errors ?? []).map((e) => formatSaveError(e)),
      }))
    );
  }

  if (updatePlans.length > 0) {
    const updateResults = asArray(
      await conn.sobject('User').update(
        updatePlans.map((p) => ({ ...p.target, Id: p.existing.Id })),
        { allOrNone: false }
      )
    );
    outcomes.push(
      ...updatePlans.map((plan, idx) => ({
        plan,
        success: updateResults[idx]?.success === true && Boolean(updateResults[idx]?.id),
        id: updateResults[idx]?.id ?? plan.existing.Id,
        errors: (updateResults[idx]?.errors ?? []).map((e) => formatSaveError(e)),
      }))
    );
  }

  return outcomes;
};

export default class UserProvision extends SfCommand<ProvisionResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg({ summary: messages.getMessage('flags.target-org.summary') }),
    'users-def': Flags.file({ required: true, exists: true, summary: messages.getMessage('flags.users-def.summary') }),
    'personas-def': Flags.file({
      required: true,
      exists: true,
      summary: messages.getMessage('flags.personas-def.summary'),
    }),
    'external-id': Flags.string({ summary: messages.getMessage('flags.external-id.summary') }),
    'no-prompt': Flags.boolean({ default: false, summary: messages.getMessage('flags.no-prompt.summary') }),
    'dry-run': Flags.boolean({ default: false, summary: messages.getMessage('flags.dry-run.summary') }),
    'api-version': Flags.orgApiVersion({ summary: messages.getMessage('flags.api-version.summary') }),
  };

  public async run(): Promise<ProvisionResult> {
    const { flags } = await this.parse(UserProvision);
    const conn = flags['target-org'].getConnection(flags['api-version'] ?? undefined);
    const usersDoc = (await readJsonOrThrow(flags['users-def'])) as JsonRecord;
    const personasDoc = (await readJsonOrThrow(flags['personas-def'])) as JsonRecord;
    if (!personasDoc.personas || typeof personasDoc.personas !== 'object' || Array.isArray(personasDoc.personas)) {
      throw new SfError(messages.getMessage('errorInvalidPersonaDefinition'));
    }

    const userDescribe = await conn.describe('User');
    const fieldMap = buildFieldMap(
      userDescribe.fields.map(
        (f): UserFieldMeta => ({
          name: f.name,
          createable: f.createable,
          updateable: f.updateable,
          externalId: f.externalId,
        })
      )
    );
    const personas = personasDoc.personas as Record<string, PersonaDefinition>;
    validatePersonaModes(personas);
    validateExternalIdField(flags['external-id'], fieldMap);
    const users = validateAndCanonicalizeUsers(usersDoc.users, personas, fieldMap);
    const externalIdField = flags['external-id'] ? fieldMap.get(flags['external-id'].toLowerCase())?.name : undefined;

    const [refs, existingResolution] = await Promise.all([
      resolveReferences(conn, personas),
      getExistingUsers(conn, users, externalIdField),
    ]);
    if (!this.jsonEnabled()) {
      for (const warning of refs.warnings) this.warn(warning);
      if (refs.warnings.length > 0 && !flags['no-prompt']) await this.confirmWarnings();
    }

    const plans: UserPlan[] = users.map((user, idx) => {
      const persona = personas[user.persona];
      const errors: string[] = [];
      const target = buildTarget(user, persona, refs, errors);
      const matchValue = externalIdField ? target[externalIdField] : undefined;
      const existing =
        externalIdField && typeof matchValue === 'string'
          ? existingResolution.existingByKey.get(matchValue)
          : undefined;
      if (typeof matchValue === 'string' && existingResolution.duplicates.has(matchValue)) {
        errors.push(
          messages.getMessage('errorDuplicateExternalIdMatch', [externalIdField ?? 'externalId', matchValue])
        );
      }
      if (!existing) {
        const missing = missingRequiredFieldsForInsert(target, persona);
        if (missing.length > 0) errors.push(messages.getMessage('errorMissingRequiredFields', [missing.join(', ')]));
      }
      ensureWritableFields(target, existing, fieldMap, errors);
      const actions = [
        existing ? (flags['dry-run'] ? 'wouldUpdate' : 'updated') : flags['dry-run'] ? 'wouldCreate' : 'created',
      ];
      if (!existing || existing.IsActive !== true) actions.push(flags['dry-run'] ? 'wouldActivate' : 'activated');
      return {
        planId: `${idx}:${user.inputKey}:${user.persona}`,
        order: idx,
        key: user.inputKey,
        persona: user.persona,
        target,
        existing,
        actions,
        errors,
      };
    });

    const processDryRunPlan = async (plan: UserPlan): Promise<OrderedUserResult> => {
      if (plan.errors.length > 0) {
        return {
          planId: plan.planId,
          order: plan.order,
          key: plan.key,
          persona: plan.persona,
          status: 'failed',
          actions: plan.actions,
          errors: plan.errors,
        };
      }
      const persona = personas[plan.persona];
      if (flags['dry-run']) {
        const dryRunId = plan.existing?.Id ?? DRY_RUN_CREATE_ID;
        if (plan.existing) {
          const frozenRows = (
            await conn.query<{ Id: string }>(
              `SELECT Id FROM UserLogin WHERE UserId = '${esc(plan.existing.Id)}' AND IsFrozen = true`
            )
          ).records;
          if (frozenRows.length > 0) plan.actions.push('wouldUnfreeze');
        }
        await applyAssignments(conn, dryRunId, persona, refs, true, plan.actions, plan.errors);
        return {
          planId: plan.planId,
          order: plan.order,
          key: plan.key,
          id: plan.existing?.Id,
          persona: plan.persona,
          status: 'planned',
          actions: plan.actions,
          errors: plan.errors,
        };
      }
      throw new SfError('internal: processDryRunPlan called for non-dry-run');
    };
    const processPostSave = async (outcome: UserSaveOutcome): Promise<OrderedUserResult> => {
      const { plan, id } = outcome;
      if (!id) {
        return {
          planId: plan.planId,
          order: plan.order,
          key: plan.key,
          persona: plan.persona,
          status: 'failed',
          actions: plan.actions,
          errors: [messages.getMessage('errorMissingSaveId')],
        };
      }
      const persona = personas[plan.persona];
      const frozenRows = (
        await conn.query<{ Id: string }>(`SELECT Id FROM UserLogin WHERE UserId = '${esc(id)}' AND IsFrozen = true`)
      ).records;
      if (frozenRows.length > 0) {
        const unfreezeResult = await conn.sobject('UserLogin').update(
          frozenRows.map((r) => ({ Id: r.Id, IsFrozen: false })),
          { allOrNone: false }
        );
        const unfreezeErrors: string[] = [];
        pushErrors(unfreezeErrors, unfreezeResult);
        if (unfreezeErrors.length > 0) plan.errors.push(...unfreezeErrors);
        else plan.actions.push('unfrozen');
      }
      await applyAssignments(conn, id, persona, refs, false, plan.actions, plan.errors);
      const status = plan.errors.length > 0 ? 'failed' : plan.existing ? 'updated' : 'created';
      return {
        planId: plan.planId,
        order: plan.order,
        key: plan.key,
        id,
        persona: plan.persona,
        status,
        actions: plan.actions,
        errors: plan.errors,
      };
    };

    const invalidResults: OrderedUserResult[] = plans
      .filter((p) => p.errors.length > 0)
      .map((p) => ({
        planId: p.planId,
        order: p.order,
        key: p.key,
        persona: p.persona,
        status: 'failed',
        actions: p.actions,
        errors: p.errors,
      }));

    const resultsWithOrder: OrderedUserResult[] = flags['dry-run']
      ? await runBatches(plans, USER_PROCESS_CONCURRENCY, processDryRunPlan)
      : await (async (): Promise<OrderedUserResult[]> => {
          const outcomes = await executeBulkUserSaves(conn, plans);
          const saveFailures = outcomes
            .filter((o) => !o.success)
            .map((o) => {
              const errors = appendCrossReferenceCandidates(o.errors, o.plan.target);
              return {
                planId: o.plan.planId,
                order: o.plan.order,
                key: o.plan.key,
                persona: o.plan.persona,
                status: 'failed' as const,
                actions: o.plan.actions,
                errors,
              };
            });
          const postSaveResults = await runBatches(
            outcomes.filter((o) => o.success),
            USER_PROCESS_CONCURRENCY,
            processPostSave
          );
          return invalidResults.concat(saveFailures, postSaveResults);
        })();
    const results = resultsWithOrder
      .sort((a, b) => a.order - b.order)
      .map((result) => ({
        key: result.key,
        id: result.id,
        persona: result.persona,
        status: result.status,
        actions: result.actions,
        errors: result.errors,
      }));

    const output: ProvisionResult = { summary: summarize(results, refs.warnings.length), users: results };
    if (!this.jsonEnabled()) {
      this.log(
        messages.getMessage('info.summary', [
          output.summary.total,
          output.summary.created,
          output.summary.updated,
          output.summary.failed,
        ])
      );
    }
    return output;
  }

  private async confirmWarnings(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), 10_000);
        timer.unref();
      });
      const shouldContinue = await Promise.race([
        this.confirm({ message: messages.getMessage('promptWarningsContinue') }),
        timeoutPromise,
      ]);
      if (!shouldContinue) {
        this.warn(messages.getMessage('warningPromptTimeout'));
        throw new SfError(messages.getMessage('errorPromptDeclined'));
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
