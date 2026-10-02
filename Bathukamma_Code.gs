// UTA Bathukamma 2026 - Master Google Apps Script Backend
// Provides Member Verification, RSVP Management, Ticket Generation, Auto-Emailing & Admin Analytics

const BATHUKAMMA_CONFIG = {
  masterSpreadsheetId: "1D2HD41kUJ6BC3K6_66efwNP_tOi10PTvjEC8wQI6liw", // Master Member Spreadsheet ID
  rsvpLogSheetName: "Bathukamma_RSVP_Log",                           // RSVP Log Tab Name
  adminPin: "UTA2026Admin",                                            // Admin Password
  utaAdminEmail: "utahteluguassociation@gmail.com",                  // Admin Notification Email
  buyTicketUrl: "https://forms.gle/rb621mkJ4FzXvSib7",
  renewMembershipUrl: "https://utahtelugu.org/membership",
  joinMembershipUrl: "https://utahtelugu.org/join"
};

function testSearchMember() {
  const testInput = "parasaajaykumar@gmail.com";
  const result = checkMembershipStatus(testInput);
  Logger.log("Test Search Result: " + JSON.stringify(result, null, 2));
}

function authorizeMailPermissionsTest() {
  try {
    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail() || BATHUKAMMA_CONFIG.utaAdminEmail,
      subject: "[UTA System] MailApp Permissions Authorization Test",
      body: "Authorization test successful! MailApp is enabled for UTA Bathukamma RSVP portal."
    });
    Logger.log("Authorization email sent successfully!");
  } catch(e) {
    Logger.log("Authorization error: " + e.toString());
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e.parameter);
  }
  return HtmlService.createHtmlOutputFromFile("Bathukamma_Index")
    .setTitle("Bathukamma 2026 - UTA Member RSVP & Admin Portal")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
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
  let result = { success: false, message: "Invalid action: " + action };

  try {
    if (action === "verifyMemberAndIssueRSVP" || action === "verify") {
      const query = params.query || params.q || "";
      result = verifyMemberAndIssueRSVP(query);
    } else if (action === "confirmAndIssueTicket" || action === "confirmTicket") {
      result = confirmAndIssueTicket(params);
    } else if (action === "getAdminDashboardData" || action === "admin") {
      const pin = params.pin || params.password || "";
      result = getAdminDashboardData(pin);
    } else if (action === "clearRsvpLogTab" || action === "clearLog") {
      const pin = params.pin || params.password || "";
      result = clearRsvpLogTab(pin);
    } else if (action === "sendEmailTicketToUser" || action === "sendEmail") {
      const ticketCode = params.ticketCode || "";
      const memberName = params.memberName || "";
      const email = params.email || "";
      const adults = parseInt(params.adults || 1, 10);
      const children = parseInt(params.children || 0, 10);
      const category = params.category || "UTA Member";
      result = sendEmailTicketToUser(ticketCode, memberName, email, adults, children, category);
    }
  } catch (error) {
    result = { success: false, message: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function findExistingRSVPLogEntry_(ss, searchInput, memberName, email) {
  try {
    if (!ss) return { found: false };
    const logSheet = ss.getSheetByName(BATHUKAMMA_CONFIG.rsvpLogSheetName);
    if (!logSheet) return { found: false };

    const data = logSheet.getDataRange().getValues();
    if (data.length <= 1) return { found: false };

    const cleanInput = String(searchInput || "").toLowerCase().trim();
    const phoneInput = normalizePhoneDigits_(searchInput);
    const cleanEmail = String(email || "").toLowerCase().trim();
    const cleanName = String(memberName || "").toLowerCase().trim();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const rowTicket = String(row[1] || "").trim();
      const rowName = String(row[2] || "").toLowerCase().trim();
      const rowIdentifier = String(row[3] || "").toLowerCase().trim();
      const rowPhone = normalizePhoneDigits_(rowIdentifier);
      const rowCategory = String(row[4] || "");
      const rowAdults = parseInt(row[5] || 1, 10);
      const rowChildren = parseInt(row[6] || 0, 10);
      const rowTotal = parseInt(row[7] || (rowAdults + rowChildren), 10);
      const rowStatus = String(row[8] || "CONFIRMED");
      const rowEmail = String(row[9] || "").toLowerCase().trim();

      let isMatch = false;

      if (cleanInput && rowTicket.toLowerCase() === cleanInput) isMatch = true;
      if (!isMatch && cleanInput && rowIdentifier && (rowIdentifier.includes(cleanInput) || cleanInput.includes(rowIdentifier))) isMatch = true;
      if (!isMatch && phoneInput && phoneInput.length >= 7 && rowPhone && rowPhone.includes(phoneInput)) isMatch = true;
      if (!isMatch && cleanEmail && rowEmail && rowEmail === cleanEmail) isMatch = true;
      if (!isMatch && cleanName && cleanName.length > 3 && rowName && (rowName === cleanName || rowName.includes(cleanName) || cleanName.includes(rowName))) isMatch = true;

      if (isMatch) {
        return {
          found: true,
          rowIndex: i + 1,
          ticketCode: rowTicket,
          memberName: row[2] || memberName,
          identifier: row[3] || searchInput,
          category: rowCategory,
          adults: isNaN(rowAdults) || rowAdults < 1 ? 1 : rowAdults,
          children: isNaN(rowChildren) || rowChildren < 0 ? 0 : rowChildren,
          totalAttending: isNaN(rowTotal) || rowTotal < 1 ? 1 : rowTotal,
          status: rowStatus,
          email: row[9] || email
        };
      }
    }
  } catch (e) {
    console.warn("findExistingRSVPLogEntry_ error:", e);
  }
  return { found: false };
}

function verifyMemberAndIssueRSVP(inputQuery) {
  try {
    const res = checkMembershipStatus(inputQuery);
    if (!res.ok) {
      return { success: false, message: res.error || "Verification error." };
    }

    if (res.found && res.active) {
      const isFamily = isFamilyMembership_(res.membershipType);
      const memberName = res.memberName || "UTA Member";
      const memberEmail = res.email || (inputQuery.includes("@") ? inputQuery : "");

      let existingLog = { found: false };
      if (BATHUKAMMA_CONFIG.masterSpreadsheetId) {
        try {
          const ss = SpreadsheetApp.openById(BATHUKAMMA_CONFIG.masterSpreadsheetId);
          existingLog = findExistingRSVPLogEntry_(ss, inputQuery, memberName, memberEmail);
        } catch(e) {}
      }

      if (existingLog.found) {
        return {
          success: true,
          status: "ACTIVE",
          alreadyIssued: true,
          ticketCode: existingLog.ticketCode,
          data: {
            queryInput: inputQuery,
            memberName: existingLog.memberName || memberName,
            memberId: res.memberId || ("UTA-2026-" + Math.floor(1000 + Math.random() * 9000)),
            membershipType: existingLog.category || res.membershipType || "UTA Member",
            isFamily: isFamily,
            suggestedAdults: existingLog.adults || (isFamily ? 2 : 1),
            suggestedChildren: existingLog.children || 0,
            alreadyIssued: true,
            existingTicketCode: existingLog.ticketCode,
            existingAdults: existingLog.adults,
            existingChildren: existingLog.children,
            existingTotal: existingLog.totalAttending,
            email: existingLog.email || memberEmail,
            lastActiveYear: "2026"
          }
        };
      }

      return {
        success: true,
        status: "ACTIVE",
        alreadyIssued: false,
        data: {
          queryInput: inputQuery,
          memberName: memberName,
          memberId: res.memberId || ("UTA-2026-" + Math.floor(1000 + Math.random() * 9000)),
          membershipType: res.membershipType || "UTA Member",
          isFamily: isFamily,
          suggestedAdults: isFamily ? 2 : 1,
          suggestedChildren: 0,
          alreadyIssued: false,
          email: memberEmail,
          lastActiveYear: "2026"
        }
      };
    } else if (res.found && !res.active) {
      return {
        success: true,
        status: "EXPIRED",
        data: {
          memberName: res.memberName || "UTA Member",
          memberId: res.memberId || "UTA-EXP",
          membershipType: res.membershipType || "Expired Member",
          lastActiveYear: res.recordYear || "2024/2025"
        }
      };
    } else {
      return {
        success: true,
        status: "NOT_FOUND",
        data: {}
      };
    }
  } catch (err) {
    return { success: false, message: "Server exception: " + err.toString() };
  }
}

function isFamilyMembership_(categoryStr) {
  if (!categoryStr) return true;
  const cat = String(categoryStr).toLowerCase();
  if (cat.includes("single") || cat.includes("individual") || cat.includes("student")) {
    return false;
  }
  return true;
}

function confirmAndIssueTicket(params) {
  try {
    const queryInput = String(params.queryInput || params.query || "").trim();
    const memberName = String(params.memberName || "UTA Member").trim();
    const membershipType = String(params.membershipType || "UTA Member").trim();
    const memberEmail = String(params.email || params.memberEmail || "").trim();
    const adults = Math.max(1, parseInt(params.adults || 1, 10));
    const children = Math.max(0, parseInt(params.children || 0, 10));
    const totalAttending = adults + children;

    let ticketCode = "";
    let isUpdate = false;
    let emailSent = false;

    if (BATHUKAMMA_CONFIG.masterSpreadsheetId) {
      try {
        const ss = SpreadsheetApp.openById(BATHUKAMMA_CONFIG.masterSpreadsheetId);
        let logSheet = ss.getSheetByName(BATHUKAMMA_CONFIG.rsvpLogSheetName);
        if (!logSheet) {
          logSheet = ss.insertSheet(BATHUKAMMA_CONFIG.rsvpLogSheetName);
          logSheet.appendRow([
            "Timestamp",
            "Ticket Code",
            "Member Name",
            "Identifier Used",
            "Membership Category",
            "Adults",
            "Children",
            "Total Attending",
            "Ticket Status",
            "Member Email"
          ]);
          logSheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#f59e0b");
        }

        const existing = findExistingRSVPLogEntry_(ss, queryInput, memberName, memberEmail);
        if (existing.found && existing.ticketCode) {
          ticketCode = existing.ticketCode;
          isUpdate = true;
          logSheet.getRange(existing.rowIndex, 1, 1, 10).setValues([[
            new Date(),
            ticketCode,
            memberName,
            queryInput || existing.identifier,
            membershipType,
            adults,
            children,
            totalAttending,
            "CONFIRMED (UPDATED PASS)",
            memberEmail || existing.email || "N/A"
          ]]);
        } else {
          ticketCode = "BK2026-" + Math.floor(100000 + Math.random() * 900000);
          logSheet.appendRow([
            new Date(),
            ticketCode,
            memberName,
            queryInput,
            membershipType,
            adults,
            children,
            totalAttending,
            "CONFIRMED (FREE MEMBER PASS)",
            memberEmail || "N/A"
          ]);
        }
      } catch(e) {
        console.warn("Logging error:", e);
        if (!ticketCode) ticketCode = "BK2026-" + Math.floor(100000 + Math.random() * 900000);
      }
    } else {
      ticketCode = "BK2026-" + Math.floor(100000 + Math.random() * 900000);
    }

    if (memberEmail && memberEmail.includes("@")) {
      const emailRes = sendEmailTicketToUser(ticketCode, memberName, memberEmail, adults, children, membershipType);
      if (emailRes && emailRes.success) emailSent = true;
    }

    if (BATHUKAMMA_CONFIG.utaAdminEmail) {
      try {
        const adminHtml = `
          <div style="font-family: Arial, sans-serif; padding: 18px; border: 2px solid #f59e0b; border-radius: 10px; background-color: #fcfbf7;">
            <h3 style="color: #d97706; margin-top: 0;">🎟️ [UTA Admin Alert] ${isUpdate ? "Ticket Headcount Updated" : "New Ticket Pass Issued"}</h3>
            <p><strong>Member Name:</strong> ${memberName}</p>
            <p><strong>Membership Category:</strong> ${membershipType}</p>
            <p><strong>Ticket Code:</strong> <code style="font-size: 16px; background-color: #fef3c7; padding: 4px 8px; border-radius: 4px; color: #92400e;">${ticketCode}</code></p>
            <p><strong>Attending Headcount:</strong> ${totalAttending} Persons (${adults} Adults, ${children} Children)</p>
            <p><strong>Member Email:</strong> ${memberEmail || "Not provided"}</p>
            <p><strong>Status:</strong> ${isUpdate ? "Updated Existing Record" : "New Entry"}</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          </div>
        `;
        MailApp.sendEmail({
          to: BATHUKAMMA_CONFIG.utaAdminEmail,
          subject: `[UTA Admin Alert] ${isUpdate ? "UPDATED" : "NEW"} Ticket ${ticketCode} - ${memberName} (${totalAttending} Attending)`,
          htmlBody: adminHtml
        });
      } catch(e) {}
    }

    return {
      success: true,
      ticketCode: ticketCode,
      isUpdate: isUpdate,
      memberName: memberName,
      membershipType: membershipType,
      adults: adults,
      children: children,
      totalAttending: totalAttending,
      emailSent: emailSent,
      memberEmail: memberEmail
    };
  } catch(err) {
    return { success: false, message: "Failed to issue ticket: " + err.toString() };
  }
}

function sendEmailTicketToUser(ticketCode, memberName, email, adults, children, category) {
  try {
    if (!email || !email.includes("@")) {
      return { success: false, message: "No valid recipient email address provided." };
    }

    const adultCount = parseInt(adults || 1, 10);
    const kidCount = parseInt(children || 0, 10);
    const totalCount = adultCount + kidCount;

    const subject = `🎟️ Your Official UTA Bathukamma 2026 Ticket Pass [${ticketCode}]`;
    const htmlBody = `
      <div style="max-width: 600px; margin: 0 auto; background: #06281c; color: #ffffff; font-family: Arial, sans-serif; padding: 24px; border-radius: 12px; border: 2px solid #f59e0b;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #fbbf24; margin: 0; font-size: 24px;">UTAH TELUGU ASSOCIATION</h2>
          <h3 style="color: #ea580c; margin: 5px 0 0 0; font-size: 20px;">BATHUKAMMA 2026 • OFFICIAL MEMBER PASS</h3>
        </div>
        <div style="background: rgba(245, 158, 11, 0.12); padding: 20px; border-radius: 10px; border: 1px dashed #f59e0b; margin-bottom: 20px;">
          <p style="margin: 5px 0; font-size: 16px;"><strong>Member Name:</strong> ${memberName}</p>
          <p style="margin: 5px 0; font-size: 16px;"><strong>Membership Category:</strong> ${category}</p>
          <p style="margin: 5px 0; font-size: 16px;"><strong>Total Attending:</strong> <span style="color:#10b981; font-weight:bold;">${totalCount} Persons</span> (${adultCount} Adults, ${kidCount} Children)</p>
          <div style="margin-top: 15px; text-align: center; background: #000000; padding: 12px; border-radius: 8px;">
            <span style="color: #94a3b8; font-size: 12px; display: block;">TICKET CODE</span>
            <span style="color: #fbbf24; font-size: 26px; font-weight: bold; letter-spacing: 2px;">${ticketCode}</span>
          </div>
        </div>
        <div style="background: #0d3b2b; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; line-height: 1.5;">
          <p style="margin: 0 0 8px 0; color: #fbbf24; font-weight: bold;">📍 Event & Check-In Instructions:</p>
          <ul style="margin: 0; padding-left: 20px; color: #e2e8f0;">
            <li>Present this ticket pass (digital or printed) at the UTA Member Fast-Track Check-in desk.</li>
            <li>Free admission is valid for verified active 2026 UTA Members and their registered immediate family.</li>
            <li>For questions or updates, email <a href="mailto:utahteluguassociation@gmail.com" style="color: #fbbf24;">utahteluguassociation@gmail.com</a>.</li>
          </ul>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin: 0;">Utah Telugu Association © 2026 | Celebrating Culture & Community</p>
      </div>
    `;

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody
    });

    return { success: true, message: "Ticket email dispatched successfully to " + email };
  } catch (err) {
    return { success: false, message: "MailApp Error: " + err.toString() };
  }
}

