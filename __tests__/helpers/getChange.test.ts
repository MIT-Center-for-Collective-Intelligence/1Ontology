import { getChangeDescription } from " @components/lib/utils/helpers";

describe("getChangeDescription", () => {
  const modifiedByFullName = "John Doe";

  it('should return description for "change text"', () => {
    const log: any = {
      nodeId: "jklhsdfjkdsyrlksgf",
      modifiedBy: "user1",
      modifiedProperty: "title",
      previousValue: "Old Title",
      newValue: "New Title",
      changeType: "change text",
      modifiedAt: new Date(),
      fullNode: null,
    };
    const description = getChangeDescription(log, modifiedByFullName);
    expect(description).toBe('Updated "title" in:');
  });

  it('should return description for "add collection"', () => {
    const log: any = {
      nodeId: "jklhsdfjkdsyrlksgf",
      modifiedBy: "user1",
      modifiedProperty: "collection",
      changeType: "add collection",
      modifiedAt: new Date(),
      fullNode: null,
    };
    const description = getChangeDescription(log, modifiedByFullName);
    expect(description).toBe("Added a new collection in:");
  });

  it('should return description for "delete collection"', () => {
    const log: any = {
      nodeId: "jklhsdfjkdsyrlksgf",
      modifiedBy: "user1",
      modifiedProperty: "collection",
      changeType: "delete collection",
      modifiedAt: new Date(),
      fullNode: null,
    };
    const description = getChangeDescription(log, modifiedByFullName);
    expect(description).toBe("Deleted a collection in:");
  });

  it('should return description for "add element" with specialization', () => {
    const log: any = {
      nodeId: "jklhsdfjkdsyrlksgf",
      modifiedBy: "user1",
      modifiedProperty: "specializations",
      changeType: "add element",
      modifiedAt: new Date(),
      fullNode: null,
    };
    const description = getChangeDescription(log, modifiedByFullName);
    expect(description).toBe("Added a new Specialization Under:");
  });

  it('should return description for "add element" with generalization', () => {
    const log: any = {
      nodeId: "jklhsdfjkdsyrlksgf",
      modifiedBy: "user1",
      modifiedProperty: "generalizations",
      changeType: "add element",
      modifiedAt: new Date(),
      fullNode: null,
    };
    const description = getChangeDescription(log, modifiedByFullName);
    expect(description).toBe("Added a new Generalization Under:");
  });

  it('should return description for "add node"', () => {
    const log: any = {
      nodeId: "jklhsdfjkdsyrlksgf",
      modifiedBy: "user1",
      modifiedProperty: "title",
      changeType: "add node",
      modifiedAt: new Date(),
      fullNode: null,
    };
    const description = getChangeDescription(log, modifiedByFullName);
    expect(description).toBe("Added a new node titled:");
  });

  it('should return description for "remove property"', () => {
    const log: any = {
      nodeId: "jklhsdfjkdsyrlksgf",
      modifiedBy: "user1",
      modifiedProperty: "description",
      changeType: "remove property",
      modifiedAt: new Date(),
      fullNode: null,
    };
    const description = getChangeDescription(log, modifiedByFullName);
    expect(description).toBe('Removed "description" in:');
  });

  it('should return description for "modify elements"', () => {
    const log: any = {
      nodeId: "jklhsdfjkdsyrlksgf",
      modifiedBy: "user1",
      modifiedProperty: "elements",
      changeType: "modify elements",
      modifiedAt: new Date(),
      fullNode: null,
    };
    const description = getChangeDescription(log, modifiedByFullName);
    expect(description).toBe("Modified the elements in:");
  });

  it("should return description for an unknown change type", () => {
    const log: any = {
      nodeId: "jklhsdfjkdsyrlksgf",
      modifiedBy: "user1",
      modifiedProperty: "unknown",
      changeType: "unknown type",
      modifiedAt: new Date(),
      fullNode: null,
    };
    const description = getChangeDescription(log, modifiedByFullName);
    expect(description).toBe("Made an unknown change to:");
  });

  it('should return description for "add property"', () => {
    const log: any = {
      nodeId: "jklhsdfjkdsyrlksgf",
      modifiedBy: "user1",
      modifiedProperty: "description",
      changeType: "add property",
      modifiedAt: new Date(),
      fullNode: null,
      changeDetails: { addedProperty: "newProperty" },
    };
    const description = getChangeDescription(log, modifiedByFullName);
    expect(description).toBe('Added "newProperty" in:');
  });
});
