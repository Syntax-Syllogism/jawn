import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';
import sinon from 'sinon';
import UserProvision from '../../../../src/commands/jawn/user/provision.js';

type FakeConnection = {
  describe: sinon.SinonStub;
  query: sinon.SinonStub;
  sobject: sinon.SinonStub;
  sobjectMap: Record<string, { create: sinon.SinonStub; update: sinon.SinonStub; delete: sinon.SinonStub }>;
};

const createFakeConnection = (): FakeConnection => {
  const sobjectMap: Record<string, { create: sinon.SinonStub; update: sinon.SinonStub; delete: sinon.SinonStub }> = {
    User: {
      create: sinon.stub().resolves([{ success: true, id: '005xx0000000001AAA', errors: [] }]),
      update: sinon.stub().resolves([{ success: true, id: '005xx0000000002AAA', errors: [] }]),
      delete: sinon.stub().resolves([{ success: true, id: '005xx0000000003AAA', errors: [] }]),
    },
    UserLogin: {
      create: sinon.stub().resolves([{ success: true, id: '0LLxx0000000001AAA', errors: [] }]),
      update: sinon.stub().resolves([{ success: true, id: '0LLxx0000000001AAA', errors: [] }]),
      delete: sinon.stub().resolves([{ success: true, id: '0LLxx0000000001AAA', errors: [] }]),
    },
    PermissionSetAssignment: {
      create: sinon.stub().resolves([{ success: true, id: '0PSxx0000000001AAA', errors: [] }]),
      update: sinon.stub().resolves([{ success: true, id: '0PSxx0000000001AAA', errors: [] }]),
      delete: sinon.stub().resolves([{ success: true, id: '0PSxx0000000001AAA', errors: [] }]),
    },
    GroupMember: {
      create: sinon.stub().resolves([{ success: true, id: '0GMxx0000000001AAA', errors: [] }]),
      update: sinon.stub().resolves([{ success: true, id: '0GMxx0000000001AAA', errors: [] }]),
      delete: sinon.stub().resolves([{ success: true, id: '0GMxx0000000001AAA', errors: [] }]),
    },
  };
  return {
    describe: sinon.stub().resolves({
      fields: [
        { name: 'Username', createable: true, updateable: true, externalId: false },
        { name: 'LastName', createable: true, updateable: true, externalId: false },
        { name: 'FirstName', createable: true, updateable: true, externalId: false },
        { name: 'Email', createable: true, updateable: true, externalId: false },
        { name: 'Alias', createable: true, updateable: true, externalId: false },
        { name: 'TimeZoneSidKey', createable: true, updateable: true, externalId: false },
        { name: 'LocaleSidKey', createable: true, updateable: true, externalId: false },
        { name: 'EmailEncodingKey', createable: true, updateable: true, externalId: false },
        { name: 'LanguageLocaleKey', createable: true, updateable: true, externalId: false },
        { name: 'ProfileId', createable: true, updateable: true, externalId: false },
        { name: 'Title', createable: true, updateable: true, externalId: false },
        { name: 'Department', createable: true, updateable: true, externalId: false },
        { name: 'FederationIdentifier', createable: true, updateable: true, externalId: true },
      ],
    }),
    query: sinon.stub().callsFake(async (soql: string) => {
      if (soql.includes('FROM Profile')) return { records: [{ Id: '00exx0000000001AAA', Name: 'Admin' }] };
      if (soql.includes('FROM UserRole')) return { records: [] };
      return { records: [] };
    }),
    sobject: sinon.stub().callsFake((name: string) => sobjectMap[name] ?? sobjectMap.User),
    sobjectMap,
  };
};

