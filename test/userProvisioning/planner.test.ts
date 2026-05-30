import { expect } from 'chai';
import {
  buildFieldMap,
  canonicalizeFieldObject,
  isSalesforceId,
  mergeUserFields,
  missingRequiredFieldsForInsert,
  normalizeMode,
  validateAndCanonicalizeUsers,
  validateExternalIdField,
  validatePersonaModes,
} from '../../src/userProvisioning/planner.js';

describe('userProvisioning planner', () => {
  const fieldMap = buildFieldMap([
    { name: 'Username', createable: true, updateable: true },
    { name: 'FederationIdentifier', createable: true, updateable: true },
    { name: 'FirstName', createable: true, updateable: true },
    { name: 'LastName', createable: true, updateable: true },
    { name: 'Email', createable: true, updateable: true },
  ]);

  it('canonicalizes user fields case-insensitively', () => {
    const result = canonicalizeFieldObject({ username: 'u', lastname: 'doe' }, fieldMap, 'test');
    expect(result).to.deep.equal({ Username: 'u', LastName: 'doe' });
  });

  it('merges persona attributes and prefers user-level values', () => {
    const result = mergeUserFields({ LastName: 'Persona' }, { LastName: 'User', Email: 'x@y.com' });
    expect(result).to.deep.equal({ LastName: 'User', Email: 'x@y.com' });
  });

  it('defaults assignment modes to additive', () => {
    expect(normalizeMode(undefined)).to.equal('additive');
  });

  it('rejects invalid assignment mode', () => {
    expect(() => normalizeMode('replace')).to.throw('Invalid assignment mode');
  });

  it('validates persona mode/list shape', () => {
    expect(() =>
      validatePersonaModes({ admin: { permissionSetMode: 'additive', permissionSets: ['A'] } })
    ).not.to.throw();
    expect(() => validatePersonaModes({ admin: { permissionSetMode: 'bad' as never } })).to.throw(
      'Invalid assignment mode'
    );
  });

  it('rejects unknown persona on user records', () => {
    expect(() =>
      validateAndCanonicalizeUsers([{ persona: 'missing', username: 'x' }], { admin: {} }, fieldMap)
    ).to.throw('Unknown persona');
  });

  it('validates external id field', () => {
    expect(() => validateExternalIdField('FederationIdentifier', fieldMap)).not.to.throw();
    expect(() => validateExternalIdField('Email', fieldMap)).not.to.throw();
    expect(() => validateExternalIdField('LastName', fieldMap)).to.throw('external ID field');
  });

  it('canonicalizes and merges users with persona defaults', () => {
    const users = validateAndCanonicalizeUsers(
      [{ persona: 'admin', username: 'u1', firstname: 'Jane', lastname: 'User' }],
      { admin: { userAttributes: { LastName: 'Persona' } } },
      fieldMap
    );
    expect(users[0].fields.LastName).to.equal('User');
    expect(users[0].fields.Username).to.equal('u1');
    expect(users[0].persona).to.equal('admin');
  });

  it('validates practical required fields for inserts', () => {
    const missing = missingRequiredFieldsForInsert(
      {
        Username: 'u',
        LastName: 'ln',
      },
      {}
    );
    expect(missing).to.include('Alias');
    expect(missing).to.include('ProfileId');
  });

  it('treats only base62 15 or 18 char as ids', () => {
    expect(isSalesforceId('005000000000001')).to.equal(true);
    expect(isSalesforceId('Admin_Permissions')).to.equal(false);
  });
});
