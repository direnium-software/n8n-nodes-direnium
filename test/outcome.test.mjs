import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toOutcome } from '../dist/nodes/Direnium/outcome.js';
import { agentLabel, humanize } from '../dist/nodes/Direnium/api.js';

const TO = '+972501234567';

test('a placed call passes the API response through', () => {
	const body = { id: 'c1', status: 'dialing', to: TO, createdAt: '2026-11-08T14:02:11.000Z', url: 'https://platform.direnium.com/business/agents/a1?call=c1' };
	assert.deepEqual(toOutcome(201, body, TO), { kind: 'placed', json: body });
});

test('test mode returns a not_called item instead of failing', () => {
	const outcome = toOutcome(202, { id: null, status: 'not_dialed', reason: 'test_only', to: TO }, TO);
	assert.equal(outcome.kind, 'not_called');
	assert.equal(outcome.json.reason, 'test_mode');
	assert.match(outcome.json.message, /\+972501234567 is not one of them/);
});

test('outside calling hours returns the next opening', () => {
	const outcome = toOutcome(422, { error: 'outside_calling_hours', nextOpenAt: '2026-11-08T07:00:00.000Z', timezone: 'Asia/Jerusalem' }, TO);
	assert.equal(outcome.kind, 'not_called');
	assert.equal(outcome.json.reason, 'outside_calling_hours');
	assert.match(outcome.json.message, /Sun 8 Nov, 09:00 \(Asia\/Jerusalem\)/);
});

test('API errors become readable messages', () => {
	assert.equal(toOutcome(401, {}, TO).message, 'Your Direnium API key is invalid or was deleted');
	assert.equal(toOutcome(403, {}, TO).message, "This API key can't place calls");
	assert.equal(toOutcome(404, {}, TO).message, 'This agent is not available for calls');
	assert.equal(toOutcome(400, { error: 'to must be a valid phone number' }, TO).message, 'The call was not placed: to must be a valid phone number');
	assert.equal(toOutcome(500, {}, TO).kind, 'error');
});

test('labels', () => {
	assert.equal(agentLabel({ id: 'a', name: 'נועה', variables: [], testMode: true }), 'נועה (test mode)');
	assert.equal(agentLabel({ id: 'a', name: 'נועה', variables: [] }), 'נועה');
	assert.equal(humanize('full_name'), 'Full name');
});
