import moment from "moment";

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
export const formatFirestoreTimestampWithMoment = (timestamp: any) => {
  const firestoreTimestamp = timestamp.toDate();
  const now = moment();
  const momentTimestamp = moment(firestoreTimestamp);
  const hoursAgo = now.diff(momentTimestamp, "hours");

  if (hoursAgo < 1) {
    return momentTimestamp.format("h:mm A") + " Today";
  } else {
    return momentTimestamp.format("h:mm A MMM D, YYYY");
  }
};