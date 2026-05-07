import type {
  AnalysisSummary,
  AnalyzeConsistencyRequest,
  DocumentBlock,
  DocumentContextMemory,
  Issue,
} from "../../domain/types.js";
import {
  analyzeSpellingIssuesDetailed,
  buildBlockTemplateGroups,
  chunkBlocks,
} from "../llm/spellingAnalyzer.js";
import { runRuleEngine } from "../rules/ruleEngine.js";
import { mergeAndDeduplicateIssues } from "../rules/customRules.js";
import { runEntityConsistencyChecker } from "./entityConsistencyChecker.js";
import { runFormatConsistencyChecker } from "./formatConsistencyChecker.js";
import { runTerminologyConsistencyChecker } from "./terminologyConsistencyChecker.js";
import { runToneConsistencyChecker } from "./toneConsistencyChecker.js";
import { runTranslationConsistencyChecker } from "./translationConsistencyChecker.js";
import type { AnalysisTraceCollector } from "../review/analysisTrace.js";

type ConsistencyPipelineInput = {
  documentId: string;
  blocks: DocumentBlock[];
  contextMemory: DocumentContextMemory;
  request: AnalyzeConsistencyRequest;
  traceCollector?: AnalysisTraceCollector;
};

export type ConsistencyPipelineResult = {
  allIssues: Issue[];
  selectedIssues: Issue[];
  summary: AnalysisSummary;
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
  const result = await runConsistencyPipelineDetailed({
    documentId,
    blocks,
    contextMemory,
    request,
  });

  return result.selectedIssues;
}

export async function runConsistencyPipelineDetailed({
  documentId,
  blocks,
  contextMemory,
  request,
  traceCollector,
}: ConsistencyPipelineInput): Promise<ConsistencyPipelineResult> {
  const issues: Issue[] = [];
  const uniqueTemplates = buildBlockTemplateGroups(blocks).length;
  const representativeChunks = chunkBlocks(
    buildBlockTemplateGroups(blocks).map((group) => group.representative)
  ).length;
  traceCollector?.setInputBlocks(blocks, uniqueTemplates, representativeChunks);

  let ruleEngineIssues: Issue[] = [];
  let spellingIssues: Issue[] = [];
  let spellingDiagnostics = {
    heuristicIssueCount: 0,
    dictionarySuspicionIssueCount: 0,
    llmIssueCount: 0,
    mergedIssueCount: 0,
    needsReviewCount: 0,
    bySource: {
      rule_engine: 0,
      llm: 0,
      hybrid: 0,
    },
  };

  if (request.useRuleEngine) {
    ruleEngineIssues = runRuleEngine(documentId, blocks, contextMemory);
    issues.push(...ruleEngineIssues);
  }

  if (request.checks.includes("spelling")) {
    const spellingResult = await analyzeSpellingIssuesDetailed(blocks, documentId);
    spellingIssues = spellingResult.issues;
    spellingDiagnostics = spellingResult.diagnostics;
    issues.push(...spellingIssues);
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

  traceCollector?.setDetectorMetrics({
    ruleIssues: ruleEngineIssues.length + spellingDiagnostics.heuristicIssueCount,
    dictionarySuspicionIssues: spellingDiagnostics.dictionarySuspicionIssueCount,
    llmIssues: spellingDiagnostics.llmIssueCount,
    mergedIssues: issues.length,
    bySource: {
      rule_engine: issues.filter((issue) => issue.source === "rule_engine").length,
      llm: issues.filter((issue) => issue.source === "llm").length,
      hybrid: issues.filter((issue) => issue.source === "hybrid").length,
    },
    needsReviewCount: issues.filter((issue) => issue.status === "needs_review").length,
    confirmedErrorCount: issues.filter((issue) => issue.status !== "needs_review").length,
  });
  traceCollector?.registerDetectorIssues(ruleEngineIssues, "rule_engine_output");
  traceCollector?.registerDetectorIssues(spellingIssues, "spelling_output");

  const allIssues = mergeAndDeduplicateIssues(issues);
  const selectedIssues = selectIssuesForReview(allIssues, request.maxIssues);
  const blocksWithIssues = new Set(allIssues.map((issue) => issue.location.blockId)).size;
  const needsReviewCount = allIssues.filter((issue) => issue.status === "needs_review").length;
  const confirmedErrorCount = allIssues.length - needsReviewCount;
  traceCollector?.recordPostPipeline(issues, allIssues, selectedIssues);

  return {
    allIssues,
    selectedIssues,
    summary: {
      detectedIssues: allIssues.length,
      selectedIssues: selectedIssues.length,
      annotatedIssues: selectedIssues.length,
      returnedIssues: allIssues.length,
      maxIssues: request.maxIssues,
      maxAnnotatedIssues: request.maxAnnotatedIssues ?? request.maxIssues,
      maxReturnedIssues: request.maxReturnedIssues ?? Number.MAX_SAFE_INTEGER,
      confirmedErrorCount,
      needsReviewCount,
      blocksAnalyzed: blocks.length,
      blocksWithIssues,
      uniqueBlockTemplates: uniqueTemplates,
    },
  };
}
