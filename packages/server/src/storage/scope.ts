import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";

const als = new AsyncLocalStorage<{ userId: string }>();
const SAFE = /^[\w-]{1,64}$/;

/** 在指定用户的存储作用域内执行；userId 非法或为空时不切换（保持现有行为）。 */
export function runInStorageScope<T>(userId: string | undefined, fn: () => T): T {
    const id = (userId ?? "").trim();
    if (!SAFE.test(id)) return fn();
    return als.run({ userId: id }, () => fn());
}

/** 当前作用域的用户 ID；不在作用域内时返回 undefined。 */
export function currentStorageUser(): string | undefined {
    return als.getStore()?.userId;
}

/** 当前请求的数据根目录。 */
export function scopeDirectory(base: string): string {
    const store = als.getStore();
    return store ? path.join(base, store.userId) : base;
}
