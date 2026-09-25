// deepmix —— 深合并库的对外入口。
//
// 对外只导出 deepmix(target, source, options)：把 source 合并进 target 的一份副本。
// 下面是一份完整实现。

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

function mergeArray(base, from) {
  const out = Array.isArray(base) ? base.slice() : [];
  for (let i = 0; i < from.length; i += 1) {
    out[i] = from[i];
  }
  return out;
}

function merge(base, from, concat) {
  for (const key in from) {
    const value = from[key];
    const current = base[key];

    if (Array.isArray(value)) {
      if (concat && Array.isArray(current)) {
        base[key] = current.concat(value);
      } else {
        base[key] = mergeArray(current, value);
      }
    } else if (isPlainObject(value)) {
      base[key] = merge(isPlainObject(current) ? current : {}, value, concat);
    } else {
      base[key] = value;
    }
  }
  return base;
}

export function deepmix(target, source, options = {}) {
  const concat = options !== null && typeof options === "object" && options.concat === true;
  const out = { ...target };
  return merge(out, source, concat);
}
