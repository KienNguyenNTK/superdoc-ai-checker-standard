# API Docs

## Upload

`POST /api/documents`

Form-data:

- `file`: `.docx`

Response:

```json
{
  "documentId": "doc_abcd1234",
  "originalFileUrl": "/files/documents/doc_abcd1234/original.docx",
  "status": "uploaded"
}
```

## Build context

`POST /api/documents/:documentId/build-context`

Response:

```json
{
  "documentId": "doc_abcd1234",
  "status": "context_built",
  "summary": {
    "terms": 12,
    "formatRules": 3,
    "toneRules": 1,
    "entities": 4
  },
  "contextMemoryUrl": "/files/documents/doc_abcd1234/context-memory.json"
}
```

## Get context

`GET /api/documents/:documentId/context`

Response:

```json
{
  "context": {
    "documentId": "doc_abcd1234",
    "glossary": [],
    "formatRules": [],
    "toneRules": [],
    "entityRules": []
  }
}
```

## Update glossary

`PUT /api/documents/:documentId/glossary`

Body:

```json
{
  "glossary": [
    {
      "term": "document engine",
      "preferredTranslation": "bộ máy tài liệu",
      "alternatives": ["công cụ tài liệu"]
    }
  ]
}
```

## Analyze consistency

`POST /api/documents/:documentId/analyze-consistency`

Body:

```json
{
  "checks": ["spelling", "format", "terminology", "translation", "tone", "entity", "date_number"],
  "mode": "comment_and_highlight",
  "useLLM": true,
  "useRuleEngine": true,
  "maxIssues": 300
}
```

Response:

```json
{
  "documentId": "doc_abcd1234",
  "status": "reviewed",
  "issues": [],
  "comments": [],
  "changes": [],
  "history": [],
  "todos": [],
  "context": {},
  "reviewedFileUrl": "/files/documents/doc_abcd1234/reviewed-consistency.docx"
}
```

## Analyze selection

`POST /api/documents/:documentId/analyze-selection`

Body:

```json
{
  "selection": {
    "blockId": "p_001",
    "startOffset": 0,
    "endOffset": 100
  },
  "checks": ["spelling", "format"]
}
```

## Prompt APIs

- `GET /api/prompts`
- `GET /api/prompts/:promptId`
- `PUT /api/prompts/:promptId`
- `POST /api/prompts/:promptId/test`
- `POST /api/prompts/:promptId/reset`

`POST /api/prompts/:promptId/test`

Body:

```json
{
  "variables": {
    "CHECK_MODE": "format",
    "BLOCKS": "[blockId=p_001] SuperDoc"
  },
  "sampleOutput": "{\"issues\":[]}"
}
```

## Apply / ignore issue

- `POST /api/documents/:documentId/issues/:issueId/apply`
- `POST /api/documents/:documentId/issues/:issueId/ignore`
- `POST /api/documents/:documentId/issues/apply-high-confidence`

## Export

`GET /api/documents/:documentId/export?type=original|reviewed|final|report-json|report-csv`
