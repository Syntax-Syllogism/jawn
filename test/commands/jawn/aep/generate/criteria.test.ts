import { mkdtempSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SfProject } from '@salesforce/core';
import { expect } from 'chai';
import sinon from 'sinon';
import JawnAepGenerateCriteria from '../../../../../src/commands/jawn/aep/generate/criteria.js';

describe('jawn aep generate criteria', () => {
  beforeEach(() => {
    process.env.SF_DISABLE_LOG_FILE = 'true';
  });

  afterEach(() => sinon.restore());

  it('parses argv and writes criteria files', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'jawn-aep-criteria-'));
    sinon.stub(SfProject, 'resolveProjectPath').resolves(projectDir);

    const result = await JawnAepGenerateCriteria.run([
      '--json',
      '--class-name',
      'AccountNameContainsFishCriteria',
      '--sobject',
      'Account',
      '--output-path',
      'generated',
    ]);

    const normalized = result.created.map((pathValue) => pathValue.replaceAll('\\', '/'));
    expect(normalized.some((p) => p.endsWith('main/classes/criteria/AccountNameContainsFishCriteria.cls'))).to.equal(
      true
    );
    expect(
      normalized.some((p) =>
        p.endsWith(
          'main/schema/custommetadata/applicationFactoryBindings/domainProcessBindings/DomainProcessBinding.AccountNameContainsFishCriteria.md-meta.xml'
        )
      )
    ).to.equal(true);
    const classPath = result.created.find((p) => p.endsWith('AccountNameContainsFishCriteria.cls'));
    if (classPath) expect(readFileSync(classPath, 'utf8')).to.include('implements IDomainProcessCriteria');
    await rm(projectDir, { recursive: true, force: true });
  });

  it('uses process-name + order for binding developer name', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'jawn-aep-criteria-'));
    sinon.stub(SfProject, 'resolveProjectPath').resolves(projectDir);

    const result = await JawnAepGenerateCriteria.run([
      '--json',
      '-c',
      'AccountNameContainsFishCriteria',
      '--sobject',
      'Account',
      '--process-name',
      'FishCompanySlogans',
      '--order',
      '10.10',
      '--output-path',
      'generated',
    ]);

    const normalized = result.created.map((pathValue) => pathValue.replaceAll('\\', '/'));
    expect(
      normalized.some((p) => p.endsWith('DomainProcessBinding.FishCompanySlogans10_10Criteria.md-meta.xml'))
    ).to.equal(true);
    await rm(projectDir, { recursive: true, force: true });
  });

  it('rejects invalid order values', async () => {
    let caught: unknown;
    try {
      await JawnAepGenerateCriteria.run([
        '--json',
        '--sobject',
        'Account',
        '--class-name',
        'AccountNameContainsFishCriteria',
        '--order',
        'ten',
      ]);
    } catch (error) {
      caught = error;
    }

    expect(caught).to.be.instanceOf(Error);
    expect((caught as Error).message).to.contain('decimal-like value');
  });

  it('rejects overlong binding developer names', async () => {
    let caught: unknown;
    try {
      await JawnAepGenerateCriteria.run([
        '--json',
        '--sobject',
        'Account',
        '--class-name',
        'AccountNameContainsFishCriteria',
        '--process-name',
        'ThisProcessNameIsIntentionallyWayTooLongForSalesforceMetadata',
        '--order',
        '10.10',
      ]);
    } catch (error) {
      caught = error;
    }

    expect(caught).to.be.instanceOf(Error);
    expect((caught as Error).message).to.contain('40-character Salesforce limit');
  });

  it('rejects invalid trigger operation values', async () => {
    let caught: unknown;
    try {
      await JawnAepGenerateCriteria.run([
        '--json',
        '-c',
        'AccountNameContainsFishCriteria',
        '--sobject',
        'Account',
        '--trigger-operation',
        'Before_Merge',
      ]);
    } catch (error) {
      caught = error;
    }
    expect(String(caught)).to.include('--trigger-operation');
  });
});
