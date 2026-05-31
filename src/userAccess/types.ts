import type { Connection } from '@salesforce/core';

export type AccessTargetType = 'field' | 'object';
export type AssignmentType = 'Profile' | 'PermissionSet' | 'PermissionSetGroup';

export type FieldAccess = {
  read: boolean;
  edit: boolean;
};

export type ObjectAccess = {
  read: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;
  modifyAll: boolean;
};

export type UserAccessRow = {
  userId: string;
  userName: string;
  username: string;
  targetType: AccessTargetType;
  targetName: string;
  assignmentType: AssignmentType;
  sourceId: string;
  sourceName: string;
  viaPermissionSetId?: string;
  viaPermissionSetName?: string;
  access: FieldAccess | ObjectAccess;
};

export type UserAccessStats = {
  totalActiveUsersWithAccess: number;
  profileGrants: number;
  permissionSetGrants: number;
  permissionSetGroupGrants: number;
};

export type UserAccessResult = {
  targetType: AccessTargetType;
  targetName: string;
  sobjectType?: string;
  fieldApiName?: string;
  rows: UserAccessRow[];
  stats: UserAccessStats;
  warnings: string[];
};

export type ValidatedAccessTarget = {
  type: AccessTargetType;
  targetName: string;
  sobjectType?: string;
  fieldApiName?: string;
};

export type AccessTargetResolver = {
  type: AccessTargetType;
  validateTarget(conn: Connection, target: string): Promise<ValidatedAccessTarget>;
  resolve(conn: Connection, target: ValidatedAccessTarget): Promise<UserAccessResult>;
  csvColumns(): string[];
};

export type AccessErrorCode =
  | 'errorUnsupportedAccessType'
  | 'errorInvalidTarget'
  | 'errorFieldTargetMustBeQualified'
  | 'errorObjectNotFound'
  | 'errorFieldNotFound'
  | 'errorAccessQueryFailed';

export class UserAccessError extends Error {
  public readonly code: AccessErrorCode;
  public readonly args: string[];
  public readonly cause?: unknown;

  public constructor(code: AccessErrorCode, args: string[] = [], cause?: unknown) {
    super(code);
    this.name = 'UserAccessError';
    this.code = code;
    this.args = args;
    this.cause = cause;
  }
}
