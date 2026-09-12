import test from 'node:test';
import assert from 'node:assert/strict';
import { directionsUrl, openBusinessUrl } from '../../src/ios/businessLinks.js';

// Synthetic records; no production identifiers or shared destination state.
const A = { id: 'fixture-a', name: 'Business A', address: '818 E Overland Trail, Abilene, TX 79601' };
const B = { id: 'fixture-b', name: 'Business B', address: '123 Oak Street, Example City, TX 75001' };
const C = { id: 'fixture-c', name: 'Business C', address: '456 Pine Avenue, Example City, TX 75002' };
const destination = (url) => new URL(url).searchParams.get('daddr');

for (const business of [A, B, C]) {
  test(`${business.id}: its own address reaches the opening boundary`, () => {
    let opened;
    openBusinessUrl({ preventDefault() {} }, business, 'directions', {
      open: (url) => { opened = url; }, track: () => {},
    });
    assert.equal(destination(opened), business.address);
    assert.equal(new URL(opened).origin, 'https://maps.apple.com');
    assert.equal(new URL(opened).searchParams.has('saddr'), false);
  });
}

test('Three businesses generate three different destinations', () => {
  assert.equal(new Set([A, B, C].map(directionsUrl)).size, 3);
});

test('A → B → A sends A, B, A despite pending tracking', () => {
  const opened = [];
  for (const business of [A, B, A]) {
    openBusinessUrl({ preventDefault() {} }, business, 'directions', {
      open: (url) => opened.push(destination(url)), track: () => new Promise(() => {}),
    });
  }
  assert.deepEqual(opened, [A.address, B.address, A.address]);
});

test('Address whitespace is trimmed and encoded without changing its meaning', () => {
  assert.equal(destination(directionsUrl({ ...A, address: `  ${A.address}  ` })), A.address);
  assert.ok(!directionsUrl(A).includes(' '));
});

test('Missing coordinates use the selected record address', () => {
  assert.equal(destination(directionsUrl({ ...B, latitude: undefined, longitude: undefined })), B.address);
});

test('Valid coordinate pair belongs to the supplied object, with no previous value retained', () => {
  assert.equal(destination(directionsUrl({ ...A, latitude: 32.5, longitude: -99.7 })), '32.5,-99.7');
  assert.equal(destination(directionsUrl(B)), B.address);
});

test('Invalid coordinates fall back to the selected address', () => {
  for (const coordinates of [{ latitude: 91, longitude: -99 }, { latitude: null, longitude: '' }, { latitude: NaN, longitude: 10 }]) {
    assert.equal(destination(directionsUrl({ ...C, ...coordinates })), C.address);
  }
});

test('Name-only fallback is scoped to the selected name', () => {
  assert.equal(new URL(directionsUrl({ name: 'Business without address' })).searchParams.get('q'), 'Business without address, Abilene TX');
});