describe('jawn user provision command', () => {
  const $$ = new TestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    sinon.restore();
    $$.restore();
  });

  it('dry-run does not perform write operations', async () => {
    const fakeConn = createFakeConnection();
    sinon.stub(UserProvision.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => fakeConn },
        'users-def': 'test/fixtures/user-def.json',
        'personas-def': 'test/fixtures/persona-def.json',
        'external-id': undefined,
        'no-prompt': true,
        'dry-run': true,
        'api-version': undefined,
      },
    } as never);

    const result = await UserProvision.run(['--json']);
    expect(result.summary.total).to.be.greaterThan(0);
    expect(fakeConn.sobject.called).to.equal(false);
  });

  it('prompts once when global warnings exist', async () => {
    const fakeConn = createFakeConnection();
    fakeConn.query.callsFake(async (soql: string) => {
      if (soql.includes('FROM Profile')) return { records: [] };
      if (soql.includes('FROM UserRole')) return { records: [] };
      if (soql.includes('FROM PermissionSet')) return { records: [] };
      if (soql.includes('FROM PermissionSetGroup')) return { records: [] };
      if (soql.includes("FROM Group WHERE DeveloperName IN ('admin') AND Type = 'Regular'")) return { records: [] };
      if (soql.includes("FROM Group WHERE DeveloperName IN ('admin') AND Type = 'Queue'")) return { records: [] };
      return { records: [] };
    });

    sinon.stub(UserProvision.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => fakeConn },
        'users-def': 'test/fixtures/user-def.json',
        'personas-def': 'test/fixtures/persona-def.json',
        'external-id': undefined,
        'no-prompt': false,
        'dry-run': true,
        'api-version': undefined,
      },
    } as never);
    const confirmStub = sinon
      .stub(UserProvision.prototype as unknown as { confirm: () => Promise<boolean> }, 'confirm')
      .resolves(true);

    await UserProvision.run([]);
    expect(confirmStub.calledOnce).to.equal(true);
    expect(sfCommandStubs.warn.called).to.equal(true);
  });

  it('does not prompt in json mode when warnings exist', async () => {
    const fakeConn = createFakeConnection();
    fakeConn.query.callsFake(async (soql: string) => {
      if (soql.includes('FROM Profile')) return { records: [] };
      if (soql.includes('FROM UserRole')) return { records: [] };
      if (soql.includes('FROM PermissionSet')) return { records: [] };
      if (soql.includes('FROM PermissionSetGroup')) return { records: [] };
      if (soql.includes("FROM Group WHERE DeveloperName IN ('admin') AND Type = 'Regular'")) return { records: [] };
      if (soql.includes("FROM Group WHERE DeveloperName IN ('admin') AND Type = 'Queue'")) return { records: [] };
      return { records: [] };
    });

    sinon.stub(UserProvision.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => fakeConn },
        'users-def': 'test/fixtures/user-def.json',
        'personas-def': 'test/fixtures/persona-def.json',
        'external-id': undefined,
        'no-prompt': false,
        'dry-run': true,
        'api-version': undefined,
      },
    } as never);
    const confirmStub = sinon
      .stub(UserProvision.prototype as unknown as { confirm: () => Promise<boolean> }, 'confirm')
      .resolves(true);

    await UserProvision.run(['--json']);
    expect(confirmStub.called).to.equal(false);
  });

  it('uses bulk create/update arrays for user saves', async () => {
    const fakeConn = createFakeConnection();
    const dir = mkdtempSync(join(tmpdir(), 'jawn-provision-test-'));
    const usersPath = join(dir, 'users.json');
    const personasPath = join(dir, 'personas.json');
    writeFileSync(
      usersPath,
      JSON.stringify({
        users: [
          {
            Username: 'new.user@example.test',
            FederationIdentifier: 'A001',
            persona: 'default',
            FirstName: 'New',
            LastName: 'User',
            Alias: 'nuser',
            TimeZoneSidKey: 'America/Los_Angeles',
            LocaleSidKey: 'en_US',
            EmailEncodingKey: 'UTF-8',
            LanguageLocaleKey: 'en_US',
          },
          {
            Username: 'existing.user@example.test',
            FederationIdentifier: 'A002',
            persona: 'default',
            FirstName: 'Existing',
            LastName: 'User',
            Alias: 'euser',
            TimeZoneSidKey: 'America/Los_Angeles',
            LocaleSidKey: 'en_US',
            EmailEncodingKey: 'UTF-8',
            LanguageLocaleKey: 'en_US',
          },
        ],
      })
    );
    writeFileSync(
      personasPath,
      JSON.stringify({
        personas: {
          default: {
            profile: 'Admin',
          },
        },
      })
    );
    fakeConn.query.callsFake(async (soql: string) => {
      if (soql.includes('FROM Profile')) return { records: [{ Id: '00exx0000000001AAA', Name: 'Admin' }] };
      if (soql.includes('SELECT Id, IsActive, FederationIdentifier FROM User')) {
        return { records: [{ Id: '005xx0000000002AAA', IsActive: true, FederationIdentifier: 'A002' }] };
      }
      if (soql.includes('FROM UserLogin')) return { records: [] };
      if (soql.includes('FROM PermissionSetAssignment')) return { records: [] };
      if (soql.includes('FROM GroupMember')) return { records: [] };
      return { records: [] };
    });
    sinon.stub(UserProvision.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => fakeConn },
        'users-def': usersPath,
        'personas-def': personasPath,
        'external-id': 'FederationIdentifier',
        'no-prompt': true,
        'dry-run': false,
        'api-version': undefined,
      },
    } as never);

    const result = await UserProvision.run(['--json']);
    const userSobject = fakeConn.sobject.withArgs('User').returnValues[0] as {
      create: sinon.SinonStub;
      update: sinon.SinonStub;
    };
    expect(userSobject.create.calledOnce).to.equal(true);
    expect(Array.isArray(userSobject.create.firstCall.args[0])).to.equal(true);
    expect((userSobject.create.firstCall.args[0] as unknown[]).length).to.equal(1);
    expect(userSobject.update.calledOnce).to.equal(true);
    expect(Array.isArray(userSobject.update.firstCall.args[0])).to.equal(true);
    expect((userSobject.update.firstCall.args[0] as unknown[]).length).to.equal(1);
    expect(result.summary.created + result.summary.updated).to.equal(2);
  });

  it('reports global warning count in summary', async () => {
    const fakeConn = createFakeConnection();
    fakeConn.query.callsFake(async (soql: string) => {
      if (soql.includes('FROM Profile')) return { records: [] };
      if (soql.includes('FROM UserRole')) return { records: [] };
      if (soql.includes('FROM PermissionSet')) return { records: [] };
      if (soql.includes('FROM PermissionSetGroup')) return { records: [] };
      if (soql.includes('FROM Group')) return { records: [] };
      return { records: [] };
    });
    sinon.stub(UserProvision.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => fakeConn },
        'users-def': 'test/fixtures/user-def.json',
        'personas-def': 'test/fixtures/persona-def.json',
        'external-id': undefined,
        'no-prompt': true,
        'dry-run': true,
        'api-version': undefined,
      },
    } as never);

    const result = await UserProvision.run(['--json']);
    expect(result.summary.warnings).to.be.greaterThan(0);
  });

  it('does not remove queue membership during public-group sync', async () => {
    const fakeConn = createFakeConnection();
    const dir = mkdtempSync(join(tmpdir(), 'jawn-provision-test-'));
    const usersPath = join(dir, 'users-sync.json');
    const personasPath = join(dir, 'personas-sync.json');
    writeFileSync(
      usersPath,
      JSON.stringify({
        users: [
          {
            Username: 'existing.user@example.test',
            FederationIdentifier: 'A002',
            persona: 'default',
            LastName: 'User',
            Alias: 'euser',
            TimeZoneSidKey: 'America/Los_Angeles',
            LocaleSidKey: 'en_US',
            EmailEncodingKey: 'UTF-8',
            LanguageLocaleKey: 'en_US',
          },
        ],
      })
    );
    writeFileSync(
      personasPath,
      JSON.stringify({
        personas: {
          default: { profile: 'Admin', publicGroupMode: 'sync', publicGroups: ['Pub1'] },
        },
      })
    );
    fakeConn.query.callsFake(async (soql: string) => {
      if (soql.includes('FROM Profile')) return { records: [{ Id: '00exx0000000001AAA', Name: 'Admin' }] };
      if (soql.includes('SELECT Id, IsActive, FederationIdentifier FROM User'))
        return { records: [{ Id: '005xx0000000002AAA', IsActive: true, FederationIdentifier: 'A002' }] };
      if (soql.includes("FROM Group WHERE DeveloperName IN ('Pub1') AND Type = 'Regular'"))
        return { records: [{ Id: '00Gpub000000001AAA', DeveloperName: 'Pub1' }] };
      if (soql.includes('FROM PermissionSetAssignment')) return { records: [] };
      if (soql.includes('FROM GroupMember')) {
        return {
          records: [
            { Id: '0GMpub', GroupId: '00Gold000000001AAA', Group: { Type: 'Regular' } },
            { Id: '0GMqueue', GroupId: '00Gqueue0000001AAA', Group: { Type: 'Queue' } },
          ],
        };
      }
      if (soql.includes('FROM UserLogin')) return { records: [] };
      return { records: [] };
    });
    sinon.stub(UserProvision.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => fakeConn },
        'users-def': usersPath,
        'personas-def': personasPath,
        'external-id': 'FederationIdentifier',
        'no-prompt': true,
        'dry-run': false,
        'api-version': undefined,
      },
    } as never);
    await UserProvision.run(['--json']);
    const groupMember = fakeConn.sobject.withArgs('GroupMember').returnValues[0] as { delete: sinon.SinonStub };
    const deletes = groupMember.delete
      .getCalls()
      .map((c) => c.args[0] as string[])
      .flat();
    expect(deletes).to.include('0GMpub');
    expect(deletes).to.not.include('0GMqueue');
  });

  it('fails duplicate external-id matches per user', async () => {
    const fakeConn = createFakeConnection();
    const dir = mkdtempSync(join(tmpdir(), 'jawn-provision-test-'));
    const usersPath = join(dir, 'users-dup.json');
    const personasPath = join(dir, 'personas-dup.json');
    writeFileSync(
      usersPath,
      JSON.stringify({
        users: [
          {
            Username: 'dup@example.test',
            FederationIdentifier: 'A100',
            persona: 'default',
            LastName: 'Dup',
            Alias: 'dup',
            TimeZoneSidKey: 'America/Los_Angeles',
            LocaleSidKey: 'en_US',
            EmailEncodingKey: 'UTF-8',
            LanguageLocaleKey: 'en_US',
          },
        ],
      })
    );
    writeFileSync(personasPath, JSON.stringify({ personas: { default: { profile: 'Admin' } } }));
    fakeConn.query.callsFake(async (soql: string) => {
      if (soql.includes('FROM Profile')) return { records: [{ Id: '00exx0000000001AAA', Name: 'Admin' }] };
      if (soql.includes('SELECT Id, IsActive, FederationIdentifier FROM User'))
        return {
          records: [
            { Id: '0051', IsActive: true, FederationIdentifier: 'A100' },
            { Id: '0052', IsActive: true, FederationIdentifier: 'A100' },
          ],
        };
      return { records: [] };
    });
    sinon.stub(UserProvision.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => fakeConn },
        'users-def': usersPath,
        'personas-def': personasPath,
        'external-id': 'FederationIdentifier',
        'no-prompt': true,
        'dry-run': false,
        'api-version': undefined,
      },
    } as never);
    const result = await UserProvision.run(['--json']);
    expect(result.users[0].status).to.equal('failed');
    expect(result.users[0].errors.join(' ')).to.include('Multiple users matched');
  });

  it('surfaces assignment dml failures in per-user errors', async () => {
    const fakeConn = createFakeConnection();
    fakeConn.sobjectMap.PermissionSetAssignment.create.resolves([
      { success: false, errors: [{ message: 'PSA failed' }] },
    ]);
    const dir = mkdtempSync(join(tmpdir(), 'jawn-provision-test-'));
    const usersPath = join(dir, 'users-psa.json');
    const personasPath = join(dir, 'personas-psa.json');
    writeFileSync(
      usersPath,
      JSON.stringify({
        users: [
          {
            Username: 'u@example.test',
            persona: 'default',
            LastName: 'U',
            Alias: 'u',
            TimeZoneSidKey: 'America/Los_Angeles',
            LocaleSidKey: 'en_US',
            EmailEncodingKey: 'UTF-8',
            LanguageLocaleKey: 'en_US',
          },
        ],
      })
    );
    writeFileSync(
      personasPath,
      JSON.stringify({ personas: { default: { profile: 'Admin', permissionSets: ['PermA'] } } })
    );
    fakeConn.query.callsFake(async (soql: string) => {
      if (soql.includes('FROM Profile')) return { records: [{ Id: '00exx0000000001AAA', Name: 'Admin' }] };
      if (soql.includes("FROM PermissionSet WHERE Name IN ('PermA')"))
        return { records: [{ Id: '0PSx', Name: 'PermA' }] };
      if (soql.includes('FROM UserLogin')) return { records: [] };
      if (soql.includes('FROM PermissionSetAssignment')) return { records: [] };
      if (soql.includes('FROM GroupMember')) return { records: [] };
      return { records: [] };
    });
    sinon.stub(UserProvision.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => fakeConn },
        'users-def': usersPath,
        'personas-def': personasPath,
        'external-id': undefined,
        'no-prompt': true,
        'dry-run': false,
        'api-version': undefined,
      },
    } as never);
    const result = await UserProvision.run(['--json']);
    expect(result.users[0].status).to.equal('failed');
    expect(result.users[0].errors.join(' ')).to.include('PSA failed');
  });

  it('fails when updating non-updateable fields', async () => {
    const fakeConn = createFakeConnection();
    fakeConn.describe.resolves({
      fields: [
        { name: 'FederationIdentifier', createable: true, updateable: true, externalId: true },
        { name: 'LastName', createable: true, updateable: false, externalId: false },
        { name: 'Alias', createable: true, updateable: true, externalId: false },
        { name: 'TimeZoneSidKey', createable: true, updateable: true, externalId: false },
        { name: 'LocaleSidKey', createable: true, updateable: true, externalId: false },
        { name: 'EmailEncodingKey', createable: true, updateable: true, externalId: false },
        { name: 'LanguageLocaleKey', createable: true, updateable: true, externalId: false },
        { name: 'ProfileId', createable: true, updateable: true, externalId: false },
      ],
    });
    const dir = mkdtempSync(join(tmpdir(), 'jawn-provision-test-'));
    const usersPath = join(dir, 'users-write.json');
    const personasPath = join(dir, 'personas-write.json');
    writeFileSync(
      usersPath,
      JSON.stringify({
        users: [
          {
            FederationIdentifier: 'A200',
            persona: 'default',
            LastName: 'Nope',
            Alias: 'np',
            TimeZoneSidKey: 'America/Los_Angeles',
            LocaleSidKey: 'en_US',
            EmailEncodingKey: 'UTF-8',
            LanguageLocaleKey: 'en_US',
          },
        ],
      })
    );
    writeFileSync(personasPath, JSON.stringify({ personas: { default: { profile: 'Admin' } } }));
    fakeConn.query.callsFake(async (soql: string) => {
      if (soql.includes('FROM Profile')) return { records: [{ Id: '00exx0000000001AAA', Name: 'Admin' }] };
      if (soql.includes('SELECT Id, IsActive, FederationIdentifier FROM User'))
        return { records: [{ Id: '005x', IsActive: true, FederationIdentifier: 'A200' }] };
      return { records: [] };
    });
    sinon.stub(UserProvision.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => fakeConn },
        'users-def': usersPath,
        'personas-def': personasPath,
        'external-id': 'FederationIdentifier',
        'no-prompt': true,
        'dry-run': false,
        'api-version': undefined,
      },
    } as never);
    const result = await UserProvision.run(['--json']);
    expect(result.users[0].status).to.equal('failed');
    expect(result.users[0].errors.join(' ')).to.include('not updateable');
  });

  it('reports cross-reference candidate fields for update failures', async () => {
    const fakeConn = createFakeConnection();
    const dir = mkdtempSync(join(tmpdir(), 'jawn-provision-test-'));
    const usersPath = join(dir, 'users-xref.json');
    const personasPath = join(dir, 'personas-xref.json');
    writeFileSync(
      usersPath,
      JSON.stringify({
        users: [
          {
            FederationIdentifier: 'A002',
            persona: 'default',
            LastName: 'User',
            Alias: 'euser',
            TimeZoneSidKey: 'America/Los_Angeles',
            LocaleSidKey: 'en_US',
            EmailEncodingKey: 'UTF-8',
            LanguageLocaleKey: 'en_US',
          },
        ],
      })
    );
    writeFileSync(
      personasPath,
      JSON.stringify({
        personas: {
          default: { profile: 'Admin', role: 'CEO' },
        },
      })
    );
    fakeConn.query.callsFake(async (soql: string) => {
      if (soql.includes('FROM Profile')) return { records: [{ Id: '00exx0000000001AAA', Name: 'Admin' }] };
      if (soql.includes('FROM UserRole'))
        return { records: [{ Id: '00Exx0000000001AAA', Name: 'CEO', DeveloperName: 'CEO' }] };
      if (soql.includes('SELECT Id, IsActive, FederationIdentifier FROM User'))
        return { records: [{ Id: '005xx0000000002AAA', IsActive: true, FederationIdentifier: 'A002' }] };
      if (soql.includes('FROM UserLogin')) return { records: [] };
      if (soql.includes('FROM PermissionSetAssignment')) return { records: [] };
      if (soql.includes('FROM GroupMember')) return { records: [] };
      return { records: [] };
    });
    fakeConn.sobjectMap.User.update.resolves([
      {
        success: false,
        errors: [{ message: 'invalid cross reference id', statusCode: 'INVALID_CROSS_REFERENCE_KEY', fields: [] }],
      },
    ]);
    sinon.stub(UserProvision.prototype as unknown as Record<string, unknown>, 'parse').resolves({
      flags: {
        'target-org': { getConnection: () => fakeConn },
        'users-def': usersPath,
        'personas-def': personasPath,
        'external-id': 'FederationIdentifier',
        'no-prompt': true,
        'dry-run': false,
        'api-version': undefined,
      },
    } as never);

    const result = await UserProvision.run(['--json']);
    expect(result.users[0].errors.join(' ')).to.include('Cross-reference update candidates for this user:');
    expect(result.users[0].errors.join(' ')).to.include('ProfileId=');
    expect(result.users[0].errors.join(' ')).to.include('UserRoleId=');
  });
});
