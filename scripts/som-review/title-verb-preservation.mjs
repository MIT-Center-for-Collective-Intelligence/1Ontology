import {inspectTitleAnswer} from './title-prompt-study-lib.mjs';

const words = value => typeof value === 'string'
  ? value.normalize('NFC').trim().toLowerCase().split(/\s+/).filter(Boolean)
  : [];
const beginsWith = (titleWords, verbWords) =>
  verbWords.every((word, index) => titleWords[index] === word);

// The caller supplies the original verb explicitly. This check does not infer
// verbs, substitute synonyms, repair model output, or establish semantic quality.
export function checkTitleVerbPreservation({input, rawOutput, requestStatus, originalVerb}) {
  const verbWords = words(originalVerb);
  if (!verbWords.length || !beginsWith(words(input?.title), verbWords)) {
    throw new Error('An explicit original verb matching the current title is required');
  }
  const inspected = inspectTitleAnswer(input, rawOutput, requestStatus);
  const checked = inspected.status === 'completed' && inspected.groups.length > 0;
  const violations = checked ? inspected.groups.flatMap((group, index) =>
    beginsWith(words(group.title), verbWords) ? [] : [{groupNumber:index + 1, title:group.title}]
  ) : [];
  return {
    schemaVersion:'title-verb-preservation-v1',
    originalTitle:input.title,
    originalVerb,
    checked,
    passesVerbCheck:checked && violations.length === 0,
    violations,
  };
}
