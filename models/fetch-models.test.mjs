// scripts/fetch-models.mjs builds models.json from the site's public catalog.
// Its whole job is turning 250 verbose entries into a small, pickable list — and
// refusing to write a broken one. These tests run it on a saved snapshot shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collect, document, trimModel, CATALOG_URL } from '../scripts/fetch-models.mjs';

const CATALOG = [
  {
    arena: 'text',
    models: [
      {
        id: '019c7820-5480-78b6-9fef-04c0d7004054',
        organization: 'google',
        provider: 'googleVertexGlobal',
        publicName: 'gemini-3.1-pro-preview',
        displayName: 'gemini-3.1-pro-preview',
        capabilities: { inputCapabilities: { text: true }, outputCapabilities: { text: true } },
        rank: 18,
        arenas: ['text', 'code'],
      },
      { id: '019e71ea', organization: 'openai', publicName: 'gpt-5.5-instant', displayName: 'GPT-5.5 Instant' },
      { id: 'no-public-name', organization: 'x' },
      { publicName: 'no-id', organization: 'x' },
    ],
  },
  { arena: 'text-to-image', models: [{ id: 'img-1', organization: 'alibaba', publicName: 'qwen-image-2.0' }] },
];

test('the URL is the site’s own catalog, not the locked legacy prefix', () => {
  assert.equal(CATALOG_URL, 'https://arena.ai/nextjs-api/model-catalog');
  // `/api/model-catalog` answers 403 "Route not allowed" today; a regression here
  // would ship a script that silently rebuilds nothing.
  assert.doesNotMatch(CATALOG_URL, /\/api\/model-catalog/);
});

test('only pickable entries survive, and only from the text arenas', () => {
  const models = collect(CATALOG);
  assert.deepEqual(models.map((m) => m.name).sort(), ['GPT-5.5 Instant', 'gemini-3.1-pro-preview']);
  // An image model is a different product; Direct Chat cannot open it.
  assert.ok(!models.some((m) => m.id === 'img-1'), 'image arena leaked into the chat picker');
});

test('a model keeps only the three fields a picker needs', () => {
  const m = trimModel(CATALOG[0].models[0]);
  assert.deepEqual(Object.keys(m).sort(), ['id', 'name', 'provider']);
  assert.equal(m.provider, 'google', 'the organization is the provider label, not the internal provider id');
  // displayName wins when it differs: it is the human label.
  assert.equal(trimModel(CATALOG[0].models[1]).name, 'GPT-5.5 Instant');
});

test('a model in several arenas appears once', () => {
  const twice = [
    { arena: 'text', models: [{ id: 'same', publicName: 'same-model', organization: 'o' }] },
    { arena: 'code', models: [{ id: 'same', publicName: 'same-model', organization: 'o' }] },
  ];
  assert.equal(collect(twice).length, 1);
});

test('the written file is stable, versioned and carries its source', () => {
  const doc = document(collect(CATALOG), { updated: '2026-11-12' });
  assert.equal(doc.version, 1);
  assert.equal(doc.source, CATALOG_URL);
  assert.equal(doc.updated, '2026-11-12');
  assert.deepEqual(doc.arenas, ['text', 'code']);
  assert.match(doc.note, /release asset/);
  // Rebuilding the same catalog is byte-identical: a diff means a real change.
  assert.equal(JSON.stringify(document(collect(CATALOG), { updated: '2026-11-12' })), JSON.stringify(doc));
});

test('an empty or shapeless catalog produces nothing (the caller refuses to write)', () => {
  assert.deepEqual(collect([]), []);
  assert.deepEqual(collect({}), []);
  assert.deepEqual(collect(null), []);
  assert.deepEqual(collect([{ arena: 'text', models: [{ name: 'no id' }] }]), []);
});
