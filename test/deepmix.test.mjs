// 既有用例（13 个）。
//
// 它们按 README「对外保证」断言 deepmix 的基础行为：扁平对象与一层嵌套的合并。
// 起点时这 13 个用例全部通过（不允许出现语法错或导入失败）。
// 不要修改这里的断言。

import { test } from "node:test";
import assert from "node:assert/strict";

import { deepmix } from "../index.js";

test("扁平对象合并：source 的键并进来，同键以 source 为准", () => {
  const out = deepmix({ a: 1, b: 2 }, { b: 3, c: 4 });
  assert.deepEqual(out, { a: 1, b: 3, c: 4 });
});

test("返回的是一个新对象，不是任一入参本身", () => {
  const target = { a: 1 };
  const source = { b: 2 };
  const out = deepmix(target, source);
  assert.notEqual(out, target);
  assert.notEqual(out, source);
});

test("返回的是普通对象", () => {
  const out = deepmix({ a: 1 }, { b: 2 });
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
});

test("source 为空对象时，结果等于 target 的浅拷贝内容", () => {
  const out = deepmix({ a: 1, b: 2 }, {});
  assert.deepEqual(out, { a: 1, b: 2 });
});

test("target 为空对象时，结果等于 source 的内容", () => {
  const out = deepmix({}, { a: 1, b: 2 });
  assert.deepEqual(out, { a: 1, b: 2 });
});

test("一层嵌套对象递归合并：两边的子键都保留", () => {
  const out = deepmix({ n: { a: 1 } }, { n: { b: 2 } });
  assert.deepEqual(out, { n: { a: 1, b: 2 } });
});

test("一层嵌套对象同键：以 source 为准", () => {
  const out = deepmix({ n: { a: 1 } }, { n: { a: 2 } });
  assert.deepEqual(out, { n: { a: 2 } });
});

test("一层嵌套里 source 新增子键，target 原有子键保留", () => {
  const out = deepmix({ n: { a: 1, b: 2 } }, { n: { c: 3 } });
  assert.deepEqual(out, { n: { a: 1, b: 2, c: 3 } });
});

test("结果是独立的子对象，不与 source 的子对象同一", () => {
  const source = { n: { a: 1 } };
  const out = deepmix({ n: {} }, source);
  assert.notEqual(out.n, source.n);
  assert.deepEqual(out.n, { a: 1 });
});

test("null 是普通值：覆盖 target 上已有的键", () => {
  const out = deepmix({ a: 1, b: 2 }, { a: null });
  assert.deepEqual(out, { a: null, b: 2 });
});

test("一层嵌套里 source 的子键为 null 时，整体替换该子键", () => {
  const out = deepmix({ n: { a: 1 } }, { n: null });
  assert.deepEqual(out, { n: null });
});

test("数字 / 字符串 / 布尔等标量按原值合并", () => {
  const out = deepmix({ n: 1, s: "a", b: false }, { n: 2, s: "b", b: true });
  assert.deepEqual(out, { n: 2, s: "b", b: true });
});

test("多层键各自独立合并", () => {
  const out = deepmix(
    { user: { name: "ann", age: 30 }, flag: true },
    { user: { age: 31 }, extra: "x" },
  );
  assert.deepEqual(out, { user: { name: "ann", age: 31 }, flag: true, extra: "x" });
});
