import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';
import sinon from 'sinon';
import UserFreeze from '../../../../src/commands/jawn/user/freeze.js';
import UserStrip from '../../../../src/commands/jawn/user/strip.js';
import UserUnfreeze from '../../../../src/commands/jawn/user/unfreeze.js';

type FakeConnection = {
  describe: sinon.SinonStub;
  query: sinon.SinonStub;
  sobject: sinon.SinonStub;
  sobjectMap: Record<string, { update: sinon.SinonStub; delete: sinon.SinonStub }>;
};

const makeSuccessResults = (items: unknown, prefix: string): Array<{ success: true; id: string; errors: [] }> => {
  const records = Array.isArray(items) ? items : [items];
  return records.map((_, idx) => ({
    success: true as const,
    id: `${prefix}${String(idx + 1).padStart(13, '0')}AAA`,
    errors: [] as [],
  }));
};

const bulkSuccessStub = (prefix: string): sinon.SinonStub =>
  sinon.stub().callsFake(async (items: unknown) => makeSuccessResults(items, prefix));

const createConnection = (): FakeConnection => {
  const sobjectMap = {
    User: { update: bulkSuccessStub('005xx000000000'), delete: bulkSuccessStub('005xx000000000') },
    UserLogin: { update: bulkSuccessStub('0LLxx000000000'), delete: bulkSuccessStub('0LLxx000000000') },
    PermissionSetAssignment: { update: bulkSuccessStub('0PSxx000000000'), delete: bulkSuccessStub('0PSxx000000000') },
    GroupMember: { update: bulkSuccessStub('0GMxx000000000'), delete: bulkSuccessStub('0GMxx000000000') },
    PermissionSetLicenseAssign: {
      update: bulkSuccessStub('0PLxx000000000'),
      delete: bulkSuccessStub('0PLxx000000000'),
    },
  };
  return {
    describe: sinon.stub().resolves({
      fields: [
        { name: 'Username', createable: true, updateable: true, externalId: true },
        { name: 'FederationIdentifier', createable: true, updateable: true, externalId: true },
        { name: 'IsFrozen', createable: true, updateable: true, externalId: false },
        { name: 'IsActive', createable: true, updateable: true, externalId: false },
      ],
    }),
    query: sinon.stub().resolves({ records: [] }),
    sobject: sinon.stub().callsFake((name: string) => sobjectMap[name as keyof typeof sobjectMap] ?? sobjectMap.User),
    sobjectMap,
  };
};

