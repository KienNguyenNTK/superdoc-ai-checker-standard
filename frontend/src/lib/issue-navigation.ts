import type { TextAddress, TextTarget } from "superdoc";
import type { SpellingIssue } from "../types";

export type IssueMatchSource = "excerpt" | "wrong";
export type IssueCommentTarget = TextAddress | TextTarget;

export type IssueMatchCandidate = {
  source: IssueMatchSource;
  snippet: string;
  target: IssueCommentTarget | null;
};

export function pickBestIssueMatch(
  issue: Pick<SpellingIssue, "wrong" | "blockLabel" | "excerpt">,
  candidates: IssueMatchCandidate[]
) {
  const validCandidates = candidates.filter(
    (candidate): candidate is IssueMatchCandidate & { target: IssueCommentTarget } =>
      !!candidate.target
  );

  if (!validCandidates.length) {
    return null;
  }

  const scored = validCandidates.map((candidate) => ({
    candidate,
    score: scoreCandidate(issue, candidate),
  }));

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.candidate ?? null;
}

function scoreCandidate(
  issue: Pick<SpellingIssue, "wrong" | "blockLabel" | "excerpt">,
  candidate: IssueMatchCandidate
) {
  const snippet = normalize(candidate.snippet);
  const wrong = normalize(issue.wrong);
  const excerpt = normalize(issue.excerpt);
  const blockLabel = normalize(issue.blockLabel);

  let score = 0;

  if (candidate.source === "excerpt") {
    score += 100;
  }

  if (excerpt && snippet.includes(excerpt)) {
    score += 80;
  }

  if (wrong && snippet.includes(wrong)) {
    score += 20;
  }

  if (blockLabel && snippet.includes(blockLabel)) {
    score += 40;
  }

  return score;
}

function normalize(value?: string) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}
