# Ads Manager — Tool Design Document
*Google Ads API Standard Access Application*

## Overview

Ads Manager is an internal campaign management and reporting tool built on the Google Ads API. It provides programmatic control over Google Ads campaigns for Noah Consulting (noah.consulting) and future client accounts managed under the same MCC.

The tool pulls performance data via the API, applies business logic and LLM-assisted analysis to generate optimization recommendations, and executes approved changes programmatically — following Google's published best practices for API-based campaign management.

## Business Context

Noah Consulting is an AI consulting firm serving small and mid-sized businesses. We run Google Ads campaigns across multiple audience segments (landing pages), each targeting a distinct customer persona. Managing these efficiently at scale requires programmatic tooling rather than manual UI work.

## Architecture

- **Runtime:** Node.js (TypeScript), running locally and on GCP
- **Database:** PostgreSQL — stores campaign snapshots, keyword performance history, optimization run logs
- **Scheduler:** pm2 cron — triggers the optimization loop on a configurable interval (default: every 7 days)
- **Human oversight:** All recommendations require explicit human approval before execution (human-in-the-loop mode). A fully autonomous mode is available but off by default.

## API Features Used

| Service | Purpose |
|---|---|
| `GoogleAdsService` | Performance reporting — campaigns, keywords, ads |
| `CampaignService` | Read and update campaign settings and budgets |
| `AdGroupService` | Manage ad groups per campaign |
| `AdGroupCriterionService` | Add, pause, and remove keywords |
| `AdService` | Read and create responsive search ads |
| `KeywordPlanService` | Keyword research and volume/CPC estimates |

## Optimization Loop

Every 7 days, for each managed campaign:

1. **Pull performance data** — impressions, clicks, conversions, cost via `GoogleAdsService`
2. **Analyze trends** — identify high/low performing keywords and ad copy using business logic
3. **Generate recommendations** — keyword additions/removals, bid adjustments, ad copy variants, budget reallocation
4. **Human review** — recommendations are presented to the account owner for approval
5. **Execute approved changes** — write approved changes back via the API

No changes are made to campaigns without explicit human approval in the default operating mode.

## Accounts

- **MCC:** Noah Consulting Manager Account
- **Initial managed account:** Noah Consulting (noah.consulting) — 1 account
- **Future:** Additional client accounts linked under the same MCC as the consulting business grows

## Data Handling

- All performance data is stored in a private PostgreSQL database
- No data is shared with third parties
- No data is used for any purpose outside managing the accounts listed above

## Compliance

This tool is designed for use by the account owner only, managing accounts they own or have explicit authorization to manage. It follows Google's API Terms of Service and does not automate any actions that circumvent Google's ad policies or review processes.