describe('jawn user lifecycle commands', () => {
  const $$ = new TestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    sinon.restore();
    $$.restore();
  });

  it('freezes a matching user and emits a human summary', async () => {
    const conn = createConnection();
    conn.query.callsFake(async (soql: string) => {
      if (soql.includes("FROM User WHERE Username IN ('freeze@example.com')")) {
        return { records: [{ Id: '005xx0000000001AAA', IsActive: true, Username: 'freeze@example.com' }] };
      }
      if (soql.includes('FROM UserLogin')) {
        return { records: [{ Id: '0LLxx0000000001AAA', UserId: '005xx0000000001AAA', IsFrozen: false }] };
      }
      return { records: [] };
    });

    sinon.stub(UserFreeze.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => conn },
        user: 'username:freeze@example.com',
        'users-def': undefined,
        'external-id': undefined,
        'no-prompt': true,
        'dry-run': false,
        'api-version': undefined,
      },
    } as never);

    const result = await UserFreeze.run([]);
    expect(result.summary.changed).to.equal(1);
    expect(result.users[0].actions[0].key).to.equal('frozen');
    expect(conn.sobjectMap.UserLogin.update.calledOnce).to.equal(true);
    expect(conn.sobjectMap.UserLogin.update.firstCall.args[1]).to.deep.equal({ allOrNone: false });
    expect(sfCommandStubs.log.calledOnce).to.equal(true);
    expect(String(sfCommandStubs.log.firstCall.args[0])).to.include('Processed 1 user');
  });

  it('unfreezes a matching user in dry-run without DML', async () => {
    const conn = createConnection();
    conn.query.callsFake(async (soql: string) => {
      if (soql.includes("FROM User WHERE Username IN ('unfreeze@example.com')")) {
        return { records: [{ Id: '005xx0000000002AAA', IsActive: true, Username: 'unfreeze@example.com' }] };
      }
      if (soql.includes('FROM UserLogin')) {
        return { records: [{ Id: '0LLxx0000000002AAA', UserId: '005xx0000000002AAA', IsFrozen: true }] };
      }
      return { records: [] };
    });

    sinon.stub(UserUnfreeze.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => conn },
        user: 'username:unfreeze@example.com',
        'users-def': undefined,
        'external-id': undefined,
        'no-prompt': true,
        'dry-run': true,
        'api-version': undefined,
      },
    } as never);

    const result = await UserUnfreeze.run(['--json']);
    expect(result.users[0].status).to.equal('planned');
    expect(result.users[0].actions[0].key).to.equal('wouldUnfreeze');
    expect(conn.sobjectMap.UserLogin.update.called).to.equal(false);
    expect(sfCommandStubs.log.called).to.equal(false);
  });

  it('strips access with opt-outs and excludes profile-owned permission set assignments', async () => {
    const conn = createConnection();
    conn.query.callsFake(async (soql: string) => {
      if (soql.includes("FROM User WHERE Username IN ('strip@example.com')")) {
        return { records: [{ Id: '005xx0000000003AAA', IsActive: true, Username: 'strip@example.com' }] };
      }
      if (soql.includes('FROM UserLogin')) {
        return { records: [{ Id: '0LLxx0000000003AAA', UserId: '005xx0000000003AAA', IsFrozen: false }] };
      }
      if (soql.includes('FROM PermissionSetAssignment')) {
        return {
          records: [
            {
              Id: '0PSA1',
              AssigneeId: '005xx0000000003AAA',
              PermissionSetGroupId: null,
              PermissionSetId: '0PS1',
              PermissionSet: { IsOwnedByProfile: false },
            },
            {
              Id: '0PSA2',
              AssigneeId: '005xx0000000003AAA',
              PermissionSetGroupId: null,
              PermissionSetId: '0PS2',
              PermissionSet: { IsOwnedByProfile: true },
            },
            {
              Id: '0PSA3',
              AssigneeId: '005xx0000000003AAA',
              PermissionSetGroupId: '0PG1',
            },
          ],
        };
      }
      if (soql.includes('FROM GroupMember')) {
        return {
          records: [
            { Id: '0GM1', UserOrGroupId: '005xx0000000003AAA', Group: { Type: 'Regular' } },
            { Id: '0GM2', UserOrGroupId: '005xx0000000003AAA', Group: { Type: 'Queue' } },
          ],
        };
      }
      if (soql.includes('FROM PermissionSetLicenseAssign')) {
        return {
          records: [{ Id: '0PL1', AssigneeId: '005xx0000000003AAA' }],
        };
      }
      return { records: [] };
    });

    sinon.stub(UserStrip.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => conn },
        user: 'username:strip@example.com',
        'users-def': undefined,
        'external-id': undefined,
        'no-prompt': true,
        'dry-run': true,
        'no-freeze': false,
        'no-deactivate': false,
        'keep-permsets': false,
        'keep-permset-groups': false,
        'keep-licenses': true,
        'keep-public-groups': false,
        'keep-queues': false,
        'api-version': undefined,
      },
    } as never);

    const result = await UserStrip.run(['--json']);
    const actions = result.users[0].actions.map((action) => `${action.key}${action.count ? `:${action.count}` : ''}`);
    expect(actions).to.include('wouldFreeze');
    expect(actions).to.include('wouldRemovePermissionSet:1');
    expect(actions).to.include('wouldRemovePermissionSetGroup:1');
    expect(actions).to.include('wouldRemovePublicGroupMember:1');
    expect(actions).to.include('wouldRemoveQueueMember:1');
    expect(actions).to.include('wouldDeactivate');
    expect(result.users[0].skipped.some((notice) => notice.key === 'skippedPermissionSetLicenses')).to.equal(true);
    expect(result.users[0].skipped.some((notice) => notice.key === 'skippedProfileOwnedPermissionSets')).to.equal(true);
    expect(conn.sobjectMap.UserLogin.update.called).to.equal(false);
    expect(conn.sobjectMap.PermissionSetAssignment.delete.called).to.equal(false);
    expect(conn.sobjectMap.GroupMember.delete.called).to.equal(false);
    expect(conn.sobjectMap.PermissionSetLicenseAssign.delete.called).to.equal(false);
  });

  it('strips access in freeze-first, license-safe order on the real DML path', async () => {
    const events: string[] = [];
    const conn = createConnection();
    conn.query.callsFake(async (soql: string) => {
      if (soql.includes("FROM User WHERE Username IN ('strip-live@example.com')")) {
        return { records: [{ Id: '005xx0000000004AAA', IsActive: true, Username: 'strip-live@example.com' }] };
      }
      if (soql.includes('FROM UserLogin')) {
        return { records: [{ Id: '0LLxx0000000004AAA', UserId: '005xx0000000004AAA', IsFrozen: false }] };
      }
      if (soql.includes('FROM PermissionSetAssignment')) {
        return {
          records: [
            {
              Id: '0PSA10',
              AssigneeId: '005xx0000000004AAA',
              PermissionSetGroupId: null,
              PermissionSetId: '0PS10',
              PermissionSet: { IsOwnedByProfile: false },
            },
            {
              Id: '0PSA11',
              AssigneeId: '005xx0000000004AAA',
              PermissionSetGroupId: null,
              PermissionSetId: '0PS11',
              PermissionSet: { IsOwnedByProfile: true },
            },
            {
              Id: '0PSA12',
              AssigneeId: '005xx0000000004AAA',
              PermissionSetGroupId: '0PG10',
            },
          ],
        };
      }
      if (soql.includes('FROM GroupMember')) {
        return {
          records: [
            { Id: '0GM10', UserOrGroupId: '005xx0000000004AAA', Group: { Type: 'Regular' } },
            { Id: '0GM11', UserOrGroupId: '005xx0000000004AAA', Group: { Type: 'Queue' } },
          ],
        };
      }
      if (soql.includes('FROM PermissionSetLicenseAssign')) {
        return { records: [{ Id: '0PL10', AssigneeId: '005xx0000000004AAA' }] };
      }
      return { records: [] };
    });

    const makeWriteStub = (name: string, action: 'update' | 'delete') =>
      sinon.stub().callsFake(async (items: unknown) => {
        events.push(`${name}.${action}`);
        return makeSuccessResults(
          items,
          name === 'UserLogin' ? '0LLxx0000000000' : name === 'User' ? '005xx0000000000' : '0Xx0000000000'
        );
      });
    const sobjectMap = {
      User: { update: makeWriteStub('User', 'update'), delete: makeWriteStub('User', 'delete') },
      UserLogin: { update: makeWriteStub('UserLogin', 'update'), delete: makeWriteStub('UserLogin', 'delete') },
      PermissionSetAssignment: {
        update: makeWriteStub('PermissionSetAssignment', 'update'),
        delete: makeWriteStub('PermissionSetAssignment', 'delete'),
      },
      GroupMember: { update: makeWriteStub('GroupMember', 'update'), delete: makeWriteStub('GroupMember', 'delete') },
      PermissionSetLicenseAssign: {
        update: makeWriteStub('PermissionSetLicenseAssign', 'update'),
        delete: makeWriteStub('PermissionSetLicenseAssign', 'delete'),
      },
    };
    conn.sobject.callsFake((name: string) => sobjectMap[name as keyof typeof sobjectMap] ?? sobjectMap.User);

    sinon.stub(UserStrip.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => conn },
        user: 'username:strip-live@example.com',
        'users-def': undefined,
        'external-id': undefined,
        'no-prompt': true,
        'dry-run': false,
        'no-freeze': false,
        'no-deactivate': false,
        'keep-permsets': false,
        'keep-permset-groups': false,
        'keep-licenses': false,
        'keep-public-groups': false,
        'keep-queues': false,
        'api-version': undefined,
      },
    } as never);

    const result = await UserStrip.run(['--json']);
    expect(events).to.deep.equal([
      'UserLogin.update',
      'PermissionSetAssignment.delete',
      'PermissionSetAssignment.delete',
      'GroupMember.delete',
      'GroupMember.delete',
      'PermissionSetLicenseAssign.delete',
      'User.update',
    ]);
    expect(sobjectMap.PermissionSetAssignment.delete.firstCall.args[0]).to.have.length(1);
    expect(sobjectMap.PermissionSetAssignment.delete.secondCall.args[0]).to.have.length(1);
    expect(sobjectMap.GroupMember.delete.firstCall.args[0]).to.have.length(1);
    expect(sobjectMap.GroupMember.delete.secondCall.args[0]).to.have.length(1);
    expect(result.users[0].actions.map((action) => action.key)).to.include.members([
      'frozen',
      'removedPermissionSet',
      'removedPermissionSetGroup',
      'removedPublicGroupMember',
      'removedQueueMember',
      'removedPermissionSetLicense',
      'deactivated',
    ]);
    expect(result.users[0].skipped.some((notice) => notice.key === 'skippedProfileOwnedPermissionSets')).to.equal(true);
  });

  it('keeps failed strip targets aligned with later successes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jawn-strip-test-'));
    const usersPath = join(dir, 'users.json');
    writeFileSync(
      usersPath,
      JSON.stringify({
        users: [
          { match: 'Username', Username: 'missing@example.com' },
          { match: 'Username', Username: 'good@example.com' },
        ],
      })
    );

    const conn = createConnection();
    conn.query.callsFake(async (soql: string) => {
      if (soql.includes("FROM User WHERE Username IN ('missing@example.com','good@example.com')")) {
        return { records: [{ Id: '005xx0000000005AAA', IsActive: true, Username: 'good@example.com' }] };
      }
      if (soql.includes('FROM UserLogin')) {
        return { records: [{ Id: '0LLxx0000000005AAA', UserId: '005xx0000000005AAA', IsFrozen: false }] };
      }
      return { records: [] };
    });

    const sobjectMap = {
      User: {
        update: sinon.stub().callsFake(async (items: unknown) => makeSuccessResults(items, '005xx0000000000')),
        delete: sinon.stub(),
      },
      UserLogin: {
        update: sinon.stub().callsFake(async (items: unknown) => makeSuccessResults(items, '0LLxx0000000000')),
        delete: sinon.stub(),
      },
      PermissionSetAssignment: { update: sinon.stub(), delete: sinon.stub() },
      GroupMember: { update: sinon.stub(), delete: sinon.stub() },
      PermissionSetLicenseAssign: { update: sinon.stub(), delete: sinon.stub() },
    };
    conn.sobject.callsFake((name: string) => sobjectMap[name as keyof typeof sobjectMap] ?? sobjectMap.User);

    sinon.stub(UserStrip.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => conn },
        'users-def': usersPath,
        'external-id': undefined,
        'no-prompt': true,
        'dry-run': false,
        'no-freeze': false,
        'no-deactivate': true,
        'keep-permsets': true,
        'keep-permset-groups': true,
        'keep-licenses': true,
        'keep-public-groups': true,
        'keep-queues': true,
        'api-version': undefined,
      },
    } as never);

    const result = await UserStrip.run(['--json']);
    expect(result.users[0].status).to.equal('failed');
    expect(result.users[0].errors.join(' ')).to.include('matched no user');
    expect(result.users[1].status).to.equal('changed');
    expect(result.users[1].actions.map((action) => action.key)).to.include('frozen');
    expect(sobjectMap.UserLogin.update.calledOnce).to.equal(true);
  });
});
