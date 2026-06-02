import { mkdtempSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SfProject } from '@salesforce/core';
import { expect } from 'chai';
import sinon from 'sinon';
import JawnAepGenerateSelectorFieldInjection from '../../../../../../src/commands/jawn/aep/generate/selector/field-injection.js';

describe('jawn aep generate selector field-injection', () => {
  beforeEach(() => {
    process.env.SF_DISABLE_LOG_FILE = 'true';
  });

  afterEach(() => sinon.restore());

  it('writes fieldset and binding from comma-separated fields', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'jawn-aep-field-injection-'));
    sinon.stub(SfProject, 'resolveProjectPath').resolves(projectDir);

    const result = await JawnAepGenerateSelectorFieldInjection.run([
      '--json',
      '--sobject',
      'Account',
      '--fields',
      'Name, Industry',
      '--output-path',
      'generated',
    ]);

    const fieldSetPath = result.created.find((p) => p.endsWith('SelectorInclusion_AccountFields.fieldSet-meta.xml'));
    const bindingPath = result.created.find((p) =>
      p.endsWith('SelectorConfig_FieldSetInclusion.SelectorInclusion_AccountFields.md-meta.xml')
    );
    expect(fieldSetPath).to.not.equal(undefined);
    expect(bindingPath).to.not.equal(undefined);
    if (fieldSetPath) {
      const xml = readFileSync(fieldSetPath, 'utf8');
      expect(xml).to.include('<field>Name</field>');
      expect(xml).to.include('<field>Industry</field>');
    }
    await rm(projectDir, { recursive: true, force: true });
  });

  it('uses explicit --fieldset-name when provided', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'jawn-aep-field-injection-'));
    sinon.stub(SfProject, 'resolveProjectPath').resolves(projectDir);

    const result = await JawnAepGenerateSelectorFieldInjection.run([
      '--json',
      '--sobject',
      'Account',
      '--fields',
      'Name',
      '--fieldset-name',
      'AccountFieldsFromMarketing',
      '--output-path',
      'generated',
    ]);
    expect(result.created.some((p) => p.endsWith('AccountFieldsFromMarketing.fieldSet-meta.xml'))).to.equal(true);
    await rm(projectDir, { recursive: true, force: true });
  });

  it('rejects overlong explicit --fieldset-name values', async () => {
    let caught: unknown;
    try {
      await JawnAepGenerateSelectorFieldInjection.run([
        '--json',
        '--sobject',
        'Account',
        '--fields',
        'Name',
        '--fieldset-name',
        'ThisFieldSetNameIsIntentionallyWayTooLongForSalesforceMetadata',
      ]);
    } catch (error) {
      caught = error;
    }

    expect(caught).to.be.instanceOf(Error);
    expect((caught as Error).message).to.contain('40-character Salesforce limit');
  });

  it('uses deploy-safe default fieldset name length for custom objects', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'jawn-aep-field-injection-'));
    sinon.stub(SfProject, 'resolveProjectPath').resolves(projectDir);

    const result = await JawnAepGenerateSelectorFieldInjection.run([
      '--json',
      '--sobject',
      'CKR_ChecklistInstance__c',
      '--fields',
      'Name',
      '--output-path',
      'generated',
    ]);
    expect(
      result.created.some((p) => p.endsWith('SelectorInclusion_CKRChecklistInstFields.fieldSet-meta.xml'))
    ).to.equal(true);
    expect(
      result.created.some((p) =>
        p.endsWith('SelectorConfig_FieldSetInclusion.SelectorInclusion_CKRChecklistInstFields.md-meta.xml')
      )
    ).to.equal(true);
    await rm(projectDir, { recursive: true, force: true });
  });

  it('rejects empty --fields payloads', async () => {
    let caught: unknown;
    try {
      await JawnAepGenerateSelectorFieldInjection.run(['--json', '--sobject', 'Account', '--fields', ' , ']);
    } catch (error) {
      caught = error;
    }
    expect(String(caught)).to.include('At least one field must be provided');
  });
});
