# deepmix —— 深合并

把 `source` 深合并进 `target`，返回一个**新的普通对象**：两边都有的对象键递归合并，
其余按「source 覆盖 target」处理。用于配置合并、补丁应用这类「基线与覆盖层叠在一起」的场景。

`index.js` 是完整实现，`test/deepmix.test.mjs` 是既有用例，`check/check.mjs` 是固定验收入口，
`repro.mjs` 是调用方给的复现脚本。零第三方依赖：只用 `node:` 内置模块。

```js
import { deepmix } from "./index.js";

deepmix({ a: 1, n: { x: 1 } }, { n: { y: 2 } });          // { a: 1, n: { x: 1, y: 2 } }
deepmix({ list: [1, 2] }, { list: [9] });                  // { list: [9] }
deepmix({ list: [1, 2] }, { list: [9] }, { concat: true }); // { list: [1, 2, 9] }
```

## 接口

```
deepmix(target, source, options = {}) -> object
```

| 参数 | 说明 |
| --- | --- |
| `target` | 基线对象（普通对象） |
| `source` | 覆盖层对象（普通对象） |
| `options.concat` | `true` 时数组改为拼接；缺省 / `false` 时数组整体替换 |

函数名与签名属于对外契约，不要改。

## 对外保证（8 条）

下面每一条都是对外保证。**验收以 `check/check.mjs` 为准**，语义细节以本节为准。

1. **对象递归合并；数组默认整体替换**。两边的键都是普通对象时递归合并；数组**不做逐项合并**，
   默认用 `source` 的数组整体替换。传 `options.concat === true` 时，两边都是数组的键改为
   `target 的数组 + source 的数组` 的拼接结果。
2. **`null` 是普通值，`undefined` 不覆盖**。`source` 里值为 `null` 的键按普通值覆盖 `target`；
   值为 `undefined` 的键**一律忽略** —— 既不覆盖 `target` 已有的值，也不在结果上新增这个键。
3. **不改动任何入参**。调用前后，`target` 与 `source`（包括它们嵌套的子对象与数组）
   必须逐字段完全一致。结果里的嵌套对象/数组都是新对象，不复用入参里的可变对象。
4. **支持循环引用**。输入里存在自引用或互相引用时，不得栈溢出、不得无限复制；
   结果必须**保留引用图**（`x` 自引用时结果里对应位置指回结果自身）。
5. **原型污染防护**。`__proto__` / `constructor` / `prototype` 这几个键不得写入结果，
   也不得以任何方式改动结果或全局对象的原型链；调用后 `({}).polluted === undefined`
   必须成立，且 `Object.getPrototypeOf(结果) === Object.prototype`。
6. **只复制自有可枚举属性；getter 不求值**。只处理 `source` 的**自有**可枚举字符串键，
   继承而来的可枚举属性不得带进结果。遇到访问器属性（getter）时，合并过程中**不得调用它**；
   按属性描述符原样复制（数据属性取其 `value`）。
7. **`Map` / `Set` 整体替换**。`source` 里值为 `Map` 或 `Set` 的键按整体替换处理，
   不做逐项合并。
8. **结果是普通对象**。返回值必须是普通对象（`Object.getPrototypeOf(result) === Object.prototype`），
   不是 `target` 本身，也不是 `source` 本身。

## 怎么跑

```bash
node --test                        # 既有用例（13 个），不带路径时自动发现 test/ 下的用例
node --test test/deepmix.test.mjs   # 只跑单个用例文件
node check/check.mjs               # 固定验收程序（10 个场景）
node check/check.mjs -list         # 列出全部场景
node check/check.mjs --only safety # 只跑一组（merge / purity / cycles / safety）
bash scripts/check.sh              # 固定件入口的薄封装
node repro.mjs                     # 调用方给的复现
```

`node --test` 全绿退出码 0，否则 1。
（个别 Node 构建不会把**目录参数**展开成用例列表，此时用不带路径的 `node --test`。）

> ⚠️ **勿改**：`check/check.mjs` 是固定验收程序；`repro.mjs` 是调用方给的复现；
> `test/deepmix.test.mjs` 里既有用例的断言。导出的函数签名也不要改。

起点状态：`node --test` 13/13 全绿；`node check/check.mjs` 打印 `结果：通过 3/10` 并以退出码 1 结束。

## 约定与边界

- **纯函数**：不做 I/O、不读文件系统、不访问网络、不改入参、无模块级可变状态。
  同一输入必须给出同一输出（不依赖随机源、时间或迭代顺序）。
- **只用 `node:` 内置模块**；`package.json` 不许出现 `dependencies`。
- `check/` 必须**单进程**跑通：固定件里不用 `child_process` / `worker_threads` / 网络。
- 不连数据库、不起中间件。

## 目录

```
.
├── package.json            ESM，无依赖
├── README.md               本文件
├── .gitignore
├── .gitattributes
├── PROMPT.md               需求原文
├── index.js                对外导出与实现
├── repro.mjs               调用方给的最小复现（勿改）
├── test/deepmix.test.mjs   既有用例（13 个，勿改断言）
├── check/check.mjs         固定验收程序（勿改）
└── scripts/check.sh        固定件入口的薄封装
```
