// src/components/BlocksEditor/core/find.ts

export type AnyNode = {
  id: string;
  type: string;
  children?: AnyNode[];
  cols?: AnyNode[]; // for "columns"
  [k: string]: any;
};

export type Doc = { root: AnyNode };

export type Found =
  | {
      node: AnyNode;
      parent?: AnyNode;
      // path describes where the node lives, e.g. ["children", 0, "children", 2]
      path: (string | number)[];
    }
  | undefined;

/* ---------------------------------- utils --------------------------------- */

export function walk(
  node: AnyNode | undefined,
  visit: (n: AnyNode, path: (string | number)[], parent?: AnyNode) => void,
  path: (string | number)[] = [],
  parent?: AnyNode
) {
  if (!node) return;
  visit(node, path, parent);
  if (Array.isArray(node.children)) {
    node.children.forEach((c, i) =>
      walk(c, visit, path.concat(["children", i]), node)
    );
  }
  if (node.type === "columns" && Array.isArray(node.cols)) {
    node.cols.forEach((c, i) => walk(c, visit, path.concat(["cols", i]), node));
  }
}

export function getAtPath(root: AnyNode, path: (string | number)[]): any {
  let cur: any = root;
  for (const key of path) {
    if (cur == null) return undefined;
    cur = cur[key as any];
  }
  return cur;
}

export function setAtPath(
  root: AnyNode,
  path: (string | number)[],
  value: any
): AnyNode {
  const clone = structuredClone(root);
  let cur: any = clone;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    cur = cur[k as any];
  }
  cur[path[path.length - 1] as any] = value;
  return clone;
}

/* ------------------------------- find helpers ------------------------------ */

export function findById(root: AnyNode, id: string): Found {
  let out: Found;
  walk(root, (n, path, parent) => {
    if (n.id === id) out = { node: n, parent, path };
  });
  return out!;
}

export function findContainerAndIndex(
  root: AnyNode,
  id: string
):
  | {
      array: AnyNode[];
      index: number;
      containerPath: (string | number)[];
      parent?: AnyNode;
    }
  | undefined {
  let result: any;
  walk(root, (n, path, parent) => {
    if (!parent) return;
    const last = path[path.length - 1];
    const key = path[path.length - 2];
    if (
      typeof last === "number" &&
      (key === "children" || key === "cols") &&
      n.id === id
    ) {
      const container = getAtPath(root, path.slice(0, -1)) as AnyNode[];
      result = {
        array: container,
        index: last,
        containerPath: path.slice(0, -1),
        parent,
      };
    }
  });
  return result;
}

/* --------------------------------- mutate --------------------------------- */

export function replaceNode(root: AnyNode, id: string, next: AnyNode): AnyNode {
  const info = findContainerAndIndex(root, id);
  if (!info) return root;
  const { array, index, containerPath } = info;
  const arr = array.slice();
  arr[index] = next;
  const updated = setAtPath(root, containerPath, arr);
  return updated;
}

export function removeNode(root: AnyNode, id: string): AnyNode {
  const info = findContainerAndIndex(root, id);
  if (!info) return root;
  const { array, index, containerPath } = info;
  const arr = array.slice(0, index).concat(array.slice(index + 1));
  const updated = setAtPath(root, containerPath, arr);
  return updated;
}

export function insertNodeAfter(
  root: AnyNode,
  targetId: string,
  newNode: AnyNode
): AnyNode {
  const info = findContainerAndIndex(root, targetId);
  if (!info) return root;
  const { array, index, containerPath } = info;
  const arr = array
    .slice(0, index + 1)
    .concat([newNode], array.slice(index + 1));
  return setAtPath(root, containerPath, arr);
}

export function appendChild(
  root: AnyNode,
  parentId: string,
  newNode: AnyNode
): AnyNode {
  const found = findById(root, parentId);
  if (!found || !found.node) return root;
  const parent = found.node;
  const key = parent.type === "columns" ? "cols" : "children";
  const arr: AnyNode[] = Array.isArray((parent as any)[key])
    ? (parent as any)[key]
    : [];
  const nextParent = { ...parent, [key]: arr.concat([newNode]) };
  return replaceNode(root, parent.id, nextParent);
}

export function moveNode(
  root: AnyNode,
  srcId: string,
  destParentId: string,
  destIndex?: number
): AnyNode {
  const srcInfo = findContainerAndIndex(root, srcId);
  if (!srcInfo) return root;
  const srcNode = srcInfo.array[srcInfo.index];
  let tmp = removeNode(root, srcId);

  const destFound = findById(tmp, destParentId);
  if (!destFound) return root;
  const parent = destFound.node;
  const key = parent.type === "columns" ? "cols" : "children";

  const existing: AnyNode[] = Array.isArray((parent as any)[key])
    ? (parent as any)[key]
    : [];
  const insertAt = Math.max(
    0,
    Math.min(destIndex ?? existing.length, existing.length)
  );
  const newArr = existing
    .slice(0, insertAt)
    .concat([srcNode], existing.slice(insertAt));
  const nextParent = { ...parent, [key]: newArr };
  tmp = replaceNode(tmp, parent.id, nextParent);
  return tmp;
}
