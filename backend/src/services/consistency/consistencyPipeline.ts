import type {
  AnalyzeConsistencyRequest,
  DocumentBlock,
  DocumentContextMemory,
  Issue,
} from "../../domain/types.js";
import { analyzeSpellingIssues } from "../llm/spellingAnalyzer.js";
import { runRuleEngine } from "../rules/ruleEngine.js";
import { mergeAndDeduplicateIssues } from "../rules/customRules.js";
import { runEntityConsistencyChecker } from "./entityConsistencyChecker.js";
import { runFormatConsistencyChecker } from "./formatConsistencyChecker.js";
import { runTerminologyConsistencyChecker } from "./terminologyConsistencyChecker.js";
import { runToneConsistencyChecker } from "./toneConsistencyChecker.js";
import { runTranslationConsistencyChecker } from "./translationConsistencyChecker.js";

type ConsistencyPipelineInput = {
  documentId: string;
  blocks: DocumentBlock[];
  contextMemory: DocumentContextMemory;
  request: AnalyzeConsistencyRequest;
};

export function selectIssuesForReview(issues: Issue[], maxIssues: number): Issue[] {
  if (maxIssues <= 0 || issues.length === 0) return [];
  if (issues.length <= maxIssues) return [...issues];

  const issuesByBlock = new Map<string, Issue[]>();
  const orderedBlockIds: string[] = [];

  for (const issue of issues) {
    const blockId = issue.location.blockId;
    if (!issuesByBlock.has(blockId)) {
      issuesByBlock.set(blockId, []);
      orderedBlockIds.push(blockId);
    }
    issuesByBlock.get(blockId)!.push(issue);
  }

  const queues = orderedBlockIds.map((blockId) => [...(issuesByBlock.get(blockId) || [])]);
  const selected: Issue[] = [];

  while (selected.length < maxIssues) {
    let pickedAny = false;

    for (const queue of queues) {
      const nextIssue = queue.shift();
      if (!nextIssue) continue;

      selected.push(nextIssue);
      pickedAny = true;

      if (selected.length >= maxIssues) {
        break;
      }
    }

    if (!pickedAny) break;
  }

  return selected;
}

export async function runConsistencyPipeline({
  documentId,
  blocks,
  contextMemory,
  request,
}: ConsistencyPipelineInput): Promise<Issue[]> {
  const issues: Issue[] = [];

  if (request.useRuleEngine) {
    issues.push(...runRuleEngine(documentId, blocks, contextMemory));
  }

  if (request.checks.includes("spelling")) {
    issues.push(...(await analyzeSpellingIssues(blocks, documentId)));
  }

  if (request.useLLM) {
    if (request.checks.includes("format")) {
      issues.push(...(await runFormatConsistencyChecker(documentId, blocks, contextMemory)));
    }
    if (request.checks.includes("terminology")) {
      issues.push(...(await runTerminologyConsistencyChecker(documentId, blocks, contextMemory)));
    }
    if (request.checks.includes("translation")) {
      issues.push(...(await runTranslationConsistencyChecker(documentId, blocks, contextMemory)));
    }
    if (request.checks.includes("tone")) {
      issues.push(...(await runToneConsistencyChecker(documentId, blocks, contextMemory)));
    }
    if (request.checks.includes("entity")) {
      issues.push(...(await runEntityConsistencyChecker(documentId, blocks, contextMemory)));
    }
  }

  return selectIssuesForReview(
    mergeAndDeduplicateIssues(issues),
    request.maxIssues
  );
}
