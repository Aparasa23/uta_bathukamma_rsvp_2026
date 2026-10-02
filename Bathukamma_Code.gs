/**
 * BATHUKAMMA 2026 EVENT - UTA MEMBERSHIP VERIFICATION, FAMILY RSVP LOGGING, DUAL EMAIL & ADMIN DASHBOARD
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
  
  masterSpreadsheetId: '1D2HD41kUJ6BC3K6_66efwNP_tOi10PTvjEC8wQI6liw',
  rsvpLogSheetName: 'Bathukamma_RSVP_Log',
  
  utaAdminEmail: 'utahteluguassociation@gmail.com',
  adminPin: 'UTA2026Admin',

  buyTicketUrl: 'https://forms.gle/rb621mkJ4FzXvSib7',
  renewMembershipUrl: 'https://forms.gle/rb621mkJ4FzXvSib7',
  joinMembershipUrl: 'https://forms.gle/rb621mkJ4FzXvSib7'
};

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
    } else if (action === 'confirmAndIssueTicket' || action === 'confirmTicket') {
      result = confirmAndIssueTicket(params);
    } else if (action === 'getAdminDashboardData' || action === 'admin') {
      const pin = params.pin || params.password || '';
      result = getAdminDashboardData(pin);
    } else if (action === 'sendEmailTicketToUser' || action === 'sendEmail') {
      const ticketCode = params.ticketCode || '';
      const memberName = params.memberName || '';
      const email = params.email || '';
      const adults = parseInt(params.adults || 1, 10);
      const children = parseInt(params.children || 0, 10);
      const category = params.category || 'UTA Member';
      result = sendEmailTicketToUser(ticketCode, memberName, email, adults, children, category);
    }
  } catch (error) {
    result = { success: false, message: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function verifyMemberAndIssueRSVP(inputQuery) {
  try {
    const res = checkMembershipStatus(inputQuery);
    if (!res.ok) {
      return { success: false, message: res.error || 'Verification error.' };
    }

    if (res.found && res.active) {
      const isFamily = isFamilyMembership_(res.membershipType);
      return {
        success: true,
        status: 'ACTIVE',
        data: {
          queryInput: inputQuery,
          memberName: res.memberName || 'UTA Member',
          memberId: res.memberId || ('UTA-2026-' + Math.floor(1000 + Math.random() * 9000)),
          membershipType: res.membershipType || 'UTA Member',
          isFamily: isFamily,
          suggestedAdults: isFamily ? 2 : 1,
          suggestedChildren: 0,
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

function isFamilyMembership_(typeStr) {
  const str = String(typeStr || '').toLowerCase();
  if (str.includes('single') || str.includes('individual')) return false;
  return true;
}

function confirmAndIssueTicket(params) {
  try {
    const queryInput = String(params.queryInput || params.query || '').trim();
    const memberName = String(params.memberName || 'UTA Member').trim();
    const membershipType = String(params.membershipType || 'UTA Member').trim();
    const memberEmail = String(params.email || params.memberEmail || '').trim();
    const adults = Math.max(1, parseInt(params.adults || 1, 10));
    const children = Math.max(0, parseInt(params.children || 0, 10));
    const totalAttending = adults + children;

    const ticketCode = 'BK2026-' + Math.floor(100000 + Math.random() * 900000);
    let emailSent = false;

    // Log to Master Sheet 'Bathukamma_RSVP_Log'
    if (BATHUKAMMA_CONFIG.masterSpreadsheetId) {
      try {
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
            'Adults',
            'Children',
            'Total Attending',
            'Ticket Status',
            'Member Email'
          ]);
          logSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#f59e0b');
        }

        logSheet.appendRow([
          new Date(),
          ticketCode,
          memberName,
          queryInput,
          membershipType,
          adults,
          children,
          totalAttending,
          'CONFIRMED (FREE MEMBER PASS)',
          memberEmail || 'N/A'
        ]);
      } catch(e) {
        console.warn('Logging error:', e);
      }
    }

    // Auto Dispatch Email to Member
    if (memberEmail && memberEmail.includes('@')) {
      const emailRes = sendEmailTicketToUser(ticketCode, memberName, memberEmail, adults, children, membershipType);
      if (emailRes && emailRes.success) emailSent = true;
    }

    // Send Admin Notification
    if (BATHUKAMMA_CONFIG.utaAdminEmail) {
      try {
        const adminHtml = `
          <div style="font-family: Arial, sans-serif; padding: 18px; border: 2px solid #f59e0b; border-radius: 10px; background-color: #fcfbf7;">
            <h3 style="color: #d97706; margin-top: 0;">🎟️ [UTA Admin Alert] New Bathukamma Ticket Pass Issued</h3>
            <p><strong>Member Name:</strong> ${memberName}</p>
            <p><strong>Membership Category:</strong> ${membershipType}</p>
            <p><strong>Ticket Code:</strong> <code style="font-size: 16px; background-color: #fef3c7; padding: 4px 8px; border-radius: 4px; color: #92400e;">${ticketCode}</code></p>
            <p><strong>Attending Headcount:</strong> ${totalAttending} Persons (${adults} Adults, ${children} Children)</p>
            <p><strong>Member Email:</strong> ${memberEmail || 'Not provided'}</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          </div>
        `;
        MailApp.sendEmail({
          to: BATHUKAMMA_CONFIG.utaAdminEmail,
          subject: `[UTA Admin Alert] Ticket ${ticketCode} - ${memberName} (${totalAttending} Attending)`,
          htmlBody: adminHtml
        });
      } catch(e) {}
    }

    return {
      success: true,
      ticketCode: ticketCode,
      memberName: memberName,
      membershipType: membershipType,
      adults: adults,
      children: children,
      totalAttending: totalAttending,
      emailSent: emailSent,
      memberEmail: memberEmail
    };
  } catch(err) {
    return { success: false, message: 'Failed to issue ticket: ' + err.toString() };
  }
}

function sendEmailTicketToUser(ticketCode, memberName, emailAddress, adultsCount, childrenCount, category) {
  try {
    const cleanEmail = String(emailAddress || '').trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please provide a valid email address.' };
    }

    const adults = parseInt(adultsCount || 1, 10);
    const children = parseInt(childrenCount || 0, 10);
    const total = adults + children;
    const catStr = category || 'UTA Member';

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
          <div style="color: #06d6a0; font-size: 14px; font-weight: bold; margin-top: 6px;">✓ Confirmed Member Ticket • ${catStr}</div>
          <div style="color: #fbbf24; font-size: 15px; font-weight: 700; margin-top: 6px;">👨‍传播 Total Attending: ${total} Guests (${adults} Adults, ${children} Children)</div>
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
      subject: `🎟️ Your Bathukamma 2026 Ticket Pass [${ticketCode}] (${total} Attending) - UTA`,
      htmlBody: memberHtml
    });

    return { success: true, message: `Ticket pass successfully sent to ${cleanEmail}` };
  } catch (err) {
    return { success: false, message: 'Failed to dispatch email: ' + err.toString() };
  }
}

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
        const isActiveFor2026 = (yearKey === '2026') || match.isLifetime;

        let memberTypeStr = 'UTA Member';
        if (match.isLifetime) {
          memberTypeStr = 'UTA Lifetime Member';
        } else {
          memberTypeStr = `${yearKey} Annual Member`;
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
          statusMessage: isActiveFor2026 
            ? 'Active for 2026' 
            : `Membership record found (${memberTypeStr}), but NOT ACTIVE for the year 2026.`,
          buyTicketUrl: BATHUKAMMA_CONFIG.buyTicketUrl,
          renewUrl: BATHUKAMMA_CONFIG.renewMembershipUrl
        };
      }
    }

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

function getAdminDashboardData(adminPin) {
  try {
    const cleanPin = String(adminPin || '').trim();
    if (cleanPin !== (BATHUKAMMA_CONFIG.adminPin || 'UTA2026Admin')) {
      return { success: false, message: 'Invalid Admin PIN. Access Denied.' };
    }

    if (!BATHUKAMMA_CONFIG.masterSpreadsheetId) {
      return { success: false, message: 'Master Spreadsheet ID missing.' };
    }

    const ss = SpreadsheetApp.openById(BATHUKAMMA_CONFIG.masterSpreadsheetId);
    let logSheet = ss.getSheetByName(BATHUKAMMA_CONFIG.rsvpLogSheetName);

    if (!logSheet) {
      return { success: true, totalIssued: 0, totalAttending: 0, totalAdults: 0, totalChildren: 0, familyCount: 0, singleCount: 0, rows: [] };
    }

    const data = logSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: true, totalIssued: 0, totalAttending: 0, totalAdults: 0, totalChildren: 0, familyCount: 0, singleCount: 0, rows: [] };
    }

    let totalAttending = 0;
    let totalAdults = 0;
    let totalChildren = 0;
    let familyCount = 0;
    let singleCount = 0;

    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      
      let adults = 1;
      let children = 0;
      let total = 1;

      if (r.length >= 10) {
        adults = parseInt(r[5] || 1, 10);
        children = parseInt(r[6] || 0, 10);
        total = parseInt(r[7] || (adults + children), 10);
      } else {
        total = 1;
      }

      totalAttending += total;
      totalAdults += adults;
      totalChildren += children;

      const cat = String(r[4] || '');
      if (isFamilyMembership_(cat)) familyCount++; else singleCount++;

      rows.push({
        timestamp: r[0] instanceof Date ? formatDate_(r[0]) : String(r[0] || ''),
        ticketCode: String(r[1] || ''),
        memberName: String(r[2] || ''),
        identifier: String(r[3] || ''),
        category: cat,
        adults: adults,
        children: children,
        totalAttending: total,
        status: String(r[r.length >= 10 ? 8 : 5] || 'CONFIRMED'),
        email: String(r[r.length >= 10 ? 9 : 6] || '')
      });
    }

    return {
      success: true,
      totalIssued: rows.length,
      totalAttending: totalAttending,
      totalAdults: totalAdults,
      totalChildren: totalChildren,
      familyCount: familyCount,
      singleCount: singleCount,
      rows: rows.reverse()
    };
  } catch (err) {
    return { success: false, message: 'Error retrieving admin log: ' + err.toString() };
  }
}

function normalizePhoneDigits_(str) {
  const digits = String(str || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits.substring(1);
  return digits;
}

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

    if (nameCol === -1) nameCol = 0;

    const isLifetimeTab = yearKey.toLowerCase().includes('lifetime');

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      const nameVal = nameCol !== -1 ? String(row[nameCol] || '').trim() : '';
      const emailVal = emailCol !== -1 ? String(row[emailCol] || '').trim() : '';
      const phoneVal = phoneCol !== -1 ? String(row[phoneCol] || '').trim() : '';
      const typeVal = typeCol !== -1 ? String(row[typeCol] || '').trim() : '';
      const dateVal = dateCol !== -1 ? row[dateCol] : '';

      const cleanEmail = emailVal.toLowerCase();
      const rowPhoneDigits = normalizePhoneDigits_(phoneVal);

      let isMatch = false;

      if (cleanEmail && cleanQuery.includes('@') && cleanEmail === cleanQuery) {
        isMatch = true;
      } else if (phoneDigits && rowPhoneDigits && rowPhoneDigits === phoneDigits) {
        isMatch = true;
      } else if (cleanQuery && nameVal.toLowerCase().includes(cleanQuery)) {
        isMatch = true;
      }

      if (isMatch) {
        return {
          found: true,
          memberName: nameVal || 'UTA Member',
          email: emailVal,
          phone: phoneVal,
          membershipType: typeVal || (isLifetimeTab ? 'UTA Lifetime Member' : `UTA ${yearKey} Annual Member`),
          purchaseDate: dateVal instanceof Date ? formatDate_(dateVal) : String(dateVal || 'On File'),
          isLifetime: isLifetimeTab || typeVal.toLowerCase().includes('lifetime')
        };
      }
    }
  } catch(e) {}

  return { found: false };
}

function formatDate_(d) {
  try {
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Denver', 'MMM dd, yyyy HH:mm');
  } catch(e) {
    return String(d);
  }
}
