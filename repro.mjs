// repro.mjs —— 调用方给的最小复现，别改。
//
// 调用方的原话是「线上流量翻倍之后，合并结果里有些字段不见了」：
// 上层的 patch 里带了值为 undefined 的键，合并之后 cfg 里原本有值的字段被清空。

import { deepmix } from "./index.js";

const cfg = {
  host: "db.internal",
  port: 5432,
  tls: true,
};

const patch = {
  host: undefined, // 上游「没下发」，但键在
  port: 6543,
};

const merged = deepmix(cfg, patch);

console.log("合并结果:", JSON.stringify(merged));
console.log("host 有值:", Object.prototype.hasOwnProperty.call(merged, "host") && merged.host !== undefined);

if (merged.host === undefined) {
  console.log("字段丢失：host 被 patch 里的 undefined 清空了");
  process.exit(1);
}
console.log("字段正常");
process.exit(0);
