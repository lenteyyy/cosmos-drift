import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_SPEED,
  MAX_SPEED,
  SPEEDS,
  SPEED_LABELS,
  DEFAULT_SPEED_LEVEL,
  KM_PER_LY,
  speedAtLevel,
  levelForSpeed,
  wheelSpeedLevel,
  flightSpeedLimit,
  flightEffects,
  formatSpeed,
  autopilotStep,
  splitPosition,
  translate,
  relative,
} from '../src/engine/navigation.mjs';

test('continuous speed spans 1 cm/s to exactly 500 million ly/s, with a label at every anchor', () => {
  assert.equal(MIN_SPEED * KM_PER_LY * 1000, 0.01);
  assert.equal(MAX_SPEED, 500000000);
  assert.equal(SPEEDS.length, SPEED_LABELS.length);
  assert.equal(speedAtLevel(0), MIN_SPEED);
  assert.equal(speedAtLevel(19), MAX_SPEED);
  assert.equal(speedAtLevel(DEFAULT_SPEED_LEVEL), 300 / KM_PER_LY);
  let prior = 0;
  for (let i = 0; i <= 19000; i++) {
    const level = i / 1000,
      speed = speedAtLevel(level);
    assert.ok(speed > prior && speed <= MAX_SPEED, `${level}: ${speed}`);
    assert.ok(Math.abs(levelForSpeed(speed) - level) < 1e-11);
    prior = speed;
  }
});
test('a 0.01-pixel scroll immediately and visibly changes speed throughout the range', () => {
  for (const level of [0.2, 3, 7, 12, 18.9]) {
    const base = speedAtLevel(level),
      faster = speedAtLevel(wheelSpeedLevel(level, -0.01)),
      slower = speedAtLevel(wheelSpeedLevel(level, 0.01));
    assert.ok(faster > base && slower < base);
    assert.notEqual(formatSpeed(faster), formatSpeed(base));
    assert.notEqual(formatSpeed(slower), formatSpeed(base));
    assert.ok(Math.abs(faster / base - Math.exp(0.000035)) < 1e-11);
  }
});
test('pixel, line and page wheels agree; Alt provides ten-times finer adjustment', () => {
  const base = 7,
    pixel = wheelSpeedLevel(base, -16),
    line = wheelSpeedLevel(base, -1, 1),
    page = wheelSpeedLevel(base, -0.02, 2, 800);
  assert.ok(Math.abs(pixel - line) < 1e-12 && Math.abs(pixel - page) < 1e-12);
  const fine = wheelSpeedLevel(base, -16, 0, 800, true);
  assert.ok(fine > base && fine < pixel);
  assert.ok(
    Math.abs(
      Math.log(speedAtLevel(fine) / speedAtLevel(base)) /
        Math.log(speedAtLevel(pixel) / speedAtLevel(base)) -
        0.1,
    ) < 1e-10,
  );
});
test('many tiny wheel events retain the same total change and reverse without a dead zone', () => {
  let split = 7;
  for (let i = 0; i < 1000; i++) split = wheelSpeedLevel(split, -0.01);
  const combined = wheelSpeedLevel(7, -10);
  assert.ok(Math.abs(split - combined) < 1e-10);
  for (let i = 0; i < 1000; i++) split = wheelSpeedLevel(split, 0.01);
  assert.ok(Math.abs(split - 7) < 1e-10);
  assert.equal(wheelSpeedLevel(0, 1e6), 0);
  assert.equal(wheelSpeedLevel(19, -1e6), 19);
});
test('boost and autopilot cannot exceed the global speed ceiling', () => {
  for (let level = 0; level <= 19; level += 0.125)
    for (const boost of [false, true]) {
      assert.ok(flightSpeedLimit(level, boost) > 0 && flightSpeedLimit(level, boost) <= MAX_SPEED);
    }
  assert.equal(flightSpeedLimit(19, true), MAX_SPEED);
  assert.equal(autopilotStep(46.5e9, 1e6, Infinity, 1 / 60).speed, MAX_SPEED);
  assert.ok(Number.isFinite(speedAtLevel(NaN)));
});
test('faster flight continuously increases particle brightness, streak length, flow and density', () => {
  let last = flightEffects(0);
  assert.equal(last.count, 0);
  assert.equal(last.opacity, 0);
  for (const speed of [
    MIN_SPEED,
    1 / KM_PER_LY,
    300 / KM_PER_LY,
    0.01,
    1,
    1e3,
    1e6,
    1e8,
    MAX_SPEED,
  ]) {
    const effect = flightEffects(speed);
    assert.ok(
      effect.opacity > last.opacity &&
        effect.length > last.length &&
        effect.rate > last.rate &&
        effect.count >= last.count,
    );
    assert.deepEqual(effect, flightEffects(-speed));
    last = effect;
  }
  assert.equal(last.count, 900);
  assert.equal(last.length, 43);
  assert.deepEqual(flightEffects(MAX_SPEED * 10), last);
});
test('minimum-speed motion survives at arbitrary fractional sectors and across sector boundaries', () => {
  for (const fraction of [0.3123456789, 0.4999999999999, -0.4999999999999]) {
    const position = splitPosition({ x: 46.5e9, y: 0, z: 0 });
    translate(position, [fraction, 0.271828, 0.123]);
    const before = structuredClone(position),
      step = MIN_SPEED / 60;
    for (let i = 0; i < 1000; i++) translate(position, [step, 0, 0]);
    const displacement = relative(position, before)[0];
    assert.ok(
      Math.abs(displacement - step * 1000) < step * 1000 * 1e-10,
      `${fraction}: ${displacement}`,
    );
  }
});
test('speed readouts expose fine changes instead of rounding slow flight to zero', () => {
  assert.equal(formatSpeed(0), '0 m/s');
  assert.equal(formatSpeed(MIN_SPEED), '0.01 m/s');
  assert.equal(formatSpeed(MAX_SPEED), '500 Mly/s');
  assert.notEqual(formatSpeed(MIN_SPEED), formatSpeed(MIN_SPEED * 1.000035));
});