function getAdminDashboardData(adminPin) {
  try {
    const cleanPin = String(adminPin || "").trim();
    if (cleanPin !== (BATHUKAMMA_CONFIG.adminPin || "UTA2026Admin")) {
      return { success: false, message: "Invalid Admin PIN. Access Denied." };
    }

    if (!BATHUKAMMA_CONFIG.masterSpreadsheetId) {
      return { success: false, message: "Master Spreadsheet ID missing." };
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
      if (!r || r.length < 2 || !r[1]) continue;

      let adults = 1;
      let children = 0;
      let total = 1;

      if (r.length >= 10) {
        let pAdults = parseInt(r[5], 10);
        let pChildren = parseInt(r[6], 10);
        let pTotal = parseInt(r[7], 10);

        adults = isNaN(pAdults) || pAdults < 1 ? 1 : pAdults;
        children = isNaN(pChildren) || pChildren < 0 ? 0 : pChildren;
        total = isNaN(pTotal) || pTotal < 1 ? (adults + children) : pTotal;
      } else {
        adults = 1;
        children = 0;
        total = 1;
      }

      totalAttending += total;
      totalAdults += adults;
      totalChildren += children;

      const cat = String(r[4] || "UTA Member");
      if (isFamilyMembership_(cat)) familyCount++; else singleCount++;

      rows.push({
        timestamp: r[0] instanceof Date ? formatDate_(r[0]) : String(r[0] || ""),
        ticketCode: String(r[1] || ""),
        memberName: String(r[2] || ""),
        identifier: String(r[3] || ""),
        category: cat,
        adults: adults,
        children: children,
        totalAttending: total,
        status: String(r[r.length >= 10 ? 8 : 5] || "CONFIRMED"),
        email: String(r[r.length >= 10 ? 9 : 6] || "")
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
    return { success: false, message: "Error retrieving admin log: " + err.toString() };
  }
}

function checkMembershipStatus(inputQuery) {
  try {
    const rawQuery = String(inputQuery || "").trim();
    if (!rawQuery) {
      return { ok: false, error: "Please enter an email, phone number, or Member ID/Name." };
    }

    const cleanQuery = rawQuery.toLowerCase();
    const phoneDigits = normalizePhoneDigits_(rawQuery);

    if (!BATHUKAMMA_CONFIG.masterSpreadsheetId) {
      return { ok: false, error: "Master Spreadsheet ID is not configured." };
    }

    const masterSs = SpreadsheetApp.openById(BATHUKAMMA_CONFIG.masterSpreadsheetId);
    const sheets = masterSs.getSheets();

    let allMatches = [];

    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];
      const tabName = sheet.getName();

      if (tabName.toLowerCase() === BATHUKAMMA_CONFIG.rsvpLogSheetName.toLowerCase()) continue;

      const match = searchSheetTabForMember_(sheet, cleanQuery, phoneDigits, rawQuery);
      if (match.found) {
        const isLifetime = match.isLifetime || tabName.toLowerCase().includes("life");
        const isActiveFor2026 = tabName.toLowerCase().includes("2026") || isLifetime;

        let memberTypeStr = match.membershipType;
        if (!memberTypeStr || memberTypeStr === "UTA Member") {
          memberTypeStr = isLifetime ? "UTA Lifetime Member" : `UTA ${tabName} Member`;
        }

        const matchResult = {
          ok: true,
          found: true,
          active: isActiveFor2026,
          memberName: match.memberName || "UTA Member",
          membershipType: memberTypeStr,
          purchaseDate: match.purchaseDate || "Recorded on File",
          recordYear: tabName,
          isLifetime: isLifetime,
          email: match.email || (rawQuery.includes("@") ? rawQuery : ""),
          phone: match.phone || "",
          statusMessage: isActiveFor2026
            ? "Active for 2026"
            : `Membership record found (${memberTypeStr}), but NOT ACTIVE for the year 2026.`,
          buyTicketUrl: BATHUKAMMA_CONFIG.buyTicketUrl,
          renewUrl: BATHUKAMMA_CONFIG.renewMembershipUrl
        };

        allMatches.push(matchResult);

        if (isActiveFor2026) {
          return matchResult;
        }
      }
    }

    if (allMatches.length > 0) {
      return allMatches[0];
    }

    return {
      ok: true,
      found: false,
      active: false,
      statusMessage: "No membership record found in our database.",
      joinUrl: BATHUKAMMA_CONFIG.joinMembershipUrl,
      buyTicketUrl: BATHUKAMMA_CONFIG.buyTicketUrl
    };

  } catch (err) {
    return { ok: false, error: "Verification system error: " + err.toString() };
  }
}

function searchSheetTabForMember_(sheet, cleanQuery, phoneDigits, rawQuery) {
  try {
    const tabName = sheet.getName();
    const data = sheet.getDataRange().getDisplayValues();
    if (data.length <= 1) return { found: false };

    const headers = data[0].map(h => String(h || "").toLowerCase().trim());

    let nameCols = [];
    let emailCols = [];
    let phoneCols = [];
    let typeCols = [];
    let dateCols = [];

    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (h.includes("name") || h.includes("member") || h.includes("primary") || h.includes("person") || h.includes("first") || h.includes("last")) nameCols.push(c);
      if (h.includes("email") || h.includes("mail")) emailCols.push(c);
      if (h.includes("phone") || h.includes("mobile") || h.includes("cell") || h.includes("contact") || h.includes("number") || h.includes("tel")) phoneCols.push(c);
      if (h.includes("type") || h.includes("membership") || h.includes("category") || h.includes("plan") || h.includes("tier") || h.includes("status")) typeCols.push(c);
      if (h.includes("timestamp") || h.includes("date") || h.includes("time") || h.includes("year")) dateCols.push(c);
    }

    const isLifetimeTab = tabName.toLowerCase().includes("life") || tabName.toLowerCase().includes("lt");

    for (let r = 1; r < data.length; r++) {
      const row = data[r];

      let nameParts = [];
      nameCols.forEach(c => {
        const val = String(row[c] || "").trim();
        if (val) nameParts.push(val);
      });
      let fullNameStr = nameParts.join(" ").trim();
      if (!fullNameStr && row.length > 0) {
        fullNameStr = String(row[0] || "").trim();
      }

      let emailVal = "";
      emailCols.forEach(c => {
        const val = String(row[c] || "").trim();
        if (val && val.includes("@")) emailVal = val;
      });

      let phoneVal = "";
      phoneCols.forEach(c => {
        const val = String(row[c] || "").trim();
        if (val && normalizePhoneDigits_(val).length >= 7) phoneVal = val;
      });

      let typeVal = "";
      typeCols.forEach(c => {
        const val = String(row[c] || "").trim();
        if (val) typeVal = val;
      });

      let dateVal = dateCols.length > 0 ? row[dateCols[0]] : "";

      const rowTextParts = row.map(cell => String(cell || "").toLowerCase().trim());
      const rowText = rowTextParts.join(" ");

      const cleanEmail = emailVal.toLowerCase();
      const rowPhoneDigits = normalizePhoneDigits_(phoneVal || rowText);

      let isMatch = false;

      if (cleanQuery.includes("@")) {
        if (cleanEmail && (cleanEmail === cleanQuery || cleanEmail.includes(cleanQuery) || cleanQuery.includes(cleanEmail))) {
          isMatch = true;
        } else if (rowText.includes(cleanQuery)) {
          isMatch = true;
        }
      }
      else if (phoneDigits && phoneDigits.length >= 7 && rowPhoneDigits.includes(phoneDigits)) {
        isMatch = true;
      }
      else if (cleanQuery && cleanQuery.length >= 2) {
        if (fullNameStr && fullNameStr.toLowerCase().includes(cleanQuery)) {
          isMatch = true;
        } else {
          const queryWords = cleanQuery.split(/\s+/).filter(w => w.length >= 2);
          if (queryWords.length > 0 && queryWords.every(w => rowText.includes(w))) {
            isMatch = true;
          }
        }
      }

      if (isMatch) {
        const isLifetimeRow = isLifetimeTab || typeVal.toLowerCase().includes("life") || rowText.includes("lifetime") || rowText.includes("life time") || rowText.includes("lt member");

        return {
          found: true,
          memberName: fullNameStr || String(row[0] || "UTA Member"),
          email: emailVal || (cleanQuery.includes("@") ? cleanQuery : ""),
          phone: phoneVal,
          membershipType: typeVal || (isLifetimeRow ? "UTA Lifetime Member" : `UTA ${tabName} Member`),
          purchaseDate: String(dateVal || "On File"),
          isLifetime: isLifetimeRow
        };
      }
    }
  } catch(e) {
    console.warn("Error searching tab " + sheet.getName() + ":", e);
  }

  return { found: false };
}

