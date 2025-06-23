import { t } from "@rbxts/t";

interface CustomSignal {
  DisconnectAll(): void
}

interface BaseSignalConnection {
  Disconnect(): void;
}

interface RobloxDestroyable {
  Destroy(): void;
}

interface CustomDestroyable {
  destroy(): void;
}

type ImpendingMethodCall = [object: {}, method: Callback];

export type TrashItem =
  | CustomSignal
  | BaseSignalConnection
  | RobloxDestroyable
  | CustomDestroyable
  | Tween
  | Promise<unknown>
  | thread
  | Callback
  | ImpendingMethodCall;

interface LinkInstanceOptions {
  readonly allowMultiple?: boolean;
  readonly trackInstance?: boolean;
  readonly completelyDestroy?: boolean;
}

const { defer, cancel: cancelThread } = task;
const fastDestroy = game.Destroy as (instance: Instance) => void;

const isConnection = t.interface({
  Disconnect: t.callback,
});
const isRbxDestroyable = t.interface({
  Destroy: t.callback,
});
const isCustomDestroyable = t.interface({
  destroy: t.callback,
});
const isCustomSignal = t.interface({
  DisconnectAll: t.callback,
});
const isPromise = t.interface({
  cancel: t.callback,
  then: t.callback,
  catch: t.callback
}) as t.check<Promise<unknown>>;
const isImpendingMethodCall = t.strictArray(t.table, t.callback) as t.check<ImpendingMethodCall>;

export class Trash {
  private tracked: TrashItem[];
  private linkedInstances = new Set<Instance>;

  public static is(value: unknown): value is Trash {
    return typeIs(value, "table") && value instanceof Trash;
  }

  /**
   * Constructs a new Trash instance.
   *
   * @param preallocationAmount - Optional number of items to preallocate in the tracked array.
   *                              If provided, the tracked array is initialized with the specified
   *                              length; otherwise, it defaults to an empty array.
   */
  public constructor(preallocationAmount?: number) {
    this.tracked = preallocationAmount
      ? new Array(preallocationAmount)
      : [];
  }

  /**
   * Adds an item to be tracked.
   *
   * If a `methodName` is provided, the item is expected to be a table
   * that contains a non-static method with that name. When the item should be
   * destroyed, the method will be called with the item as the sole
   * argument (to fill in `self`).
   *
   * @returns The item itself.
   */
  public add<Name extends keyof T, T extends { [K in Name]: Callback; }>(obj: T, methodName: Name): T;
  public add<T extends RobloxDestroyable>(destroyable: T): T;
  public add<T extends CustomDestroyable>(destroyable: T): T;
  public add<T extends CustomSignal>(signal: T): T;
  public add<T extends BaseSignalConnection>(connection: T): T;
  public add<T extends Promise<unknown>>(promise: T): T;
  public add(thread: thread): thread;
  public add(onCleanup: Callback): void;
  public add<T extends TrashItem>(item: T, methodName?: keyof T): T | void {
    this.tracked.push(
      methodName === undefined
        ? item
        : [item, item[methodName] as Callback]
    );

    return typeIs(item, "function") ? undefined : item;
  }

  public linkToInstance(instance: Instance, { allowMultiple = false, trackInstance = true, completelyDestroy = true }: LinkInstanceOptions = {}): void {
    if (trackInstance)
      this.add(instance);

    if (!allowMultiple && this.linkedInstances.size() > 0)
      throw "[@rbxts/trash]: Trash class is already linked to another instance, and multiple instance links were disallowed";

    this.linkedInstances.add(instance);
    this.add(instance.Destroying.Once(() => completelyDestroy ? this.destroy() : this.purge()));
  }

  /** Removes all tracked items and signals */
  public purge(): void {
    for (const item of this.tracked) {
      if (typeIs(item, "Instance")) {
        if (item.IsA("Tween"))
          item.Cancel();
        else
          fastDestroy(item as never);

        continue;
      }

      if (typeIs(item, "RBXScriptConnection") || isConnection(item)) {
        item.Disconnect();
        continue;
      }

      if (isCustomDestroyable(item)) {
        const { destroy } = (item as { destroy: (item: unknown) => void });
        destroy(item);
        continue;
      }

      if (isRbxDestroyable(item)) {
        const destroy = (item as { Destroy: (item: unknown) => void }).Destroy;
        destroy(item);
        continue;
      }

      if (isCustomSignal(item)) {
        const disconnectAll = (item as { DisconnectAll: (item: unknown) => void }).DisconnectAll;
        disconnectAll(item);
        continue;
      }

      if (isImpendingMethodCall(item)) {
        const [obj, method] = item;
        method(obj);
        continue;
      }

      if (isPromise(item)) {
        const { cancel } = (item as { cancel: (item: unknown) => void });
        cancel(item);
        continue;
      }

      if (typeIs(item, "thread")) {
        let wasCanceled = false;
        if (coroutine.running() !== item)
          [wasCanceled] = pcall(() => cancelThread(item));

        if (!wasCanceled)
          defer(() => cancelThread(item));

        continue;
      }

      item();
    }
    this.removeAll();
  }

  /** Clears tracked items without invoking their cleanup methods  */
  public removeAll(): void {
    this.tracked = [];
  }

  /**
   * Purges all tracked items then clears the list of tracked items
   * and removes the metatable of the object so that it can be garbage collected.
   */
  public destroy(): void {
    this.purge();
    setmetatable(this, undefined);
  }
}