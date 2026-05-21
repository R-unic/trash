import { isPromise, purgeItem } from "./utility";
import type { TrashItem, SignalLike, ConnectionLike, Destroyable, LinkInstanceOptions } from "./types";

export class Trash {
  private tracked = new Set<TrashItem>;
  private linkedInstances = new Set<Instance>;
  private __destroyed = false;

  public static is(value: unknown): value is Trash {
    return typeIs(value, "table") && value instanceof Trash;
  }

  public static tryDestroy(trash: Trash): void {
    const { destroy } = trash as { destroy: (t: Trash) => void; };
    const destroyed = Trash.is(trash) && trash.__destroyed;
    if (destroy === undefined || !typeIs(destroy, "function") || destroyed) return;
    destroy(trash);
  }

  /**
   * Creates a trash specifically for the callback function and
   * ensures it is destroyed even if the callback throws an exception.
   *
   * @example
   * const value = Trash.scope(trash => {
   *  trash.add(cleanup1);
   *  trash.add(cleanup2);
   *  someRiskyOperation();
   * });
   */
  public static scope<T>(callback: (trash: Trash) => T): T {
    const scoped = new Trash;
    try {
      return callback(scoped);
    } finally {
      scoped.destroy();
    }
  }

  /**
   * @example
   * const conn = trash.add(signal.Connect(fn)); // ❌
   * const conn = trash.on(signal, fn); // ✅
   */
  public on<T extends Callback>(signal: SignalLike<T>, fn: T): ConnectionLike {
    return this.add(signal.Connect(fn));
  }

  /**
   * @example
   * const conn = trash.add(signal.Once(fn)); // ❌
   * const conn = trash.once(signal, fn); // ✅
   */
  public once<T extends (...args: unknown[]) => unknown>(signal: SignalLike<T>, fn: T): ConnectionLike {
    if (signal.Once && typeIs(signal.Once, "function")) {
      return this.add(signal.Once(fn));
    }

    const conn = this.on(signal, ((...args) => {
      fn(...args);
      conn.Disconnect();
    }) as T);

    return conn;
  }

  /**
   * @example
   * const extended = trash.add(new Trash); // ❌
   * const extended = trash.extend(); // ✅
   */
  public extend(): Trash {
    return this.add(new Trash);
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
  public add<T extends Destroyable>(destroyable: T): T;
  public add<T extends SignalLike<Callback>>(signal: T): T;
  public add<T extends ConnectionLike>(connection: T): T;
  public add<T extends Promise<unknown>>(promise: T): T;
  public add(thread: thread): thread;
  public add(onCleanup: Callback): void;
  public add<T extends TrashItem>(item: T, methodName?: keyof T): T | void {
    this.tracked.add(
      methodName === undefined
        ? item
        : [item, item[methodName] as Callback]
    );

    if (typeIs(item, "function")) return;
    if (isPromise(item)) {
      const { cancel } = (item as { cancel: Callback; });
      return item.finally(() => this.remove(cancel, true)) as T;
    }

    return item;
  }

  public linkToInstance(
    instance: Instance,
    {
      allowMultiple = false,
      trackInstance = true,
      completelyDestroy = true
    }: LinkInstanceOptions = {}
  ): void {
    if (trackInstance)
      this.add(instance);

    if (!allowMultiple && this.linkedInstances.size() > 0)
      throw "[@rbxts/trash]: Trash class is already linked to another instance, and multiple instance links were disallowed";

    this.linkedInstances.add(instance);
    this.once(instance.Destroying, () => completelyDestroy ? Trash.tryDestroy(this) : this.purge());
  }

  /** Removes all tracked items and signals */
  public purge(): void {
    this.tracked.forEach(purgeItem);
    this.removeAll();
  }

  /** Clears tracked items without invoking their cleanup methods */
  public removeAll(removeLinks = true): void {
    this.tracked = new Set;
    if (removeLinks)
      this.linkedInstances = new Set;
  }

  /** Clears an individual tracked item, optionally cleaning it up */
  public remove(item: TrashItem, cleanup = false, removeLink = true): void {
    this.tracked.delete(item);
    if (removeLink && typeIs(item, "Instance"))
      this.linkedInstances.delete(item);
    if (cleanup)
      purgeItem(item);
  }

  /**
   * Purges all tracked items then clears all fields, except `__destroyed`, and sets `__destroyed` to `true`.
   * Subsequently removes the metatable of the object so that it can be garbage collected.
   */
  public destroy(): void {
    this.purge();
    setmetatable(this, undefined);
    this.__destroyed = true;
    this.tracked = undefined!;
    this.linkedInstances = undefined!;
  }
}