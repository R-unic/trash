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
