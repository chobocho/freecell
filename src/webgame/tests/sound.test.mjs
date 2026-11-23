// 사운드 (SoundManager: Web Audio 초기화 / 재생)
import { SoundManager } from '../dist/sound.js';
import { suite, test, assert, assertEqual } from './helpers.mjs';

suite('SoundManager - 초기화 / suspended 컨텍스트 재개');

/**
 * 가짜 AudioContext 설치.
 * @param state  생성 직후 상태 ('running' | 'suspended')
 * @param resume resume() 동작: 'ok' | 'reject' | 'pending'(끝나지 않음)
 * @returns 생성된 컨텍스트 목록 (각 컨텍스트에 resumeCalls, started 기록)
 */
function installFakeAudio(state = 'running', resume = 'ok') {
  const created = [];
  globalThis.AudioContext = class {
    constructor() {
      this.state = state;
      this.sampleRate = 8000;
      this.destination = {};
      this.resumeCalls = 0;
      this.started = 0;
      created.push(this);
    }
    resume() {
      this.resumeCalls++;
      if (resume === 'reject') return Promise.reject(new Error('not allowed'));
      if (resume === 'pending') return new Promise(() => {});
      this.state = 'running';
      return Promise.resolve();
    }
    createBuffer(_ch, length) {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }
    createBufferSource() {
      return { connect() {}, start: () => { this.started++; } };
    }
    createGain() {
      return { gain: { value: 1 }, connect() {} };
    }
  };
  return created;
}

test('init: running 상태로 시작하면 resume 을 호출하지 않는다', async () => {
  const created = installFakeAudio('running');
  const s = new SoundManager();
  await s.init();
  assertEqual(created.length, 1);
  assertEqual(created[0].resumeCalls, 0);
});

test('init: suspended 상태로 시작하면(iOS Safari) 바로 resume 을 호출한다', async () => {
  const created = installFakeAudio('suspended');
  const s = new SoundManager();
  await s.init();
  assertEqual(created[0].resumeCalls, 1);
  assertEqual(created[0].state, 'running');
});

test('init: resume 이 거부되어도 초기화는 끝나고 소리를 낼 수 있다', async () => {
  const created = installFakeAudio('suspended', 'reject');
  const s = new SoundManager();
  await s.init();
  s.play('card_place');
  assertEqual(created[0].started, 1);
});

test('init: resume 이 끝나지 않아도 초기화가 멈추지 않는다', async () => {
  const created = installFakeAudio('suspended', 'pending');
  const s = new SoundManager();
  const done = await Promise.race([
    s.init().then(() => true),
    new Promise(r => setTimeout(() => r(false), 200)),
  ]);
  assert(done, 'init 이 200ms 안에 끝나야 함');
  s.play('card_place');
  assertEqual(created[0].started, 1);
});

test('init: 연달아 여러 번 불러도 AudioContext 는 하나만 만든다', async () => {
  const created = installFakeAudio('running');
  const s = new SoundManager();
  const a = s.init();
  const b = s.init();
  await Promise.all([a, b]);
  await s.init();
  assertEqual(created.length, 1);
});

test('init: AudioContext 를 만들 수 없어도 오류 없이 넘어가고, 다음 init 에서 다시 시도한다', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    globalThis.AudioContext = class { constructor() { throw new Error('no audio'); } };
    const s = new SoundManager();
    await s.init();
    s.play('win'); // 초기화 실패 상태에서도 오류 없음
    const created = installFakeAudio('running');
    await s.init();
    assertEqual(created.length, 1, '재시도');
    s.play('win');
    assertEqual(created[0].started, 1);
  } finally {
    console.warn = warn;
  }
});

test('play: 음소거 중에는 소리를 내지 않는다', async () => {
  const created = installFakeAudio('running');
  const s = new SoundManager();
  await s.init();
  s.toggleMute();
  s.play('card_place');
  assertEqual(created[0].started, 0);
  s.toggleMute();
  s.play('card_place');
  assertEqual(created[0].started, 1);
});

test('play: 백그라운드 복귀 등으로 suspended 가 되면 재생 시 resume 을 호출한다', async () => {
  const created = installFakeAudio('running');
  const s = new SoundManager();
  await s.init();
  created[0].state = 'suspended';
  s.play('card_place');
  assertEqual(created[0].resumeCalls, 1);
});
