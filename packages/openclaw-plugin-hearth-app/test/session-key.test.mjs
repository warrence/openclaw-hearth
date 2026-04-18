import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentSessionKey } from 'openclaw/plugin-sdk/core';
import { buildHearthPeerId, buildHearthSessionKey } from '../dist/session-key.js';

test('buildHearthSessionKey keeps Hearth conversations isolated per chat', () => {
  const params = {
    agentId: 'Main',
    profileSlug: 'Warrence',
    conversationUuid: '96ec0f62-ad2b-4d62-ae5c-fd8e372ec3bd',
  };

  const peerId = buildHearthPeerId(params);
  const defaultDirectSession = buildAgentSessionKey({
    agentId: params.agentId,
    channel: 'hearth-app',
    accountId: 'default',
    peer: { kind: 'direct', id: peerId },
  });
  const hearthSession = buildHearthSessionKey(params);

  assert.equal(defaultDirectSession, 'agent:main:main');
  assert.equal(
    hearthSession,
    'agent:main:hearth-app:direct:app:warrence:conv:96ec0f62-ad2b-4d62-ae5c-fd8e372ec3bd',
  );
  assert.notEqual(hearthSession, defaultDirectSession);
});
