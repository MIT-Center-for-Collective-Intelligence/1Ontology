import withAuthUser from "@components/components/hoc/withAuthUser";
import TitleModelComparison, {
  TitleModelComparisonData,
} from "@components/components/SomReview/TitleModelComparison";
import { buildTitleModelComparison } from "@components/lib/somReview/titleModelComparison";
import fs from "fs";
import path from "path";

export const TitleModelComparisonPage = ({
  comparison,
}: {
  comparison: TitleModelComparisonData;
}) => <TitleModelComparison data={comparison} />;

// Runs only at build time. A misaligned archive throws, so the build fails
// rather than showing a proposal next to the wrong evidence or judgment.
export function getStaticProps() {
  const testbed = path.join(
    process.cwd(),
    "Ontology_Title_Clarity_Testbed_2026-08-28",
  );
  const readJson = (file: string) =>
    JSON.parse(fs.readFileSync(path.join(testbed, file), "utf8"));
  return {
    props: {
      comparison: buildTitleModelComparison(
        readJson("model-comparison-2026-09-16/comparison.json"),
        readJson("model-comparison-2026-09-16/judge-results.json"),
        readJson("prompt-study-2026-09-14/bundle.json"),
      ),
    },
  };
}

export default withAuthUser({
  shouldRedirectToLogin: true,
  shouldRedirectToHomeIfAuthenticated: false,
})(TitleModelComparisonPage);
