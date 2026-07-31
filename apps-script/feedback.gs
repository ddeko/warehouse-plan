/**
 * Feedback sink for StoreSpace.
 *
 * The app is a static bundle with no server of its own, so this web app is the
 * only thing holding write access to the sheet. It appends one row per
 * submission and never reads anything back out.
 *
 * Deploy:
 *   1. Open the spreadsheet → Extensions → Apps Script.
 *   2. Replace Code.gs with this file and save.
 *   3. Deploy → New deployment → type "Web app".
 *        Execute as:       Me
 *        Who has access:   Anyone            ← must be "Anyone", not "Anyone with Google account"
 *   4. Authorise when prompted, then copy the /exec URL.
 *   5. Put that URL in VITE_FEEDBACK_URL (locally in .env, and in the Vercel
 *      project's environment variables) and redeploy the app.
 *
 * Editing this file later needs Deploy → Manage deployments → edit → New
 * version, otherwise the live URL keeps serving the old code.
 */

var SHEET_ID = '1hNkfeEaDR9Dps7-GrXIFWQnc6DBQxzqW7_Db53o7jlQ'
var TAB_NAME = 'Feedback'
var HEADERS = ['Received', 'Type', 'Message', 'Email', 'Page', 'User agent']

/** Cheap guards. The URL is public, so anyone who finds it can post to it. */
var MAX_MESSAGE = 4000
var MAX_FIELD = 300

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}')

    var message = trim(body.message, MAX_MESSAGE)
    if (!message) return json({ ok: false, error: 'Empty message.' })

    sheet().appendRow([
      new Date(),
      trim(body.kind, 40) || 'other',
      message,
      trim(body.email, MAX_FIELD),
      trim(body.page, MAX_FIELD),
      trim(body.userAgent, MAX_FIELD),
    ])

    return json({ ok: true })
  } catch (err) {
    return json({ ok: false, error: String(err) })
  }
}

/** Visiting the /exec URL in a browser confirms the deployment is live. */
function doGet() {
  return json({ ok: true, service: 'storespace-feedback' })
}

function sheet() {
  var ss = SpreadsheetApp.openById(SHEET_ID)
  var sh = ss.getSheetByName(TAB_NAME)
  if (!sh) {
    sh = ss.insertSheet(TAB_NAME)
    sh.appendRow(HEADERS)
    sh.setFrozenRows(1)
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold')
    sh.setColumnWidth(3, 480)
  }
  return sh
}

function trim(v, max) {
  return String(v == null ? '' : v).slice(0, max).trim()
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
