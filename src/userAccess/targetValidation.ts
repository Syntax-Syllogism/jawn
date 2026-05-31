import type { Connection } from '@salesforce/core';
import { UserAccessError, type AccessTargetType, type ValidatedAccessTarget } from './types.js';

type FieldDescribe = { name: string };
type SObjectDescribe = { name: string; fields: FieldDescribe[] };

const describeObject = async (conn: Connection, sobjectType: string): Promise<SObjectDescribe> => {
  try {
    return (await conn.describe(sobjectType)) as SObjectDescribe;
  } catch (error) {
    throw new UserAccessError('errorObjectNotFound', [sobjectType], error);
  }
};

export const validateObjectTarget = async (conn: Connection, target: string): Promise<ValidatedAccessTarget> => {
  const trimmed = target.trim();
  if (!trimmed) throw new UserAccessError('errorInvalidTarget', [target]);
  const describe = await describeObject(conn, trimmed);
  return { type: 'object', targetName: describe.name, sobjectType: describe.name };
};

export const validateFieldTarget = async (conn: Connection, target: string): Promise<ValidatedAccessTarget> => {
  const trimmed = target.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new UserAccessError('errorFieldTargetMustBeQualified', [target]);
  }
  const [inputObjectApiName, inputFieldApiName] = parts;
  const describe = await describeObject(conn, inputObjectApiName);
  const fieldMap = new Map<string, string>();
  for (const field of describe.fields) fieldMap.set(field.name.toLowerCase(), field.name);
  const canonicalFieldApiName = fieldMap.get(inputFieldApiName.toLowerCase());
  if (!canonicalFieldApiName) {
    throw new UserAccessError('errorFieldNotFound', [inputObjectApiName, inputFieldApiName]);
  }
  return {
    type: 'field',
    targetName: `${describe.name}.${canonicalFieldApiName}`,
    sobjectType: describe.name,
    fieldApiName: canonicalFieldApiName,
  };
};

export const validateTargetByType = async (
  conn: Connection,
  type: AccessTargetType,
  target: string
): Promise<ValidatedAccessTarget> => {
  if (type === 'field') return validateFieldTarget(conn, target);
  if (type === 'object') return validateObjectTarget(conn, target);
  throw new UserAccessError('errorUnsupportedAccessType', [type]);
};
