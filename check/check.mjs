// check/check.mjs —— deepmix 的固定验收程序。
//
// 不要修改本文件。它是判定「题目有没有做对」的依据；
// 改它只会让判定失效，不会让实现变对。
//
// 用法：
//   node check/check.mjs                  # 跑全部 10 个场景
//   node check/check.mjs -list            # 列出全部场景
//   node check/check.mjs --only safety    # 只跑一组
//
// 每个场景独立记分，一个场景抛错不会遮蔽其余场景；结尾打印 `结果：通过 x/N`，
// 全过 exit 0，否则 exit 1。**单进程跑**：不使用 child_process / worker_threads / 网络。

import { isDeepStrictEqual } from "node:util";

import { deepmix } from "../index.js";

class Failure extends Error {
  constructor(expected, actual) {
    super("场景不满足契约");
    this.expected = expected;
    this.actual = actual;
  }
}

function fail(expected, actual) {
  throw new Failure(expected, actual);
}

function fmt(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text;
  } catch {
    return String(value);
  }
}

function check(condition, expected, actual) {
  if (!condition) {
    fail(expected, actual);
  }
}

function eq(expect, actual, what) {
  if (!Object.is(expect, actual)) {
    fail(`${what}：期望=${fmt(expect)}`, `实际=${fmt(actual)}`);
  }
}

function deepEq(expect, actual, what) {
  if (!isDeepStrictEqual(expect, actual)) {
    fail(`${what}：期望=${fmt(expect)}`, `实际=${fmt(actual)}`);
  }
}

function snapshot(value) {
  return structuredClone(value);
}

function clearProto() {
  delete Object.prototype.polluted;
}

// ------------------------------------------------------------- merge

function m1_flat_merge() {
  const target = { a: 1, b: 2 };
  const source = { b: 3, c: 4 };
  const out = deepmix(target, source);
  deepEq({ a: 1, b: 3, c: 4 }, out, "扁平对象合并");

  deepEq({ a: 1, b: 2 }, deepmix({ a: 1, b: 2 }, {}), "source 为空对象");
  deepEq({ a: 1, b: 2 }, deepmix({}, { a: 1, b: 2 }), "target 为空对象");

  const keep = deepmix({ n: 1, s: "x", f: false }, { n: 2, s: "y", f: true });
  deepEq({ n: 2, s: "y", f: true }, keep, "标量按 source 覆盖");
  eq(Object.prototype, Object.getPrototypeOf(keep), "结果是普通对象");
}

function m2_nested_merge() {
  deepEq({ n: { a: 1, b: 2 } }, deepmix({ n: { a: 1 } }, { n: { b: 2 } }), "一层嵌套递归合并");
  deepEq({ n: { a: 2 } }, deepmix({ n: { a: 1 } }, { n: { a: 2 } }), "嵌套同键以 source 为准");
  deepEq(
    { user: { name: "ann", age: 31 }, flag: true },
    deepmix({ user: { name: "ann", age: 30 }, flag: true }, { user: { age: 31 } }),
    "多层键各自合并",
  );
  // source 的嵌套是普通对象、target 没有对应键时应新建普通对象
  const fresh = deepmix({}, { n: { a: 1 } });
  deepEq({ n: { a: 1 } }, fresh, "target 无该键时嵌套对象整体带入");
  eq(Object.prototype, Object.getPrototypeOf(fresh.n), "新建的嵌套对象是普通对象");
}

function m3_array_replace_and_concat() {
  deepEq([9], deepmix({ list: [1, 2] }, { list: [9] }).list, "数组默认整体替换");
  deepEq([1, 2], deepmix({}, { list: [1, 2] }).list, "target 无该键时数组原样带入");
  deepEq([9], deepmix({ n: { list: [1, 2] } }, { n: { list: [9] } }).n.list, "嵌套里的数组同样整体替换");

  const concatenated = deepmix({ list: [1, 2] }, { list: [9] }, { concat: true });
  deepEq([1, 2, 9], concatenated.list, "concat:true 时数组拼接");
  const nestedConcat = deepmix({ n: { list: [1] } }, { n: { list: [2, 3] } }, { concat: true });
  deepEq([1, 2, 3], nestedConcat.n.list, "嵌套里的 concat:true 拼接");
}

// ------------------------------------------------------------- purity

function p1_inputs_snapshot_unchanged() {
  const target = { a: 1, n: { deep: { x: 1 }, keep: true }, list: [1, 2] };
  const source = { a: 9, n: { deep: { y: 2 }, keep: false }, list: [3] };
  const targetSnap = snapshot(target);
  const sourceSnap = snapshot(source);

  deepmix(target, source, { concat: true });

  deepEq(targetSnap, target, "调用后 target 需与调用前完全一致");
  deepEq(sourceSnap, source, "调用后 source 需与调用前完全一致");
}

function p2_source_side_not_mutated() {
  const target = { n: { a: 1 } };
  const source = { n: { a: 2, b: 3 }, extra: { z: 1 } };
  const sourceSnap = snapshot(source);

  const out = deepmix(target, source);

  deepEq(sourceSnap, source, "调用后 source 需与调用前完全一致");
  check(out !== target && out !== source, "结果必须是新对象（既不是 target 也不是 source）",
    `out===target? ${out === target} ; out===source? ${out === source}`);
  eq(Object.prototype, Object.getPrototypeOf(out), "结果是普通对象");
}

// ------------------------------------------------------------- cycles

function c1_self_reference() {
  const source = { a: 1, n: { x: 1 } };
  source.self = source;
  source.n.owner = source;

  const out = deepmix({}, source);

  eq(1, out.a, "循环输入里的普通字段仍要合并");
  deepEq({ x: 1 }, { x: out.n.x }, "循环输入里的嵌套对象仍要合并");
  check(out.self === out, "自引用必须保留引用图（out.self === out）", `实际 ${out.self === out}`);
  check(out.n.owner === out, "深层自引用同样要闭合（out.n.owner === out）", `实际 ${out.n.owner === out}`);
}

