import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraConnectionChanged } from '../src/_pages/cameras/model/camera-source.ts';

const saved = { source_url: 'rtsp://camera.example/live', source_type: 'rtsp', username: 'owner', auth_type: 'digest', profile: '', rtsp_port: null, password_set: true };
const current = { ...saved, password: '' };
test('unchanged offline and demo connections do not require a new probe', () => {
  assert.equal(cameraConnectionChanged(saved, current, true), false);
  const demo = { ...saved, source_url: '', password_set: false };
  assert.equal(cameraConnectionChanged(demo, { ...demo, password: '' }, false), false);
});
test('new sources and all credential changes require verification', () => {
  assert.equal(cameraConnectionChanged(undefined, current, false), true);
  assert.equal(cameraConnectionChanged(saved, current, false), true);
  for (const change of [{ source_url: 'rtsp://camera.example/new' }, { username: 'other' }, { password: 'new' }, { auth_type: 'basic' }, { profile: 'other' }, { rtsp_port: 555 }, { source_type: 'onvif' }]) {
    assert.equal(cameraConnectionChanged(saved, { ...current, ...change }, true), true);
  }
});
