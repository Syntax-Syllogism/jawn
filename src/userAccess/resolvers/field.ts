import type { Connection } from '@salesforce/core';
import { queryAll, queryAllInChunks, soqlIn } from '../soql.js';
import { validateFieldTarget } from '../targetValidation.js';
import { fieldCsvColumns } from '../output.js';
import type {
  AccessTargetResolver,
  UserAccessResult,
  UserAccessRow,
  UserAccessStats,
  ValidatedAccessTarget,
} from '../types.js';
import { UserAccessError } from '../types.js';

type PermissionSetParent = {
  Id: string;
  Name?: string;
  Type?: string;
  IsOwnedByProfile?: boolean;
  ProfileId?: string;
  Profile?: { Name?: string };
};

type FieldPermissionRecord = {
  ParentId: string;
  Parent?: PermissionSetParent;
  PermissionsRead?: boolean;
  PermissionsEdit?: boolean;
};

type PsgComponentRow = {
  PermissionSetGroupId: string;
  PermissionSetId: string;
  PermissionSetGroup?: { DeveloperName?: string; MasterLabel?: string };
  PermissionSet?: { Name?: string; Type?: string };
};

type AssignmentRow = {
  Id: string;
  AssigneeId: string;
  Assignee?: { Name?: string; Username?: string; IsActive?: boolean };
  PermissionSetId?: string;
  PermissionSet?: PermissionSetParent;
  PermissionSetGroupId?: string;
  PermissionSetGroup?: { DeveloperName?: string; MasterLabel?: string };
};

type MutingPermissionRow = {
  ParentId: string;
  PermissionsRead?: boolean;
  PermissionsEdit?: boolean;
};

const truthy = (value: boolean | undefined): boolean => value === true;
const anyAccess = (access: { read: boolean; edit: boolean }): boolean => access.read || access.edit;

const computeStats = (rows: UserAccessRow[]): UserAccessStats => ({
  totalActiveUsersWithAccess: new Set(rows.map((row) => row.userId)).size,
  profileGrants: new Set(rows.filter((row) => row.assignmentType === 'Profile').map((row) => row.sourceId)).size,
  permissionSetGrants: new Set(rows.filter((row) => row.assignmentType === 'PermissionSet').map((row) => row.sourceId))
    .size,
  permissionSetGroupGrants: new Set(
    rows.filter((row) => row.assignmentType === 'PermissionSetGroup').map((row) => row.sourceId)
  ).size,
});

const buildPsgMaps = (
  componentRows: PsgComponentRow[]
): {
  psgByPermissionSetId: Map<string, Array<{ psgId: string; psgName: string }>>;
  psgNameById: Map<string, string>;
} => {
  const psgByPermissionSetId = new Map<string, Array<{ psgId: string; psgName: string }>>();
  const psgNameById = new Map<string, string>();
  for (const row of componentRows) {
    const psgName =
      row.PermissionSetGroup?.MasterLabel ??
      row.PermissionSetGroup?.DeveloperName ??
      psgNameById.get(row.PermissionSetGroupId) ??
      '(Unnamed Permission Set Group)';
    psgNameById.set(row.PermissionSetGroupId, psgName);
    const existing = psgByPermissionSetId.get(row.PermissionSetId) ?? [];
    existing.push({ psgId: row.PermissionSetGroupId, psgName });
    psgByPermissionSetId.set(row.PermissionSetId, existing);
  }
  return { psgByPermissionSetId, psgNameById };
};

const keyFor = (row: UserAccessRow): string =>
  [row.userId, row.assignmentType, row.sourceId, row.viaPermissionSetId ?? ''].join('|');

