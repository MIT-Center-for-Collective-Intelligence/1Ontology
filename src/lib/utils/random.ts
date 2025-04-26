import { INode } from "@components/types/INode";
import { query, collection, where, getDocs } from "firebase/firestore";
import { NODES } from "../firestoreClient/collections";

export const handleDownload = async ({ user, db }: { user: any; db: any }) => {
  // try {
  const nodesCollection = query(
    collection(db, NODES),
    where("deleted", "==", false),
    where("root", "==", "hn9pGQNxmQe9Xod5MuKK")
  );
  const querySnapshot = await getDocs(nodesCollection);
  let i = 0;
  const data = querySnapshot.docs.map((doc) =>
    getStructureForJSON({
      ...doc.data(),
    } as INode)
  );

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "nodes-data.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // } catch (error) {
  //   console.error("Error downloading JSON: ", error);
  // }
};

const getStructureForJSON = (data: INode) => {
  const getTitles = (property: any) => {
    return Object.values(property)
      .flat()
      .map((prop: any) => prop.title);
  };

  const { properties } = data;
  for (let property in properties) {
    if (typeof properties[property] !== "string") {
      properties[property] = getTitles(properties[property]);
    }
  }
  return {
    title: data.title,
    generalizations: getTitles(data.generalizations),
    specializations: getTitles(data.specializations),
    parts: [],
    isPartOf: [],
    // ...properties,
  };
};
