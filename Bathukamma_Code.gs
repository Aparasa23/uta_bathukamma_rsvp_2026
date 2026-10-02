/**
 * BATHUKAMMA 2026 EVENT - UTA MEMBERSHIP VERIFICATION, RSVP LOGGING, DUAL EMAIL & ADMIN DASHBOARD
 * 
 * Features:
 * 1. Multi-Year & Lifetime Membership Verification (Master Sheet: 1D2HD41kUJ6BC3K6_66efwNP_tOi10PTvjEC8wQI6liw)
 * 2. Real-Time Admin RSVP Logging & Live Admin Web App Dashboard
 * 3. Dual Email Confirmation: Sends HTML Ticket Pass to Member + Notification to UTA Admin Email.
 * 4. User Email Request Feature: Allows member to send/resend email ticket pass.
 */


/**
 * RUN THIS FUNCTION ONCE IN APPS SCRIPT EDITOR BY CLICKING '▷ Run'
 * This triggers Google's Authorization Dialog for MailApp and Spreadsheets!
 */
function authorizeMailPermissionsTest() {
  const userEmail = Session.getActiveUser().getEmail() || BATHUKAMMA_CONFIG.utaAdminEmail;
  Logger.log("Authorizing MailApp for email: " + userEmail);
  MailApp.sendEmail({
    to: userEmail,
    subject: "UTA Bathukamma System Permissions Test",
    body: "Permissions authorized successfully! Your Bathukamma 2026 Web App can now dispatch ticket pass emails."
  });
}

const BATHUKAMMA_CONFIG = {
  eventName: 'Bathukamma 2026 Grand Celebration',
  eventDate: 'October 2026',
  eventVenue: 'Utah Telugu Association (UTA) Event Center',
  currentActiveYear: '2026',
  
  // Single Master Spreadsheet ID containing all year tabs & RSVP logs
  masterSpreadsheetId: '1D2HD41kUJ6BC3K6_66efwNP_tOi10PTvjEC8wQI6liw',
  rsvpLogSheetName: 'Bathukamma_RSVP_Log',
  
  // Official UTA Admin Email for notifications
  utaAdminEmail: 'utahteluguassociation@gmail.com',
  adminPin: 'UTA2026Admin', // Admin password for web dashboard access

  // Official Forms Links
  buyTicketUrl: 'https://forms.gle/rb621mkJ4FzXvSib7',
  renewMembershipUrl: 'https://forms.gle/rb621mkJ4FzXvSib7',
  joinMembershipUrl: 'https://forms.gle/rb621mkJ4FzXvSib7'
};

/**
 * Main Web App Entrypoint
 */
/**
 * Main Web App Entrypoint & REST API endpoint for Vercel / External Web Hosting
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e.parameter);
  }
  return HtmlService.createHtmlOutputFromFile('Bathukamma_Index')
    .setTitle('Bathukamma 2026 - UTA Member RSVP & Admin Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  let params = {};
  if (e && e.parameter && e.parameter.action) {
    params = e.parameter;
  } else if (e && e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch(err) {
      params = e.parameter || {};
    }
  } else if (e && e.parameter) {
    params = e.parameter;
  }
  return handleApiRequest(params);
}

function handleApiRequest(params) {
  const action = params.action;
  let result = { success: false, message: 'Invalid action: ' + action };

  try {
    if (action === 'verifyMemberAndIssueRSVP' || action === 'verify') {
      const query = params.query || params.q || '';
      result = verifyMemberAndIssueRSVP(query);
    } else if (action === 'getAdminDashboardData' || action === 'admin') {
      const pin = params.pin || params.password || '';
      result = getAdminDashboardData(pin);
    } else if (action === 'sendEmailTicketToUser' || action === 'sendEmail') {
      const ticketCode = params.ticketCode || '';
      const memberName = params.memberName || '';
      const email = params.email || '';
      result = sendEmailTicketToUser(ticketCode, memberName, email);
    }
  } catch (error) {
    result = { success: false, message: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Client API handler called by Bathukamma_Index.html
 */
