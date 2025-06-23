# @rbxts/trash

just another janitor clone

```ts
class Balls {
  public destroy(): void {
    print("destroyed balls")
  }
}

const part = Workspace.WaitForChild("Part");
const balls = new Balls;
const trash1 = new Trash;
const trash = trash1.add(new Trash);
trash.add(part); // track items to clean
trash.add(balls);
trash.add(() => print("took out trash")); // called when trash is purged
trash.purge(); // cleans
trash.destroy(); // cleans & renders class useless
trash.removeAll(); //s remove all items without cleaning
```

### All overloads for `Trash.add()`

```ts
public add<Name extends keyof T, T extends { [K in Name]: Callback; }>(obj: T, methodName: Name): T;

public add<T extends RobloxDestroyable>(destroyable: T): T;

public add<T extends CustomDestroyable>(destroyable: T): T;

public add<T extends CustomSignal>(signal: T): T;

public add<T extends BaseSignalConnection>(connection: T): T;

public add<T extends Promise<unknown>>(promise: T): T;

public add(thread: thread): thread;

public add(onCleanup: Callback): void;
```
