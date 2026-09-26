// deepmix —— 深合并库的对外入口。
//
// 对外只导出 deepmix(target, source, options)：把 source 合并进 target 的一份副本。
// 下面是一份完整实现。

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cloneArray(input, memo) {
  const out = [];
  memo.set(input, out);
  for (let i = 0; i < input.length; i += 1) {
    out[i] = cloneValue(input[i], memo);
  }
  return out;
}

function cloneValue(value, memo) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (memo.has(value)) {
    return memo.get(value);
  }
  if (Array.isArray(value)) {
    return cloneArray(value, memo);
  }
  if (value instanceof Map) {
    const out = new Map();
    memo.set(value, out);
    for (const [key, item] of value) {
      out.set(key, cloneValue(item, memo));
    }
    return out;
  }
  if (value instanceof Set) {
    const out = new Set();
    memo.set(value, out);
    for (const item of value) {
      out.add(cloneValue(item, memo));
    }
    return out;
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }
  return buildObject(value, undefined, false, memo);
}

function copyTargetKey(out, target, key, memo) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor === undefined) {
    return;
  }
  if ("value" in descriptor) {
    out[key] = cloneValue(descriptor.value, memo);
  } else {
    Object.defineProperty(out, key, descriptor);
  }
}

function mergeSourceKey(out, target, source, key, concat, memo) {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined) {
    return;
  }
  if (!("value" in descriptor)) {
    Object.defineProperty(out, key, descriptor);
    return;
  }
  const value = descriptor.value;
  if (value === undefined) {
    return;
  }
  let current;
  if (target !== undefined) {
    const currentDescriptor = Object.getOwnPropertyDescriptor(target, key);
    if (currentDescriptor !== undefined && "value" in currentDescriptor) {
      current = currentDescriptor.value;
    }
  }
  if (Array.isArray(value)) {
    if (memo.has(value)) {
      out[key] = memo.get(value);
    } else if (concat && Array.isArray(current)) {
      const merged = memo.has(current) ? memo.get(current) : cloneArray(current, memo);
      memo.set(value, merged);
      for (let i = 0; i < value.length; i += 1) {
        merged.push(cloneValue(value[i], memo));
      }
      out[key] = merged;
    } else {
      out[key] = cloneArray(value, memo);
    }
  } else if (isPlainObject(value)) {
    if (memo.has(value)) {
      out[key] = memo.get(value);
    } else if (isPlainObject(current)) {
      out[key] = buildObject(current, value, concat, memo);
    } else {
      out[key] = buildObject(undefined, value, concat, memo);
    }
  } else {
    out[key] = cloneValue(value, memo);
  }
}

function buildObject(target, source, concat, memo) {
  let out;
  if (target !== undefined && memo.has(target)) {
    out = memo.get(target);
  } else if (source !== undefined && memo.has(source)) {
    out = memo.get(source);
  } else {
    out = {};
  }
  if (target !== undefined && !memo.has(target)) {
    memo.set(target, out);
  }
  if (source !== undefined && !memo.has(source)) {
    memo.set(source, out);
  }
  if (target !== undefined) {
    for (const key of Object.keys(target)) {
      if (!BLOCKED_KEYS.has(key)) {
        copyTargetKey(out, target, key, memo);
      }
    }
  }
  if (source !== undefined) {
    for (const key of Object.keys(source)) {
      if (!BLOCKED_KEYS.has(key)) {
        mergeSourceKey(out, target, source, key, concat, memo);
      }
    }
  }
  return out;
}

export function deepmix(target, source, options = {}) {
  const concat = options !== null && typeof options === "object" && options.concat === true;
  return buildObject(target, source, concat, new WeakMap());
}
