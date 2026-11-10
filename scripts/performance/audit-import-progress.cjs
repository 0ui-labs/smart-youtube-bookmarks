// Diagnostic only: execute the real store with a deterministic frame scheduler.
// Run from the repository root: node scripts/performance/audit-import-progress.cjs
const assert = require('node:assert/strict');
const esbuild = require('esbuild');

async function main() {
  const result = await esbuild.build({
    entryPoints: ['frontend/src/stores/importProgressStore.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(
    loaded, loaded.exports, require
  );
  const store = loaded.exports.useImportProgressStore;
  let nextId = 0;
  const frames = new Map();
  global.requestAnimationFrame = (callback) => {
    const id = ++nextId;
    frames.set(id, callback);
    return id;
  };
  global.cancelAnimationFrame = (id) => frames.delete(id);
  // Synthetic timers deliberately do not fire: measure idle animation work.
  global.window = { setInterval: () => ++nextId };
  global.clearInterval = () => {};

  for (const importing of [1, 10, 100]) {
    store.getState().clearAllProgress();
    frames.clear();
    for (let i = 0; i < importing; i++) {
      store.getState().setProgress(`video-${i}`, 0, 'created');
    }
    let storeUpdates = 0;
    let subscriberCallbacks = 0;
    const countUpdates = store.subscribe(() => storeUpdates++);
    const unsubscribe = Array.from({ length: 1000 }, () =>
      store.subscribe(() => subscriberCallbacks++)
    );
    for (let frame = 0; frame < 60; frame++) {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback();
    }
    countUpdates();
    unsubscribe.forEach((stop) => stop());
    const displayProgress = store.getState().getDisplayProgress('video-0');
    assert.equal(displayProgress, 0);
    console.log(JSON.stringify({
      importing, subscribers: 1000, simulatedFrames: 60,
      storeUpdates, subscriberCallbacks, displayProgress,
    }));
  }
  store.getState().clearAllProgress();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
