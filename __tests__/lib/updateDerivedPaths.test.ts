import { updateDerivedPaths } from "@components/lib/server/updateDerivedPaths";

type NodeDoc = Record<string, any>;

class FakeDocRef {
  constructor(
    public readonly db: FakeFirestore,
    public readonly collectionName: string,
    public readonly id: string,
  ) {}

  async get() {
    const key = `${this.collectionName}/${this.id}`;
    const data = this.db.docs.get(key);
    return {
      exists: Boolean(data),
      id: this.id,
      data: () => (data ? { ...data } : undefined),
    };
  }

  async update(patch: Record<string, any>) {
    this.db.applyUpdate(this.collectionName, this.id, patch);
  }
}

class FakeCollectionRef {
  constructor(
    private readonly db: FakeFirestore,
    private readonly name: string,
  ) {}
  doc(id: string) {
    return new FakeDocRef(this.db, this.name, id);
  }
}

class FakeBatch {
  private updates: Array<{ ref: FakeDocRef; patch: Record<string, any> }> = [];

  update(ref: any, patch: Record<string, any>) {
    this.updates.push({ ref: ref as FakeDocRef, patch });
  }

  async commit() {
    for (const u of this.updates) {
      await u.ref.update(u.patch);
    }
  }
}

class FakeFirestore {
  // key is `${collection}/${id}`
  docs = new Map<string, NodeDoc>();

  collection(name: string) {
    return new FakeCollectionRef(this, name);
  }

  batch() {
    return new FakeBatch();
  }

  // No bulkWriter support in the fake; updateDerivedPaths should fall back to batches.

  seedNode(id: string, data: NodeDoc) {
    this.docs.set(`nodes/${id}`, { ...data });
  }

  readNode(id: string): NodeDoc | undefined {
    return this.docs.get(`nodes/${id}`);
  }

  applyUpdate(collectionName: string, id: string, patch: Record<string, any>) {
    const key = `${collectionName}/${id}`;
    const cur = this.docs.get(key);
    if (!cur) throw new Error(`Missing doc ${key}`);
    this.docs.set(key, { ...cur, ...patch });
  }
}

function genMain(...ids: string[]) {
  return [
    {
      collectionName: "main",
      nodes: ids.map((id) => ({ id })),
    },
  ];
}

describe("updateDerivedPaths", () => {
  it("reparent updates pathIds for node and all descendants", async () => {
    const db = new FakeFirestore();

    // Graph:
    // R
    // ├─ A
    // │  └─ B
    // │     └─ C
    // └─ D
    db.seedNode("R", {
      generalizations: [],
      specializations: genMain("A", "D"),
      parentIds: [],
      primaryParentId: null,
      pathIds: ["R"],
    });
    db.seedNode("A", {
      generalizations: genMain("R"),
      specializations: genMain("B"),
      parentIds: ["R"],
      primaryParentId: "R",
      pathIds: ["R", "A"],
    });
    db.seedNode("D", {
      generalizations: genMain("R"),
      specializations: genMain(),
      parentIds: ["R"],
      primaryParentId: "R",
      pathIds: ["R", "D"],
    });
    db.seedNode("B", {
      generalizations: genMain("A"),
      specializations: genMain("C"),
      parentIds: ["A"],
      primaryParentId: "A",
      pathIds: ["R", "A", "B"],
    });
    db.seedNode("C", {
      generalizations: genMain("B"),
      specializations: genMain(),
      parentIds: ["B"],
      primaryParentId: "B",
      pathIds: ["R", "A", "B", "C"],
    });

    // Reparent B from A → D (only generalizations on B change; the specialization subtree B→C stays).
    db.applyUpdate("nodes", "B", {
      generalizations: genMain("D"),
    });

    const res = await updateDerivedPaths({
      db: db as any,
      changedNodeIds: ["B"],
    });

    expect(res.ok).toBe(true);
    expect(db.readNode("B")?.parentIds).toEqual(["D"]);
    expect(db.readNode("B")?.primaryParentId).toBe("D");
    expect(db.readNode("B")?.pathIds).toEqual(["R", "D", "B"]);
    expect(db.readNode("C")?.pathIds).toEqual(["R", "D", "B", "C"]);
  });

  it("multi-parent keeps stable canonical path (main collection first)", async () => {
    const db = new FakeFirestore();

    db.seedNode("R", {
      generalizations: [],
      specializations: genMain("A", "D"),
      pathIds: ["R"],
    });
    db.seedNode("A", {
      generalizations: genMain("R"),
      specializations: genMain("B"),
      pathIds: ["R", "A"],
    });
    db.seedNode("D", {
      generalizations: genMain("R"),
      specializations: genMain(),
      pathIds: ["R", "D"],
    });

    // B has two parents; "main" collection order is [D, A] so primary should be D.
    db.seedNode("B", {
      generalizations: [
        { collectionName: "main", nodes: [{ id: "D" }, { id: "A" }] },
        { collectionName: "other", nodes: [{ id: "A" }] },
      ],
      specializations: genMain(),
      // Intentionally wrong derived fields; should get corrected.
      parentIds: [],
      primaryParentId: null,
      pathIds: [],
    });

    const res = await updateDerivedPaths({
      db: db as any,
      changedNodeIds: ["B"],
    });

    expect(res.ok).toBe(true);
    expect(db.readNode("B")?.parentIds).toEqual(["D", "A"]);
    expect(db.readNode("B")?.primaryParentId).toBe("D");
    expect(db.readNode("B")?.pathIds).toEqual(["R", "D", "B"]);
  });

  it("rejects changes that would introduce a cycle (parent is a descendant)", async () => {
    const db = new FakeFirestore();

    // R -> A -> B -> C
    db.seedNode("R", {
      generalizations: [],
      specializations: genMain("A"),
      pathIds: ["R"],
    });
    db.seedNode("A", {
      generalizations: genMain("R"),
      specializations: genMain("B"),
      pathIds: ["R", "A"],
    });
    db.seedNode("B", {
      generalizations: genMain("A"),
      specializations: genMain("C"),
      pathIds: ["R", "A", "B"],
    });
    db.seedNode("C", {
      generalizations: genMain("B"),
      specializations: genMain(),
      pathIds: ["R", "A", "B", "C"],
    });

    // Attempt to set B's parent to C (descendant) => would cycle.
    db.applyUpdate("nodes", "B", {
      generalizations: genMain("C"),
    });

    const res = await updateDerivedPaths({
      db: db as any,
      changedNodeIds: ["B"],
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("cycle");
    // Ensure we didn't clobber derived fields on cycle.
    expect(db.readNode("B")?.pathIds).toEqual(["R", "A", "B"]);
  });
});

