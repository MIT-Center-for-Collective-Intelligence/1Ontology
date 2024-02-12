export const getChildrenIds = (specializations: {
  [key: string]: { title: string; id: string }[];
}) => {
  let children: string[] = [];
  for (let categoryName in specializations) {
    const ids = specializations[categoryName].map((child) => child.id);
    children = [...children, ...ids];
  }
  return children;
};