function c2_mutual_reference() {
  const a = { name: "a" };
  const b = { name: "b", peer: a };
  a.peer = b;

  const out = deepmix({}, a);

  eq("a", out.name, "互相引用的起始对象字段要合并");
  eq("b", out.peer.name, "peer 对象字段要合并");
  eq("a", out.peer.peer.name, "peer 的 peer 要闭合回起始对象");
  check(out.peer.peer === out, "互引用必须闭合成环（out.peer.peer === out）", `实际 ${out.peer.peer === out}`);
  check(out !== a && out.peer !== b, "结果不得直接复用入参对象", `out===a? ${out === a} ; out.peer===b? ${out.peer === b}`);
}

// ------------------------------------------------------------- safety

function s1_proto_pollution() {
  clearProto();
  try {
    const source = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
    const out = deepmix({}, source);

    check(!Object.prototype.hasOwnProperty.call(out, "__proto__"),
      "结果对象上不得有 __proto__ 这个自有键", `实际自有键=${fmt(Object.keys(out))}`);
    eq(Object.prototype, Object.getPrototypeOf(out), "结果的原型必须是 Object.prototype");
    check(({}).polluted === undefined,
      "不得污染 Object.prototype：({}).polluted 必须为 undefined", `实际 ${fmt(({}).polluted)}`);
    eq(1, out.safe, "同一输入里的普通字段仍要合并");
  } finally {
    clearProto();
  }
}

function s2_getter_and_own_enumerable() {
  let calls = 0;
  const proto = { inherited: "from-proto" };
  const source = Object.create(proto);
  Object.defineProperty(source, "computed", {
    enumerable: true,
    configurable: true,
    get() {
      calls += 1;
      return 42;
    },
  });
  source.plain = 1;

  const out = deepmix({}, source);

  eq(0, calls, "深合并过程中不得求值 getter");
  eq(1, out.plain, "自有可枚举数据属性要拷进来");
  check(!Object.prototype.hasOwnProperty.call(out, "inherited"),
    "继承而来（非自有）的可枚举属性不得带进结果", `实际自有键=${fmt(Object.keys(out))}`);
}

function s3_undefined_no_overwrite() {
  const target = { a: 1, n: { x: 1, y: 2 }, keep: true };
  const source = { a: undefined, n: undefined, added: undefined, keep: false };

  const out = deepmix(target, source);

  eq(1, out.a, "值为 undefined 的键不得覆盖已有值");
  deepEq({ x: 1, y: 2 }, out.n, "值为 undefined 的键不得清空已有子对象");
  check(!Object.prototype.hasOwnProperty.call(out, "added"),
    "值为 undefined 的键不得新增到结果上", `实际自有键=${fmt(Object.keys(out))}`);
  eq(false, out.keep, "非 undefined 的普通值照常覆盖");
}

// ------------------------------------------------------------------ main

const scenarios = [
  { group: "merge", name: "M1_flat_merge", run: m1_flat_merge },
  { group: "merge", name: "M2_nested_merge", run: m2_nested_merge },
  { group: "merge", name: "M3_array_replace_and_concat", run: m3_array_replace_and_concat },
  { group: "purity", name: "P1_inputs_snapshot_unchanged", run: p1_inputs_snapshot_unchanged },
  { group: "purity", name: "P2_source_side_not_mutated", run: p2_source_side_not_mutated },
  { group: "cycles", name: "C1_self_reference", run: c1_self_reference },
  { group: "cycles", name: "C2_mutual_reference", run: c2_mutual_reference },
  { group: "safety", name: "S1_proto_pollution", run: s1_proto_pollution },
  { group: "safety", name: "S2_getter_and_own_enumerable", run: s2_getter_and_own_enumerable },
  { group: "safety", name: "S3_undefined_no_overwrite", run: s3_undefined_no_overwrite },
];

const GROUPS = ["merge", "purity", "cycles", "safety"];

function parseArgs(argv) {
  let list = false;
  let only = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-list" || arg === "--list") {
      list = true;
    } else if (arg === "--only") {
      only = argv[i + 1] ?? null;
      i += 1;
    } else {
      console.error(`未知参数 ${arg}（可用：-list / --only <组>）`);
      process.exit(2);
    }
  }
  return { list, only };
}

function main() {
  const { list, only } = parseArgs(process.argv.slice(2));

  if (list) {
    for (const scenario of scenarios) {
      console.log(`${scenario.group}/${scenario.name}`);
    }
    return;
  }

  if (only !== null && !GROUPS.includes(only)) {
    console.error(`未知分组 ${only}（可选：${GROUPS.join(" / ")}）`);
    process.exit(2);
  }

  let total = 0;
  let passed = 0;

  for (const scenario of scenarios) {
    if (only !== null && scenario.group !== only) {
      continue;
    }
    total += 1;
    try {
      scenario.run();
      passed += 1;
      console.log(`PASS ${scenario.group}/${scenario.name}`);
    } catch (error) {
      if (error instanceof Failure) {
        console.log(`FAIL ${scenario.group}/${scenario.name}  期望=${error.expected} 实际=${error.actual}`);
      } else {
        const name = error?.name ?? typeof error;
        const message = error?.message ?? String(error);
        console.log(`FAIL ${scenario.group}/${scenario.name}  期望=场景正常给出结论 实际=${name}: ${message}`);
      }
    }
  }

  console.log("");
  console.log(`结果：通过 ${passed}/${total}`);
  process.exit(passed === total && total > 0 ? 0 : 1);
}

main();