function normalizePhoneDigits_(str) {
  if (!str) return "";
  return String(str).replace(/\D/g, "");
}

function formatDate_(dateObj) {
  try {
    return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "MMM dd, yyyy HH:mm");
  } catch (e) {
    return String(dateObj);
  }
}


function clearRsvpLogTab(adminPin) {
  try {
    const cleanPin = String(adminPin || "").trim();
    if (cleanPin !== (BATHUKAMMA_CONFIG.adminPin || "UTA2026Admin")) {
      return { success: false, message: "Invalid Admin PIN. Access Denied." };
    }

    if (!BATHUKAMMA_CONFIG.masterSpreadsheetId) {
      return { success: false, message: "Master Spreadsheet ID missing." };
    }

    const ss = SpreadsheetApp.openById(BATHUKAMMA_CONFIG.masterSpreadsheetId);
    let logSheet = ss.getSheetByName(BATHUKAMMA_CONFIG.rsvpLogSheetName);

    if (!logSheet) {
      return { success: true, message: "RSVP Log sheet does not exist or is already clean." };
    }

    const lastRow = logSheet.getLastRow();
    if (lastRow > 1) {
      logSheet.deleteRows(2, lastRow - 1);
    }

    return {
      success: true,
      message: `Cleared ${lastRow - 1} RSVP log entries cleanly.`
    };
  } catch (err) {
    return { success: false, message: "Error clearing RSVP log: " + err.toString() };
  }
}