function verifyMemberAndIssueRSVP(inputQuery) {
  try {
    const res = checkMembershipStatus(inputQuery);
    if (!res.ok) {
      return { success: false, message: res.error || 'Verification error.' };
    }

    if (res.found && res.active) {
      return {
        success: true,
        status: 'ACTIVE',
        ticketCode: res.ticketCode || ('BK2026-' + Math.floor(100000 + Math.random() * 900000)),
        emailSent: res.emailSent || false,
        data: {
          memberName: res.memberName || 'UTA Member',
          memberId: res.memberId || ('UTA-2026-' + Math.floor(1000 + Math.random() * 9000)),
          membershipType: res.membershipType || 'UTA Member',
          email: res.email || (inputQuery.includes('@') ? inputQuery : ''),
          lastActiveYear: '2026'
        }
      };
    } else if (res.found && !res.active) {
      return {
        success: true,
        status: 'EXPIRED',
        data: {
          memberName: res.memberName || 'UTA Member',
          memberId: res.memberId || 'UTA-EXP',
          membershipType: res.membershipType || 'Expired Member',
          lastActiveYear: res.recordYear || '2024/2025'
        }
      };
    } else {
      return {
        success: true,
        status: 'NOT_FOUND',
        data: {}
      };
    }
  } catch (err) {
    return { success: false, message: 'Server exception: ' + err.toString() };
  }
}

/**
 * Allows member to request/send ticket pass to a specific email address.
 */
