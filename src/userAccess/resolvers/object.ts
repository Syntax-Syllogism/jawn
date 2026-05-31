import type { Connection } from '@salesforce/core';
import { queryAll, queryAllInChunks, soqlIn } from '../soql.js';
import { objectCsvColumns } from '../output.js';
import { validateObjectTarget } from '../targetValidation.js';
import type {
  AccessTargetResolver,
  ObjectAccess,
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

type ObjectPermissionRecord = {
  ParentId: string;
  Parent?: PermissionSetParent;
  PermissionsRead?: boolean;
  PermissionsCreate?: boolean;
  PermissionsEdit?: boolean;
  PermissionsDelete?: boolean;
  PermissionsViewAllRecords?: boolean;
  PermissionsModifyAllRecords?: boolean;
};

type PsgComponentRow = {
  PermissionSetGroupId: string;
  PermissionSetId: string;
  PermissionSetGroup?: { DeveloperName?: string; MasterLabel?: string };
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
  PermissionsCreate?: boolean;
  PermissionsEdit?: boolean;
  PermissionsDelete?: boolean;
  PermissionsViewAllRecords?: boolean;
  PermissionsModifyAllRecords?: boolean;
};

const truthy = (value: boolean | undefined): boolean => value === true;

const toObjectAccess = (row: ObjectPermissionRecord): ObjectAccess => ({
  read: truthy(row.PermissionsRead),
  create: truthy(row.PermissionsCreate),
  edit: truthy(row.PermissionsEdit),
  delete: truthy(row.PermissionsDelete),
  viewAll: truthy(row.PermissionsViewAllRecords),
  modifyAll: truthy(row.PermissionsModifyAllRecords),
});

const anyAccess = (access: ObjectAccess): boolean =>
  access.read || access.create || access.edit || access.delete || access.viewAll || access.modifyAll;

const applyMute = (granted: ObjectAccess, muted: ObjectAccess): ObjectAccess => ({
  read: granted.read && !muted.read,
  create: granted.create && !muted.create,
  edit: granted.edit && !muted.edit,
  delete: granted.delete && !muted.delete,
  viewAll: granted.viewAll && !muted.viewAll,
  modifyAll: granted.modifyAll && !muted.modifyAll,
});

const computeStats = (rows: UserAccessRow[]): UserAccessStats => ({
  totalActiveUsersWithAccess: new Set(rows.map((row) => row.userId)).size,
  profileGrants: new Set(rows.filter((row) => row.assignmentType === 'Profile').map((row) => row.sourceId)).size,
  permissionSetGrants: new Set(rows.filter((row) => row.assignmentType === 'PermissionSet').map((row) => row.sourceId))
    .size,
  permissionSetGroupGrants: new Set(
    rows.filter((row) => row.assignmentType === 'PermissionSetGroup').map((row) => row.sourceId)
  ).size,
});

const keyFor = (row: UserAccessRow): string =>
  [row.userId, row.assignmentType, row.sourceId, row.viaPermissionSetId ?? ''].join('|');

export const objectResolver: AccessTargetResolver = {
  type: 'object',
  validateTarget: validateObjectTarget,
  // eslint-disable-next-line complexity
  async resolve(conn: Connection, target: ValidatedAccessTarget): Promise<UserAccessResult> {
    if (!target.sobjectType) throw new UserAccessError('errorInvalidTarget', [target.targetName]);
    const warnings: string[] = [];
    try {
      const entitlementRows = await queryAll<ObjectPermissionRecord>(
        conn,
        [
          'SELECT ParentId, Parent.Id, Parent.Name, Parent.IsOwnedByProfile, Parent.ProfileId, Parent.Profile.Name, Parent.Type, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords',
          'FROM ObjectPermissions',
          `WHERE SobjectType = '${target.sobjectType}'`,
          "AND Parent.Type != 'Muting'",
        ].join(' ')
      );

      const grantByPermissionSetId = new Map<string, ObjectAccess>();
      const permissionSetById = new Map<string, PermissionSetParent>();
      for (const row of entitlementRows) {
        const access = toObjectAccess(row);
        if (!anyAccess(access)) continue;
        grantByPermissionSetId.set(row.ParentId, access);
        if (row.Parent) permissionSetById.set(row.ParentId, { ...row.Parent, Id: row.ParentId });
      }

      if (grantByPermissionSetId.size === 0) {
        return {
          targetType: 'object',
          targetName: target.sobjectType,
          sobjectType: target.sobjectType,
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
                'SELECT PermissionSetGroupId, PermissionSetGroup.DeveloperName, PermissionSetGroup.MasterLabel, PermissionSetId',
                'FROM PermissionSetGroupComponent',
                `WHERE PermissionSetId IN (${soqlIn(chunk)})`,
              ].join(' ')
            );
      const psgNameById = new Map<string, string>();
      const psgEntriesByPsgId = new Map<string, string[]>();
      for (const row of psgComponentRows) {
        const psgName =
          row.PermissionSetGroup?.MasterLabel ??
          row.PermissionSetGroup?.DeveloperName ??
          psgNameById.get(row.PermissionSetGroupId) ??
          '(Unnamed Permission Set Group)';
        psgNameById.set(row.PermissionSetGroupId, psgName);
        const existing = psgEntriesByPsgId.get(row.PermissionSetGroupId) ?? [];
        existing.push(row.PermissionSetId);
        psgEntriesByPsgId.set(row.PermissionSetGroupId, existing);
      }
      const psgIds = [...new Set(psgComponentRows.map((row) => row.PermissionSetGroupId))];

      if (directPermissionSetIds.length === 0 && psgIds.length === 0) {
        return {
          targetType: 'object',
          targetName: target.sobjectType,
          sobjectType: target.sobjectType,
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
                'SELECT PermissionSetGroupId, PermissionSetId',
                'FROM PermissionSetGroupComponent',
                `WHERE PermissionSetGroupId IN (${soqlIn(chunk)})`,
                "AND PermissionSet.Type = 'Muting'",
              ].join(' ')
            );
      const mutingByPsgId = new Map<string, string[]>();
      for (const row of mutingComponents) {
        const existing = mutingByPsgId.get(row.PermissionSetGroupId) ?? [];
        existing.push(row.PermissionSetId);
        mutingByPsgId.set(row.PermissionSetGroupId, existing);
      }
      const mutingSetIds = [...new Set(mutingComponents.map((row) => row.PermissionSetId))];
      const mutingRows =
        mutingSetIds.length === 0
          ? []
          : await queryAllInChunks<MutingPermissionRow>(conn, mutingSetIds, (chunk) =>
              [
                'SELECT ParentId, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords',
                'FROM ObjectPermissions',
                'WHERE Parent.IsOwnedByProfile = false',
                `AND ParentId IN (${soqlIn(chunk)})`,
                `AND SobjectType = '${target.sobjectType}'`,
              ].join(' ')
            );
      const mutingAccessByPsId = new Map<string, ObjectAccess>();
      for (const row of mutingRows) mutingAccessByPsId.set(row.ParentId, toObjectAccess(row));

      const finalRowsByKey = new Map<string, UserAccessRow>();
      for (const row of assignmentRows) {
        const assigneeName = row.Assignee?.Name ?? row.AssigneeId;
        const assigneeUsername = row.Assignee?.Username ?? '';

        if (row.PermissionSetId && grantByPermissionSetId.has(row.PermissionSetId)) {
          const parent = permissionSetById.get(row.PermissionSetId) ?? row.PermissionSet;
          if (parent?.Type === 'Group') continue;
          const access = grantByPermissionSetId.get(row.PermissionSetId) ?? {
            read: false,
            create: false,
            edit: false,
            delete: false,
            viewAll: false,
            modifyAll: false,
          };
          const isProfile = parent?.IsOwnedByProfile === true;
          const resolvedRow: UserAccessRow = {
            userId: row.AssigneeId,
            userName: assigneeName,
            username: assigneeUsername,
            targetType: 'object',
            targetName: target.sobjectType,
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
          const muted = mutingPsIds.reduce<ObjectAccess>(
            (acc, mutingPsId) => {
              const mask = mutingAccessByPsId.get(mutingPsId);
              return {
                read: acc.read || (mask?.read ?? false),
                create: acc.create || (mask?.create ?? false),
                edit: acc.edit || (mask?.edit ?? false),
                delete: acc.delete || (mask?.delete ?? false),
                viewAll: acc.viewAll || (mask?.viewAll ?? false),
                modifyAll: acc.modifyAll || (mask?.modifyAll ?? false),
              };
            },
            { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false }
          );
          for (const permissionSetId of componentPsIds) {
            const granted = grantByPermissionSetId.get(permissionSetId);
            if (!granted) continue;
            const effective = applyMute(granted, muted);
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
              targetType: 'object',
              targetName: target.sobjectType,
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
        targetType: 'object',
        targetName: target.sobjectType,
        sobjectType: target.sobjectType,
        rows,
        stats: computeStats(rows),
        warnings,
      };
    } catch (error) {
      if (error instanceof UserAccessError) throw error;
      throw new UserAccessError('errorAccessQueryFailed', [target.type, target.targetName], error);
    }
  },
  csvColumns: objectCsvColumns,
};
