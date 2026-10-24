// Dependency-free checkpoint checks for Node 22 while package installation is unavailable.
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) {
      return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')), shortCircuit: true };
    }
    return next(url, context);
  }
});
const { applyClientValue, applyCommissionIntent, createEmptyBrief, fieldLabel, normalizeBrief } = await import('../src/lib/brief.ts');
const { parseCommissionIntent } = await import('../src/lib/commissionContext.ts');
const { applyOfferImportDecisions, dismissOfferImport, proposeOfferImport } = await import('../src/lib/offers/intake.ts');
const { COMMERCE_LAUNCH_OFFER } = await import('../src/lib/offers/commerce.ts');
const queries = [
  'offer=commerce_launch&interest=ecommerce_storefronts&purpose=business',
  'purpose=study&example=study_organizer&route=custom_project'
];
for (const query of queries) {
  const intent = parseCommissionIntent(new URLSearchParams(query));
  const brief = applyCommissionIntent(createEmptyBrief(), intent);
  for (const key of ['vision', 'audience', 'goals', 'priorities', 'constraints', 'budget', 'timing']) {
    assert.equal(brief[key].value, '', `${key} must remain unknown for ${query}`);
    assert.equal(brief[key].provenance, 'empty');
  }
  const corrected = applyClientValue(brief, 'vision', 'Aethelios — étude 🌿');
  assert.equal(applyCommissionIntent(corrected, intent).vision.value, corrected.vision.value);
}
const commerce = applyCommissionIntent(createEmptyBrief(), parseCommissionIntent(new URLSearchParams(queries[0])));
assert.equal(fieldLabel('vision', commerce), 'Project vision');
assert.equal(commerce.context.offerId, 'commerce_launch');
assert.ok(proposeOfferImport(commerce, 'commerce_launch').fields.some(field => field.key === 'vision'));
const skipped = applyOfferImportDecisions(commerce, {}, 'commerce_launch');
assert.equal(skipped.vision.value, '');
assert.equal(skipped.goals.value, '');
const accepted = applyOfferImportDecisions(commerce, { vision: 'append' }, 'commerce_launch');
assert.equal(accepted.vision.value, COMMERCE_LAUNCH_OFFER.starter.vision);
assert.equal(accepted.vision.provenance, 'client_statement');
assert.equal(accepted.priorities.value, '');
assert.equal(dismissOfferImport(accepted).vision.value, accepted.vision.value);
assert.equal(dismissOfferImport(accepted).context.offerId, '');
assert.equal(normalizeBrief(JSON.parse(JSON.stringify(accepted))).vision.value, accepted.vision.value);
assert.equal(applyCommissionIntent(accepted, parseCommissionIntent(new URLSearchParams(queries[1]))).vision.value, accepted.vision.value);
console.log('PASS: fresh Commerce/study entries, explicit acceptance, skip, Unicode corrections, context changes, and saved wording');
