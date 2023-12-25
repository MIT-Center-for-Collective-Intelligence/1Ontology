export const containsHTMLTags = (inputString: string) => {
  const htmlTagsRegex = /<\/?[\w\s="/.'-]+>/;
  return htmlTagsRegex.test(inputString);
};

export const ToUpperCaseEveryWord = (text: string) => {
  return text
    .split(" ")
    .map(cur => cur.charAt(0).toLocaleUpperCase() + cur.slice(1))
    .join(" ");
};
