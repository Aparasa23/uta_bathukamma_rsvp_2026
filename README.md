# Utah Telugu Association (UTA) – Bathukamma 2026 Member Verification & RSVP Portal

This repository contains the complete Web App and Google Apps Script backend for the **Utah Telugu Association (UTA) Bathukamma 2026 Celebration**.

## Features

- **Rich Emerald & Gold Glassmorphism Design System** featuring traditional Telugu Bathukamma artwork.
- **Live Multi-Year Membership Verification**: Instant search across 2026 Members, Lifetime Members, 2025 Members, and 2024 Members in the UTA Master Sheet.
- **Automated Ticket Pass Generation**: Active 2026 & Lifetime members automatically receive a free event pass (`BK2026-XXXXXX`).
- **Expired/Non-Member Guidance**: Expired and non-members are provided with 1-click links to renew membership or purchase general event tickets.
- **Dual Automated Email Confirmation**: Immediate HTML ticket pass sent to the member + real-time notification alert to UTA Admin (`uta.events.utah@gmail.com`).
- **Real-Time Spreadsheet Logging**: Every verification and RSVP attempt is appended automatically to `Bathukamma_RSVP_Log`.
- **Integrated Admin Portal**:
  - Protected by Admin Password (`UTA2026Admin`).
  - Live KPI metrics, log table with search/filter, and CSV export.
  - Hidden access triggers: Double-click UTA Logo, press `Ctrl+Shift+A`, or visit URL with `?admin=true`.

## File Structure

- `Bathukamma_Index.html` / `Index.html`: Self-contained HTML/CSS/JS frontend application with base64-inlined images.
- `Bathukamma_Code.gs` / `Code.gs`: Google Apps Script backend containing logic for membership verification, ticket generation, email dispatching, and logging.
- `vercel.json`: Vercel edge deployment routing configuration.

## Vercel Deployment

Deploy directly to Vercel via GitHub integration or Vercel CLI:

```bash
npx vercel --prod
```
