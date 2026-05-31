import { expect } from 'chai';
import {
  fieldCsvColumns,
  objectCsvColumns,
  renderFieldTable,
  renderObjectTable,
  serializeCsv,
} from '../../src/userAccess/output.js';
import type { UserAccessRow } from '../../src/userAccess/types.js';

describe('userAccess output', () => {
  it('serializes field csv columns in order', () => {
    expect(fieldCsvColumns()).to.deep.equal([
      'userId',
      'userName',
      'username',
      'assignmentType',
      'sourceId',
      'sourceName',
      'viaPermissionSetId',
      'viaPermissionSetName',
      'read',
      'edit',
    ]);
  });

  it('serializes object csv columns in order', () => {
    expect(objectCsvColumns()).to.deep.equal([
      'userId',
      'userName',
      'username',
      'assignmentType',
      'sourceId',
      'sourceName',
      'viaPermissionSetId',
      'viaPermissionSetName',
      'read',
      'create',
      'edit',
      'delete',
      'viewAll',
      'modifyAll',
    ]);
  });

  it('escapes csv values with commas, quotes, and newlines', () => {
    const rows: UserAccessRow[] = [
      {
        userId: '005xx',
        userName: 'Doe, "Jane"',
        username: 'jane@example.com',
        targetType: 'field',
        targetName: 'Account.CustomField__c',
        assignmentType: 'PermissionSet',
        sourceId: '0PSxx',
        sourceName: 'Line\nBreak',
        viaPermissionSetId: undefined,
        viaPermissionSetName: undefined,
        access: { read: true, edit: false },
      },
    ];
    const csv = serializeCsv(rows, fieldCsvColumns());
    expect(csv).to.include('"Doe, ""Jane"""');
    expect(csv).to.include('"Line\nBreak"');
  });

  it('renders human field table and via labels', () => {
    const rows: UserAccessRow[] = [
      {
        userId: '005xx',
        userName: 'Jane',
        username: 'jane@example.com',
        targetType: 'field',
        targetName: 'Account.CustomField__c',
        assignmentType: 'Profile',
        sourceId: '00e1',
        sourceName: 'Sales User',
        access: { read: true, edit: false },
      },
      {
        userId: '005yy',
        userName: 'Alex',
        username: 'alex@example.com',
        targetType: 'field',
        targetName: 'Account.CustomField__c',
        assignmentType: 'PermissionSetGroup',
        sourceId: '0PG1',
        sourceName: 'Sales Ops',
        viaPermissionSetId: '0PS1',
        viaPermissionSetName: 'Account Editors',
        access: { read: true, edit: true },
      },
    ];
    const rendered = renderFieldTable(rows);
    expect(rendered).to.include('Profile: Sales User');
    expect(rendered).to.include('PSG: Sales Ops / PS: Account Editors');
  });

  it('renders human object table with Y/N columns', () => {
    const rows: UserAccessRow[] = [
      {
        userId: '005zz',
        userName: 'Sam',
        username: 'sam@example.com',
        targetType: 'object',
        targetName: 'Account',
        assignmentType: 'PermissionSetGroup',
        sourceId: '0PG2',
        sourceName: 'Ops',
        access: { read: true, create: false, edit: true, delete: false, viewAll: false, modifyAll: false },
      },
    ];
    const rendered = renderObjectTable(rows);
    expect(rendered).to.include('Y');
    expect(rendered).to.include('N');
    expect(rendered).to.include('PSG: Ops');
  });
});
