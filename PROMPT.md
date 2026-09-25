线上流量翻倍之后，deepmix 的合并结果开始出现字段丢失。这是 Node.js 22 的深合并库，
ESM，只用 node: 内置模块，无 package.json 依赖。
README「对外保证」一节列了 8 条；index.js 是完整实现；test/deepmix.test.mjs 里 13 个用例当前全绿，
repro.mjs 是调用方给的最小复现，跑一下能看到与他描述一致的结果。

任务：修掉实现里违反那 8 条保证的地方。

验收（check/ 是固定验收程序，别改）：
- bash scripts/check.sh 退出码 0，10 个场景全过（merge 3 + purity 2 + cycles 2 + safety 3）；
- node --test test/ 全绿。

约束：
1. 不改 check/、不改 repro.mjs，不改 test/ 里既有用例的断言；导出的函数签名不变。
2. 只用 node: 内置模块；check/ 必须单进程跑通（不许用 child_process / worker_threads / 网络）。
3. 判据是返回值与入参的深比较，不含时间、随机数与文件系统。
