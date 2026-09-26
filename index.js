// deepmix —— 深合并库的对外入口。
//
// 对外只导出 deepmix(target, source, options)：把 source 合并进 target 的一份副本。
// 下面是一份完整实现。
//
// 实现要点（对应 README「对外保证」）：
// - 纯函数：不改任何入参，结果里的嵌套对象/数组都是新建对象；
// - 用 WeakMap 记录「入参对象 -> 结果对象」的映射，循环引用闭合成环、不栈溢出；
// - 只处理自有可枚举字符串键（Object.keys + 属性描述符），getter 原样复制、不求值；
// - __proto__ / constructor / prototype 三个键一律不写入结果；
// - source 里值为 undefined 的键一律忽略；null 按普通值覆盖；
// - 数组默认整体替换，options.concat === true 时拼接；Map / Set 整体替换（拷贝为新实例）。

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isBlockedKey(key) {
  return BLOCKED_KEYS.has(key);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  if (value instanceof Map || value instanceof Set) {
    return false;
  }
  return true;
}

// 取 obj 上自有数据属性的 value；访问器属性不求值，按「无基线值」处理。
function ownDataValue(obj, key) {
  if (!isPlainObject(obj)) {
    return undefined;
  }
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  if (desc !== undefined && "value" in desc) {
    return desc.value;
  }
  return undefined;
}

// 深拷贝 value：普通对象与数组新建并递归拷贝，Map / Set 拷贝为新实例，
// 其余（标量、null、类实例等）按原值带出。seen 保证循环引用闭合成环。
function cloneValue(value, seen) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return seen.get(value);
  }
  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    for (let i = 0; i < value.length; i += 1) {
      out[i] = cloneValue(value[i], seen);
    }
    return out;
  }
  if (value instanceof Map) {
    return new Map(value);
  }
  if (value instanceof Set) {
    return new Set(value);
  }
  if (isPlainObject(value)) {
    const out = {};
    seen.set(value, out);
    copyOwnEnumerable(value, out, seen);
    return out;
  }
  return value;
}

// 把 from 的自有可枚举字符串键拷贝到 to：数据属性深拷贝 value，
// 访问器属性按描述符原样复制（不调用 getter）。
function copyOwnEnumerable(from, to, seen) {
  for (const key of Object.keys(from)) {
    if (isBlockedKey(key)) {
      continue;
    }
    const desc = Object.getOwnPropertyDescriptor(from, key);
    if ("value" in desc) {
      to[key] = cloneValue(desc.value, seen);
    } else {
      Object.defineProperty(to, key, desc);
    }
  }
}

// 单个键的合并：返回该键在结果里的值。
function mergeValue(base, value, concat, seen) {
  if (Array.isArray(value)) {
    if (concat && Array.isArray(base)) {
      if (seen.has(value)) {
        return seen.get(value);
      }
      const out = [];
      seen.set(value, out);
      for (const item of base) {
        out.push(cloneValue(item, seen));
      }
      for (const item of value) {
        out.push(cloneValue(item, seen));
      }
      return out;
    }
    return cloneValue(value, seen);
  }
  if (isPlainObject(value)) {
    return mergeObjects(isPlainObject(base) ? base : {}, value, concat, seen);
  }
  if (value instanceof Map) {
    return new Map(value);
  }
  if (value instanceof Set) {
    return new Set(value);
  }
  return value;
}

// 普通对象递归合并：target 的键先深拷贝进来，再按 source 覆盖 / 递归。
function mergeObjects(target, source, concat, seen) {
  if (seen.has(source)) {
    return seen.get(source);
  }
  const out = {};
  seen.set(source, out);

  copyOwnEnumerable(target, out, seen);

  for (const key of Object.keys(source)) {
    if (isBlockedKey(key)) {
      continue;
    }
    const desc = Object.getOwnPropertyDescriptor(source, key);
    if (!("value" in desc)) {
      Object.defineProperty(out, key, desc);
      continue;
    }
    const value = desc.value;
    if (value === undefined) {
      continue;
    }
    out[key] = mergeValue(ownDataValue(target, key), value, concat, seen);
  }
  return out;
}

export function deepmix(target, source, options = {}) {
  const concat = options !== null && typeof options === "object" && options.concat === true;
  const base = isPlainObject(target) ? target : {};
  const from = isPlainObject(source) ? source : {};
  return mergeObjects(base, from, concat, new WeakMap());
}
