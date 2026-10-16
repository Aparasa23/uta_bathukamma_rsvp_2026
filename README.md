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
- **Automated Zeffy Membership Sync**:
  - Real-time webhook listener `payment.completed` automatically captures members purchasing memberships via Zeffy links.
  - Appends or updates rows into a dedicated `2026 Zeffy Members` tab in the Master Spreadsheet.
  - Members who register on Zeffy can immediately verify their email/phone on the portal without delay.
  - Built-in API batch sync & deduplication protection.

## Zeffy Membership Automatic Sync Setup

### 1. Real-Time Webhook (Recommended & Free)
1. In your **Google Apps Script Editor**, deploy as Web App (`Deploy` > `New deployment` > `Web app`, Execute as **Me**, Access: **Anyone**).
2. Copy your Web App URL (e.g., `https://script.google.com/macros/s/.../exec`).
3. Log into your **Zeffy Dashboard** > **Settings** > **Integrations** > **Webhooks**.
4. Paste the Web App URL and subscribe to `payment.completed`.
5. Whenever anyone buys a 2026 membership on Zeffy, it automatically creates/updates their record in the `2026 Zeffy Members` tab in the Master Sheet.

### 2. Immediate Backfill for Existing Zeffy Members
- In Zeffy Dashboard, export your current membership payments to CSV/Excel.
- Copy and paste those rows directly into the Master Sheet under the `2026 Zeffy Members` (or `2026 Members`) tab with columns: `Timestamp`, `Full Name`, `First Name`, `Last Name`, `Email`, `Phone`, `Membership Tier`.
- Alternatively, run `testZeffyWebhook()` or `syncZeffyMembersViaApi(yourZeffyApiKey, 'UTA2026Admin')` in the Apps Script editor.

## File Structure

- `Bathukamma_Index.html` / `Index.html`: Self-contained HTML/CSS/JS frontend application with base64-inlined images.
- `Bathukamma_Code.gs` / `Code.gs`: Google Apps Script backend containing logic for membership verification, ticket generation, email dispatching, logging, and Zeffy webhook sync.
- `vercel.json`: Vercel edge deployment routing configuration.

## Vercel Deployment

Deploy directly to Vercel via GitHub integration or Vercel CLI:

```bash
npx vercel --prod
```