function sendEmailTicketToUser(ticketCode, memberName, emailAddress) {
  try {
    const cleanEmail = String(emailAddress || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please provide a valid email address.' };
    }

    const memberHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 2px solid #f59e0b; border-radius: 16px; background-color: #06281c; color: #ffffff;">
        <h2 style="color: #fbbf24; text-align: center; margin-top: 0; font-family: Georgia, serif;">UTAH TELUGU ASSOCIATION (UTA)</h2>
        <h3 style="color: #ffffff; text-align: center; margin-bottom: 20px;">Bathukamma 2026 Event Admission Pass</h3>
        <hr style="border: 1px dashed #f59e0b;" />
        <p>Dear <strong>${memberName || 'UTA Member'}</strong>,</p>
        <p>Your 2026 UTA Member Admission Pass has been generated. Please find your ticket details below:</p>
        
        <div style="background-color: #021a12; border: 2px solid #f59e0b; padding: 20px; border-radius: 12px; text-align: center; margin: 24px 0;">
          <div style="color: #cbd5e1; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Official Pass Code</div>
          <div style="color: #fbbf24; font-size: 28px; font-weight: bold; letter-spacing: 3px; margin: 8px 0;">${ticketCode}</div>
          <div style="color: #06d6a0; font-size: 13px; font-weight: bold;">✓ Confirmed Member Ticket • Admit 1</div>
        </div>

        <p><strong>Event:</strong> ${BATHUKAMMA_CONFIG.eventName}</p>
        <p><strong>Date:</strong> ${BATHUKAMMA_CONFIG.eventDate}</p>
        <p><strong>Venue:</strong> ${BATHUKAMMA_CONFIG.eventVenue}</p>
        <p style="margin-top: 20px;">Please show this ticket pass or present your code at the check-in desk.</p>
        <hr style="border: 1px solid rgba(245, 158, 11, 0.3); margin-top: 24px;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Utah Telugu Association (UTA) • Official Event Pass</p>
      </div>
    `;

    MailApp.sendEmail({
      to: cleanEmail,
      subject: `🎟️ Your Bathukamma 2026 Ticket Pass [${ticketCode}] - UTA`,
      htmlBody: memberHtml
    });

    return { success: true, message: `Ticket pass successfully sent to ${cleanEmail}` };
  } catch (err) {
    return { success: false, message: 'Failed to dispatch email: ' + err.toString() };
  }
}

/**
 * Searches Master Sheet tabs (2026, Lifetime, 2025, 2024) for member lookup.
 */
function checkMembershipStatus(inputQuery) {
  try {
    const rawQuery = String(inputQuery || '').trim();
    if (!rawQuery) {
      return { ok: false, error: 'Please enter an email, phone number, or Member ID.' };
    }

    const cleanQuery = rawQuery.toLowerCase();
    const phoneDigits = normalizePhoneDigits_(rawQuery);

    const tabsToSearch = ['2026', 'Lifetime', '2025', '2024'];

    for (let i = 0; i < tabsToSearch.length; i++) {
      const yearKey = tabsToSearch[i];
      const match = searchTabForMember_(yearKey, cleanQuery, phoneDigits);
      
      if (match.found) {
        // ACTIVE RULE: Either in 2026 tab OR Lifetime Member
        const isActiveFor2026 = (yearKey === '2026') || match.isLifetime;

        let memberTypeStr = 'UTA Member';
        if (match.isLifetime) {
          memberTypeStr = 'UTA Lifetime Member';
        } else {
          memberTypeStr = `${yearKey} Annual Member`;
        }

        // If ACTIVE -> Auto-process ticket, log in Master Sheet, send Dual Emails
        let ticketInfo = null;
        if (isActiveFor2026) {
          ticketInfo = issueTicketAndNotify_({
            queryInput: rawQuery,
            memberName: match.memberName || 'UTA Member',
            membershipType: memberTypeStr,
            memberEmail: match.email || (rawQuery.includes('@') ? rawQuery : ''),
            memberPhone: match.phone || (!rawQuery.includes('@') ? rawQuery : '')
          });
        }

        return {
          ok: true,
          found: true,
          active: isActiveFor2026,
          memberName: match.memberName || 'UTA Member',
          membershipType: memberTypeStr,
          purchaseDate: match.purchaseDate || 'Recorded on File',
          recordYear: yearKey,
          isLifetime: match.isLifetime,
          email: match.email || (rawQuery.includes('@') ? rawQuery : ''),
          ticketCode: ticketInfo ? ticketInfo.ticketCode : '',
          emailSent: ticketInfo ? ticketInfo.emailSent : false,
          statusMessage: isActiveFor2026 
            ? 'Active for 2026' 
            : `Membership record found (${memberTypeStr}), but NOT ACTIVE for the year 2026.`,
          buyTicketUrl: BATHUKAMMA_CONFIG.buyTicketUrl,
          renewUrl: BATHUKAMMA_CONFIG.renewMembershipUrl
        };
      }
    }

    // Not Found in any tab
    return {
      ok: true,
      found: false,
      active: false,
      statusMessage: 'No membership record found in our database.',
      joinUrl: BATHUKAMMA_CONFIG.joinMembershipUrl,
      buyTicketUrl: BATHUKAMMA_CONFIG.buyTicketUrl
    };

  } catch (err) {
    return { ok: false, error: 'Verification system error. Please try again or contact support.' };
  }
}

/**
 * Auto-Issues Ticket Code, Logs to 'Bathukamma_RSVP_Log' Sheet, and Sends Dual Emails.
 */
function issueTicketAndNotify_(details) {
  const ticketCode = 'BK2026-' + Math.floor(100000 + Math.random() * 900000);
  let emailSent = false;

  // 1. Log into Master Spreadsheet 'Bathukamma_RSVP_Log' tab for Admin Tracking
  try {
    if (BATHUKAMMA_CONFIG.masterSpreadsheetId) {
      const ss = SpreadsheetApp.openById(BATHUKAMMA_CONFIG.masterSpreadsheetId);
      let logSheet = ss.getSheetByName(BATHUKAMMA_CONFIG.rsvpLogSheetName);
      
      if (!logSheet) {
        logSheet = ss.insertSheet(BATHUKAMMA_CONFIG.rsvpLogSheetName);
        logSheet.appendRow([
          'Timestamp',
          'Ticket Code',
          'Member Name',
          'Identifier Used',
          'Membership Category',
          'Ticket Status',
          'Member Email'
        ]);
        logSheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#f59e0b');
      }

      logSheet.appendRow([
        new Date(),
        ticketCode,
        details.memberName,
        details.queryInput,
        details.membershipType,
        'CONFIRMED (FREE MEMBER PASS)',
        details.memberEmail || 'N/A'
      ]);
    }
  } catch (err) {
    console.warn('Logging warning:', err);
  }

  // 2. Send Email Confirmation to Member (if email present)
  if (details.memberEmail && details.memberEmail.includes('@')) {
    try {
      const res = sendEmailTicketToUser(ticketCode, details.memberName, details.memberEmail);
      if (res && res.success) emailSent = true;
    } catch (e) {
      console.warn('Member email dispatch warning:', e);
    }
  }

  // 3. Send Notification Email to UTA Admin Address
  if (BATHUKAMMA_CONFIG.utaAdminEmail) {
    try {
      const adminHtml = `
        <div style="font-family: Arial, sans-serif; padding: 18px; border: 2px solid #f59e0b; border-radius: 10px; background-color: #fcfbf7;">
          <h3 style="color: #d97706; margin-top: 0;">🎟️ [UTA Admin Notification] New Bathukamma Ticket Claimed</h3>
          <p><strong>Member Name:</strong> ${details.memberName}</p>
          <p><strong>Membership Category:</strong> ${details.membershipType}</p>
          <p><strong>Identifier Used:</strong> ${details.queryInput}</p>
          <p><strong>Ticket Code Issued:</strong> <code style="font-size: 16px; background-color: #fef3c7; padding: 4px 8px; border-radius: 4px; color: #92400e;">${ticketCode}</code></p>
          <p><strong>Member Email:</strong> ${details.memberEmail || 'Not provided'}</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `;

      MailApp.sendEmail({
        to: BATHUKAMMA_CONFIG.utaAdminEmail,
        subject: `[UTA Admin Alert] Ticket ${ticketCode} Issued to ${details.memberName}`,
        htmlBody: adminHtml
      });
    } catch (e) {}
  }

  return { ticketCode: ticketCode, emailSent: emailSent };
}

/**
 * Fetches Live Admin Web App Dashboard Data
 */
function getAdminDashboardData(adminPin) {
  try {
    const cleanPin = String(adminPin || '').trim();
    if (cleanPin !== (BATHUKAMMA_CONFIG.adminPin || '2026')) {
      return { success: false, message: 'Invalid Admin PIN. Access Denied.' };
    }

    if (!BATHUKAMMA_CONFIG.masterSpreadsheetId) {
      return { success: false, message: 'Master Spreadsheet ID missing.' };
    }

    const ss = SpreadsheetApp.openById(BATHUKAMMA_CONFIG.masterSpreadsheetId);
    let logSheet = ss.getSheetByName(BATHUKAMMA_CONFIG.rsvpLogSheetName);

    if (!logSheet) {
      return { success: true, totalIssued: 0, rows: [] };
    }

    const data = logSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: true, totalIssued: 0, rows: [] };
    }

    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      rows.push({
        timestamp: r[0] instanceof Date ? formatDate_(r[0]) : String(r[0] || ''),
        ticketCode: String(r[1] || ''),
        memberName: String(r[2] || ''),
        identifier: String(r[3] || ''),
        category: String(r[4] || ''),
        status: String(r[5] || ''),
        email: String(r[6] || '')
      });
    }

    return {
      success: true,
      totalIssued: rows.length,
      rows: rows.reverse() // show latest tickets on top
    };
  } catch (err) {
    return { success: false, message: 'Error retrieving admin log: ' + err.toString() };
  }
}

/**
 * Helper to search a specific sheet tab for a matching member.
 */
function searchTabForMember_(yearKey, cleanQuery, phoneDigits) {
  let sheet = null;

  if (BATHUKAMMA_CONFIG.masterSpreadsheetId) {
    try {
      const masterSs = SpreadsheetApp.openById(BATHUKAMMA_CONFIG.masterSpreadsheetId);
      sheet = masterSs.getSheetByName(yearKey);
      
      if (!sheet && masterSs.getSheets().length > 0) {
        const sheets = masterSs.getSheets();
        for (let s = 0; s < sheets.length; s++) {
          if (sheets[s].getName().toLowerCase().includes(yearKey.toLowerCase())) {
            sheet = sheets[s];
            break;
          }
        }
      }
    } catch (err) {}
  }

  if (!sheet) return { found: false };

  try {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { found: false };

    const headers = data[0].map(h => String(h || '').toLowerCase().trim());
    
    let nameCol = headers.findIndex(h => h.includes('name'));
    let dateCol = headers.findIndex(h => h.includes('timestamp') || h.includes('date') || h.includes('time'));
    let typeCol = headers.findIndex(h => h.includes('type') || h.includes('membership') || h.includes('category'));
    let emailCol = headers.findIndex(h => h.includes('email') || h.includes('mail'));
    let phoneCol = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('cell'));

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      let rowMatch = false;
      let isLifetime = (yearKey.toLowerCase().includes('life'));

      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        if (val == null || val === '') continue;

        const valStr = String(val).trim();
        const valLower = valStr.toLowerCase();
        const cellDigits = normalizePhoneDigits_(valStr);

        if (cleanQuery.length >= 3 && valLower === cleanQuery) {
          rowMatch = true;
        }
        else if (phoneDigits.length >= 7 && cellDigits.length >= 7 && (cellDigits === phoneDigits || cellDigits.includes(phoneDigits) || phoneDigits.includes(cellDigits))) {
          rowMatch = true;
        }

        if (valLower.includes('lifetime') || valLower.includes('life time') || valLower.includes('family life')) {
          isLifetime = true;
        }
      }

      if (rowMatch) {
        let memberName = (nameCol >= 0 && row[nameCol]) ? String(row[nameCol]).trim() : '';
        let purchaseDate = (dateCol >= 0 && row[dateCol]) ? formatDate_(row[dateCol]) : '';
        let rawType = (typeCol >= 0 && row[typeCol]) ? String(row[typeCol]).trim() : '';
        let memberEmail = (emailCol >= 0 && row[emailCol]) ? String(row[emailCol]).trim() : '';
        let memberPhone = (phoneCol >= 0 && row[phoneCol]) ? String(row[phoneCol]).trim() : '';

        if (!memberName) {
          for (let c = 0; c < row.length; c++) {
            const v = String(row[c] || '').trim();
            if (v && !v.includes('@') && !/\d{5,}/.test(v) && v.split(' ').length >= 1) {
              memberName = v;
              break;
            }
          }
        }

        if (!purchaseDate && row[0] instanceof Date) {
          purchaseDate = formatDate_(row[0]);
        }

        return {
          found: true,
          isLifetime: isLifetime,
          memberName: memberName,
          purchaseDate: purchaseDate,
          rawType: rawType,
          email: memberEmail,
          phone: memberPhone
        };
      }
    }
  } catch (e) {}

  return { found: false };
}

/**
 * Normalizes all phone number formats to standard 10-digit numerical string.
 */
function normalizePhoneDigits_(str) {
  const digits = String(str || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Formats timestamps/dates nicely for display.
 */
function formatDate_(dateVal) {
  if (!dateVal) return '';
  try {
    if (dateVal instanceof Date) {
      return Utilities.formatDate(dateVal, Session.getScriptTimeZone() || "GMT", "MMM dd, yyyy, hh:mm a");
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, Session.getScriptTimeZone() || "GMT", "MMM dd, yyyy, hh:mm a");
    }
  } catch (e) {}
  return String(dateVal);
}

