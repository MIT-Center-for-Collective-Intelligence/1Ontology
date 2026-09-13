import withAuthUser from "@components/components/hoc/withAuthUser";
import TitlePromptStudy, { TitlePromptStudyData } from "@components/components/SomReview/TitlePromptStudy";
import data from "../../Ontology_Title_Clarity_Testbed_2026-08-28/prompt-study-2026-09-13/bundle.json";

export const TitlePromptStudyPage = () => <TitlePromptStudy data={data as TitlePromptStudyData} />;

export default withAuthUser({ shouldRedirectToLogin: true, shouldRedirectToHomeIfAuthenticated: false })(TitlePromptStudyPage);
