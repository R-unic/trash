export interface LinkInstanceOptions {
  readonly allowMultiple?: boolean;
  readonly trackInstance?: boolean;
  readonly completelyDestroy?: boolean;
}

export interface SignalLike<T extends Callback> {
  Once?(callback: T): ConnectionLike;
  Connect(callback: T): ConnectionLike;
  DisconnectAll?(): void;
}

export interface ConnectionLike {
  Disconnect(): void;
}

interface RobloxDestroyable {
  Destroy(): void;
}

interface CustomDestroyable {
  destroy(): void;
}

export type Destroyable = CustomDestroyable | RobloxDestroyable;
export type ImpendingMethodCall = [object: {}, method: Callback];

export type TrashItem = SignalLike<Callback> |
  ConnectionLike |
  Destroyable |
  Tween |
  Promise<unknown> |
  thread |
  Callback |
  ImpendingMethodCall;