export const fieldResolver: AccessTargetResolver = {
  type: 'field',
  validateTarget: validateFieldTarget,
  // eslint-disable-next-line complexity
  async resolve(conn: Connection, target: ValidatedAccessTarget): Promise<UserAccessResult> {
    if (!target.sobjectType || !target.fieldApiName)
      throw new UserAccessError('errorInvalidTarget', [target.targetName]);
    const qualifiedField = `${target.sobjectType}.${target.fieldApiName}`;
    const warnings: string[] = [];
    try {
      const entitlementRows = await queryAll<FieldPermissionRecord>(
        conn,
        [
          'SELECT ParentId, Parent.Id, Parent.Name, Parent.IsOwnedByProfile, Parent.ProfileId, Parent.Profile.Name, Parent.Type, PermissionsRead, PermissionsEdit',
          'FROM FieldPermissions',
          `WHERE SobjectType = '${target.sobjectType}'`,
          `AND Field = '${qualifiedField}'`,
          "AND Parent.Type != 'Muting'",
        ].join(' ')
      );

      const grantByPermissionSetId = new Map<string, { read: boolean; edit: boolean }>();
      const permissionSetById = new Map<string, PermissionSetParent>();
      for (const row of entitlementRows) {
        const access = { read: truthy(row.PermissionsRead), edit: truthy(row.PermissionsEdit) };
        if (!anyAccess(access)) continue;
        grantByPermissionSetId.set(row.ParentId, access);
        if (row.Parent) permissionSetById.set(row.ParentId, { ...row.Parent, Id: row.ParentId });
      }

      if (grantByPermissionSetId.size === 0) {
        warnings.push(
          `No explicit FieldPermissions records were found for ${qualifiedField}. Standard fields may still be visible through base object/profile behavior. This command reports explicit field-level security grants only.`
        );
        return {
          targetType: 'field',
          targetName: qualifiedField,
          sobjectType: target.sobjectType,
          fieldApiName: target.fieldApiName,
          rows: [],
          stats: computeStats([]),
          warnings,
        };
      }

      const directPermissionSetIds = [...grantByPermissionSetId.keys()].filter(
        (id) => permissionSetById.get(id)?.Type !== 'Group'
      );
      const componentPermissionSetIds = directPermissionSetIds.filter(
        (id) => !permissionSetById.get(id)?.IsOwnedByProfile
      );

      const psgComponentRows =
        componentPermissionSetIds.length === 0
          ? []
          : await queryAllInChunks<PsgComponentRow>(conn, componentPermissionSetIds, (chunk) =>
              [
                'SELECT PermissionSetGroupId, PermissionSetGroup.DeveloperName, PermissionSetGroup.MasterLabel, PermissionSetId, PermissionSet.Name, PermissionSet.Type',
                'FROM PermissionSetGroupComponent',
                `WHERE PermissionSetId IN (${soqlIn(chunk)})`,
              ].join(' ')
            );
      const { psgByPermissionSetId, psgNameById } = buildPsgMaps(psgComponentRows);
      const psgIds = [...new Set(psgComponentRows.map((row) => row.PermissionSetGroupId))];

      if (directPermissionSetIds.length === 0 && psgIds.length === 0) {
        return {
          targetType: 'field',
          targetName: qualifiedField,
          sobjectType: target.sobjectType,
          fieldApiName: target.fieldApiName,
          rows: [],
          stats: computeStats([]),
          warnings,
        };
      }

      const assignmentRowsById = new Map<string, AssignmentRow>();
      const assignmentSelect = [
        'SELECT Id, AssigneeId, Assignee.Name, Assignee.Username, Assignee.IsActive, PermissionSetId, PermissionSet.Name, PermissionSet.IsOwnedByProfile, PermissionSet.ProfileId, PermissionSet.Profile.Name, PermissionSet.Type, PermissionSetGroupId, PermissionSetGroup.DeveloperName, PermissionSetGroup.MasterLabel',
        'FROM PermissionSetAssignment',
        'WHERE Assignee.IsActive = true',
      ];
      const assignmentRowsByPermissionSet = await queryAllInChunks<AssignmentRow>(
        conn,
        directPermissionSetIds,
        (chunk) =>
          [...assignmentSelect, `AND PermissionSetId IN (${soqlIn(chunk)})`, 'ORDER BY Assignee.Name, Id'].join(' ')
      );
      for (const row of assignmentRowsByPermissionSet) assignmentRowsById.set(row.Id, row);
      const assignmentRowsByPsg = await queryAllInChunks<AssignmentRow>(conn, psgIds, (chunk) =>
        [...assignmentSelect, `AND PermissionSetGroupId IN (${soqlIn(chunk)})`, 'ORDER BY Assignee.Name, Id'].join(' ')
      );
      for (const row of assignmentRowsByPsg) assignmentRowsById.set(row.Id, row);
      const assignmentRows = [...assignmentRowsById.values()];

      const mutingComponents =
        psgIds.length === 0
          ? []
          : await queryAllInChunks<PsgComponentRow>(conn, psgIds, (chunk) =>
              [
                'SELECT PermissionSetGroupId, PermissionSetId, PermissionSet.Name, PermissionSet.Type',
                'FROM PermissionSetGroupComponent',
                `WHERE PermissionSetGroupId IN (${soqlIn(chunk)})`,
                "AND PermissionSet.Type = 'Muting'",
              ].join(' ')
            );
      const mutingSetIds = [...new Set(mutingComponents.map((row) => row.PermissionSetId))];
      const mutingByPsgId = new Map<string, string[]>();
      for (const row of mutingComponents) {
        const existing = mutingByPsgId.get(row.PermissionSetGroupId) ?? [];
        existing.push(row.PermissionSetId);
        mutingByPsgId.set(row.PermissionSetGroupId, existing);
      }

      const mutingRows =
        mutingSetIds.length === 0
          ? []
          : await queryAllInChunks<MutingPermissionRow>(conn, mutingSetIds, (chunk) =>
              [
                'SELECT ParentId, PermissionsRead, PermissionsEdit',
                'FROM FieldPermissions',
                'WHERE Parent.IsOwnedByProfile = false',
                `AND ParentId IN (${soqlIn(chunk)})`,
                `AND SobjectType = '${target.sobjectType}'`,
                `AND Field = '${qualifiedField}'`,
              ].join(' ')
            );
      const mutingAccessByPsId = new Map<string, { read: boolean; edit: boolean }>();
      for (const row of mutingRows) {
        mutingAccessByPsId.set(row.ParentId, { read: truthy(row.PermissionsRead), edit: truthy(row.PermissionsEdit) });
      }

      const finalRowsByKey = new Map<string, UserAccessRow>();
      const psgEntriesByPsgId = new Map<string, string[]>();
      for (const [permissionSetId, entries] of psgByPermissionSetId.entries()) {
        for (const entry of entries) {
          const existing = psgEntriesByPsgId.get(entry.psgId) ?? [];
          existing.push(permissionSetId);
          psgEntriesByPsgId.set(entry.psgId, existing);
        }
      }

      for (const row of assignmentRows) {
        const assigneeName = row.Assignee?.Name ?? row.AssigneeId;
        const assigneeUsername = row.Assignee?.Username ?? '';

        if (row.PermissionSetId && grantByPermissionSetId.has(row.PermissionSetId)) {
          const parent = permissionSetById.get(row.PermissionSetId) ?? row.PermissionSet;
          if (parent?.Type === 'Group') continue;
          const access = grantByPermissionSetId.get(row.PermissionSetId) ?? { read: false, edit: false };
          const isProfile = parent?.IsOwnedByProfile === true;
          const resolvedRow: UserAccessRow = {
            userId: row.AssigneeId,
            userName: assigneeName,
            username: assigneeUsername,
            targetType: 'field',
            targetName: qualifiedField,
            assignmentType: isProfile ? 'Profile' : 'PermissionSet',
            sourceId: isProfile ? parent?.ProfileId ?? row.PermissionSetId : row.PermissionSetId,
            sourceName: isProfile
              ? parent?.Profile?.Name ?? parent?.Name ?? 'Profile'
              : parent?.Name ?? row.PermissionSetId,
            access,
          };
          if (anyAccess(access)) finalRowsByKey.set(keyFor(resolvedRow), resolvedRow);
        }

        if (row.PermissionSetGroupId) {
          const componentPsIds = psgEntriesByPsgId.get(row.PermissionSetGroupId) ?? [];
          const mutingPsIds = mutingByPsgId.get(row.PermissionSetGroupId) ?? [];
          const muted = mutingPsIds.reduce(
            (acc, mutingId) => {
              const mask = mutingAccessByPsId.get(mutingId);
              return {
                read: acc.read || (mask?.read ?? false),
                edit: acc.edit || (mask?.edit ?? false),
              };
            },
            { read: false, edit: false }
          );
          for (const permissionSetId of componentPsIds) {
            const granted = grantByPermissionSetId.get(permissionSetId);
            if (!granted) continue;
            const effective = {
              read: granted.read && !muted.read,
              edit: granted.edit && !muted.edit,
            };
            if (!anyAccess(effective)) continue;
            const sourceName =
              row.PermissionSetGroup?.MasterLabel ??
              row.PermissionSetGroup?.DeveloperName ??
              psgNameById.get(row.PermissionSetGroupId) ??
              row.PermissionSetGroupId;
            const viaName = permissionSetById.get(permissionSetId)?.Name ?? permissionSetId;
            const resolvedRow: UserAccessRow = {
              userId: row.AssigneeId,
              userName: assigneeName,
              username: assigneeUsername,
              targetType: 'field',
              targetName: qualifiedField,
              assignmentType: 'PermissionSetGroup',
              sourceId: row.PermissionSetGroupId,
              sourceName,
              viaPermissionSetId: permissionSetId,
              viaPermissionSetName: viaName,
              access: effective,
            };
            finalRowsByKey.set(keyFor(resolvedRow), resolvedRow);
          }
        }
      }

      const rows = [...finalRowsByKey.values()];
      return {
        targetType: 'field',
        targetName: qualifiedField,
        sobjectType: target.sobjectType,
        fieldApiName: target.fieldApiName,
        rows,
        stats: computeStats(rows),
        warnings,
      };
    } catch (error) {
      if (error instanceof UserAccessError) throw error;
      throw new UserAccessError('errorAccessQueryFailed', [target.type, target.targetName], error);
    }
  },
  csvColumns: fieldCsvColumns,
};
