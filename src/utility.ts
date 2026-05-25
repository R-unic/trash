import { t } from "@rbxts/t";

import type { Trash } from ".";
import type { ImpendingMethodCall, TrashItem } from "./types";

const { defer, cancel: cancelThread } = task;
const fastDestroy = game.Destroy as (instance: Instance) => void;

const isImpendingMethodCall = t.strictArray(t.union(t.table, t.Instance), t.callback) as t.check<ImpendingMethodCall>;
const isConnection = t.interface({ Disconnect: t.callback });
const isRbxDestroyable = t.interface({ Destroy: t.callback });
const isCustomDestroyable = t.interface({ destroy: t.callback });
const isCustomSignal = t.interface({ DisconnectAll: t.callback });

export const isPromise = t.interface({
  cancel: t.callback,
  then: t.callback,
  catch: t.callback
}) as t.check<Promise<unknown>>;

export function isTrash(value: unknown): value is Trash {
  return typeIs(value, "table") && "__destroyed" in value && "destroy" in value;
}

export function tryDestroy(trash: Trash): void {
  if (!isTrash(trash)) return;
  const { destroy, __destroyed } = trash as unknown as { destroy: (t: Trash) => void, __destroyed: boolean; };
  if (destroy === undefined || !typeIs(destroy, "function") || __destroyed) return;
  destroy(trash);
}

export function purgeItem(item: TrashItem): void {
  if (typeIs(item, "Instance")) {
    return item.IsA("Tween") ? item.Cancel() : fastDestroy(item);
  }
  if (typeIs(item, "RBXScriptConnection") || isConnection(item)) {
    return item.Disconnect();
  }
  if (isCustomDestroyable(item) || isTrash(item)) {
    return tryDestroy(item as Trash);
  }
  if (isRbxDestroyable(item)) {
    const destroy = (item as { Destroy: (item: unknown) => void; }).Destroy;
    return destroy(item);
  }
  if (isCustomSignal(item)) {
    const disconnectAll = (item as { DisconnectAll: (item: unknown) => void; }).DisconnectAll;
    return disconnectAll(item);
  }
  if (isImpendingMethodCall(item)) {
    const [obj, method] = item;
    return method(obj);
  }
  if (isPromise(item)) {
    const { cancel } = (item as { cancel: (item: unknown) => void; });
    return cancel(item);
  }
  if (typeIs(item, "thread")) {
    let wasCanceled = false;
    if (coroutine.running() !== item)
      [wasCanceled] = pcall(() => cancelThread(item));

    if (!wasCanceled)
      defer(() => cancelThread(item));

    return;
  }
  if (!typeIs(item, "function")) {
    const unknownItem = item as unknown;
    const isDestroyedTrash = typeIs(unknownItem, "table")
      && "__destroyed" in unknownItem
      && unknownItem.__destroyed === true;

    if (isDestroyedTrash) return;

    return warn("[@rbxts/trash]: Invalid trash item:", item);
  }

  item();
}