import assert from "node:assert/strict";
import test from "node:test";

import { repairDocuments } from "./repair-collection-node-conflation.mjs";

const appId = "final-hierarchy-with-o*net-rob-structure-applied-2026-07-25";
const ids = {
  sell: "9c347b3345120c1df2554b834c13",
  ownership: "2dfe6a4a3194a23d73d3681eb844",
  temporaryUse: "bc3a0d85a3dcd1e3ea729857acc3",
  rentOut: "df319ef0372ddc12e45ccbd4b4b0",
};
const link = (id, title) => ({ id, title });
const node = (id, title, overrides = {}) => ({
  id,
  appName: appId,
  title,
  deleted: false,
  generalizations: [],
  specializations: [],
  parentIds: [],
  primaryParentId: "",
  pathIds: [id],
  root: false,
  ...overrides,
});

const fixture = () =>
  new Map([
    [
      ids.sell,
      node(ids.sell, "Sell", {
        root: true,
        specializations: [
          { collectionName: "main", nodes: [] },
          {
            collectionName: "Sell what kind of usage?",
            nodes: [
              link(ids.ownership, "Sell ownership"),
              link(ids.temporaryUse, "Sell temporary use"),
            ],
          },
        ],
      }),
    ],
    [
      ids.ownership,
      node(ids.ownership, "Sell ownership", {
        generalizations: [
          { collectionName: "main", nodes: [link(ids.sell, "Sell")] },
        ],
        parentIds: [ids.sell],
        primaryParentId: ids.sell,
      }),
    ],
    [
      ids.temporaryUse,
      node(ids.temporaryUse, "Sell temporary use", {
        generalizations: [
          { collectionName: "main", nodes: [link(ids.sell, "Sell")] },
        ],
        specializations: [
          { collectionName: "main", nodes: [link(ids.rentOut, "Rent out")] },
        ],
        parentIds: [ids.sell],
        primaryParentId: ids.sell,
      }),
    ],
    [
      ids.rentOut,
      node(ids.rentOut, "Rent out", {
        generalizations: [
          {
            collectionName: "main",
            nodes: [link(ids.temporaryUse, "Sell temporary use")],
          },
        ],
        parentIds: [ids.temporaryUse],
        primaryParentId: ids.temporaryUse,
      }),
    ],
  ]);

test("retires synthetic collection nodes and restores the existing activity", () => {
  const repaired = repairDocuments(fixture(), appId);
  const sell = repaired.get(ids.sell);
  const ownership = repaired.get(ids.ownership);
  const temporaryUse = repaired.get(ids.temporaryUse);
  const rentOut = repaired.get(ids.rentOut);

  assert.equal(ownership.deleted, true);
  assert.equal(temporaryUse.deleted, true);
  assert.deepEqual(
    sell.specializations.find(
      (collection) => collection.collectionName === "main",
    ).nodes,
    [link(ids.rentOut, "Rent out")],
  );
  assert.equal(
    sell.specializations.some(
      (collection) => collection.collectionName === "Sell what kind of usage?",
    ),
    false,
  );
  assert.deepEqual(rentOut.parentIds, [ids.sell]);
  assert.equal(rentOut.primaryParentId, ids.sell);
  assert.deepEqual(rentOut.generalizations[0].nodes, [link(ids.sell, "Sell")]);
});

test("is idempotent after the correction", () => {
  const repaired = repairDocuments(fixture(), appId);
  assert.deepEqual(repairDocuments(repaired, appId), repaired);
});
