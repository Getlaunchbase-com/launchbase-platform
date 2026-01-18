# Builder Constitution (LaunchBase)

Builder is a PR executor, not a visual editor requirement.

## Allowed surfaces
- client/src/pages/**
- client/src/components/marketing/**
- client/src/styles/**

## Forbidden surfaces
- server/**
- drizzle/**
- package.json
- auth/**
- portal/**
- stripe/**
- oauth/**

## Workflow
Input: BuilderPatchRequestV1 JSON in docs/builder_contracts/requests/
Output: A GitHub PR with only allowed file changes.

## Non-negotiables
- Never edit forbidden surfaces
- No new dependencies
- Mobile-first layout
- One primary CTA per page
- No invented claims (truth policy)
