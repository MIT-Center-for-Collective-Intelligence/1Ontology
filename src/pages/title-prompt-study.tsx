import withAuthUser from "@components/components/hoc/withAuthUser";
import TitlePromptStudy, {
  TitlePromptStudyData,
} from "@components/components/SomReview/TitlePromptStudy";
import data from "../../Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-13/bundle.json";
import latestData from "../../Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-14/bundle.json";
import {
  compareTitlePromptResults,
  alignAdditionalTitleStudy,
} from "@components/lib/somReview/titlePromptComparison";
import fs from "fs";
import path from "path";

export const TitlePromptStudyPage = ({
  study,
  latestStudy,
}: {
  study: TitlePromptStudyData;
  latestStudy?: TitlePromptStudyData;
}) => <TitlePromptStudy data={study} latestData={latestStudy} />;

export function getStaticProps() {
  const directory = path.join(
    process.cwd(),
    "Ontology_Title_Clarity_Testbed_2026-08-28/review-datasets-v6",
  );
  const records = ["all_proposals.jsonl", "all_controls.jsonl"].flatMap(
    (file) =>
      fs
        .readFileSync(path.join(directory, file), "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
  );
  return {
    props: {
      study: compareTitlePromptResults(data as TitlePromptStudyData, records),
      latestStudy: alignAdditionalTitleStudy(
        data as TitlePromptStudyData,
        latestData as TitlePromptStudyData,
      ),
    },
  };
}

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(TitlePromptStudyPage);
