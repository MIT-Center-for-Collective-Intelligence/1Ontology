export type TreeLikeNode<T> = {
  id: string;
  children?: T[];
};

export function findNode<T extends TreeLikeNode<T>>(
  data: T[],
  id: string,
): T | null {
  for (const node of data) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function removeNode<T extends TreeLikeNode<T>>(data: T[], id: string) {
  for (let i = 0; i < data.length; i++) {
    if (data[i].id === id) {
      data.splice(i, 1);
      return true;
    }
    if (data[i].children && removeNode(data[i].children!, id)) {
      return true;
    }
  }
  return false;
}
