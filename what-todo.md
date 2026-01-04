# Vercel Speed Insights Guide

## Overview
We have added [Vercel Speed Insights](https://vercel.com/docs/speed-insights) to the application. This tool automatically collects real-world performance metrics from users visiting the site.

## Implementation
- **Component**: `<SpeedInsights />`
- **Location**: `src/app/layout.tsx` (Root Layout)
- **Package**: `@vercel/speed-insights`

The component acts as an analytics beacon. It does not affect the visual rendering of the application but silently reports performance timings to Vercel.

## How to Monitor
1. **Access the Dashboard**:
   - Go to the project page on [Vercel](https://vercel.com).
   - Click on the **Speed Insights** tab.
2. **Review Metrics**:
   - **LCP (Largest Contentful Paint)**: Measures loading performance. Target: < 2.5s.
   - **FID (First Input Delay)**: Measures interactivity. Target: < 100ms.
   - **CLS (Cumulative Layout Shift)**: Measures visual stability. Target: < 0.1.
   - **INP (Interaction to Next Paint)**: Measures responsiveness.

## What to Do (Gamemaster / Admin)
- **Regular Checks**: Check the Speed Insights tab weekly to ensure no new deployments have degraded performance.
- **Drill Down**: If a score drops, use the dashboard to filter by route (e.g., `/game/[id]` vs `/`). This helps pinpoint if specific pages are heavy.
- **Score Analysis**: behavior is tailored to real user devices. If mobile scores are low, consider optimizing image sizes or reducing JS bundles for mobile.

## Troubleshooting
- If no data appears:
  - Ensure the project is deployed to Vercel.
  - Ensure the "Speed Insights" add-on is enabled in the Vercel project settings.
  - Metric collection might take a few minutes to appear after a fresh deployment and user visits.
