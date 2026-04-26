/**
 * YYNails — Google Apps Script booking backend (approval flow)
 *
 * DEPLOY STEPS:
 *  1. Paste this file into script.google.com
 *  2. Project Settings → Time zone: Australia/Sydney
 *  3. Deploy → New deployment → Web app (Execute as: Me, Who: Anyone)
 *  4. Copy the web app URL, paste it into SCRIPT_URL below
 *  5. Deploy again as a new version
 */

var CALENDAR_ID = 'yvonne161020@gmail.com';
var OWNER_EMAIL = 'yvonne161020@gmail.com';
var SCRIPT_URL  = 'https://script.google.com/macros/s/AKfycbzPptVRUu-YcR5SiH7ylS6oGILudAiMQSihpC_JtzQNFbYWD39Ru-ah7wAcEKJqCYFX/exec'; // paste your web app URL here
var OPEN_HOUR   = 9;
var CLOSE_HOUR  = 21;
var STEP_MIN    = 30;

function doGet(e) {
  var p = e.parameter;
  if (p.action === 'request') return json(handleRequest(p));
  if (p.action === 'confirm') return handleConfirm(p);
  if (p.action === 'decline') return handleDecline(p);
  return json({ slots: getSlots(p.date, Number(p.duration) || 90) });
}

function getSlots(dateStr, durationMin) {
  var cal   = CalendarApp.getCalendarById(CALENDAR_ID);
  var parts = dateStr.split('-').map(Number);
  var open  = new Date(parts[0], parts[1] - 1, parts[2], OPEN_HOUR,  0, 0);
  var close = new Date(parts[0], parts[1] - 1, parts[2], CLOSE_HOUR, 0, 0);
  var events = cal.getEvents(open, close);
  var busy   = events.map(function(ev) {
    return [ev.getStartTime().getTime(), ev.getEndTime().getTime()];
  });
  var durMs  = durationMin * 60000;
  var stepMs = STEP_MIN * 60000;
  var cutoff = Date.now() + 3600000;
  var slots  = [];
  for (var t = open.getTime(); t + durMs <= close.getTime(); t += stepMs) {
    if (t < cutoff) continue;
    var blocked = busy.some(function(b) { return t < b[1] && t + durMs > b[0]; });
    if (!blocked) {
      var dt = new Date(t);
      slots.push(pad(dt.getHours()) + ':' + pad(dt.getMinutes()));
    }
  }
  return slots;
}

function handleRequest(p) {
  var cal   = CalendarApp.getCalendarById(CALENDAR_ID);
  var dp    = p.date.split('-').map(Number);
  var tp    = p.time.split(':').map(Number);
  var start = new Date(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0);
  var end   = new Date(start.getTime() + Number(p.duration) * 60000);

  var desc = '⏳ Awaiting confirmation\n\n'
    + 'Service: ' + p.service + '\n'
    + 'Phone:   ' + p.phone   + '\n'
    + 'Email:   ' + p.email   + '\n'
    + (p.notes ? 'Notes:   ' + p.notes : '');

  // Create a PENDING event to block the slot — no guest yet
  var event = cal.createEvent('⏳ PENDING — ' + p.name, start, end, {
    description: desc,
    location: '7 Paddock Street, Lidcombe NSW 2141'
  });

  var eventId = event.getId();
  var dateStr = Utilities.formatDate(start, 'Australia/Sydney', 'EEEE d MMMM');
  var timeStr = Utilities.formatDate(start, 'Australia/Sydney', 'h:mm a');

  var base = '&eventId=' + encodeURIComponent(eventId)
    + '&name='    + encodeURIComponent(p.name)
    + '&email='   + encodeURIComponent(p.email)
    + '&service=' + encodeURIComponent(p.service)
    + '&phone='   + encodeURIComponent(p.phone)
    + '&date='    + encodeURIComponent(dateStr)
    + '&time='    + encodeURIComponent(timeStr);

  var confirmUrl = SCRIPT_URL + '?action=confirm' + base;
  var declineUrl = SCRIPT_URL + '?action=decline' + base;

  MailApp.sendEmail({
    to: OWNER_EMAIL,
    subject: '📅 Booking request — ' + p.name + ' · ' + dateStr + ' ' + timeStr,
    htmlBody:
      '<div style="font-family:sans-serif;max-width:480px;margin:0 auto">'
      + '<h2 style="color:#9d174d;margin:0 0 1rem">New booking request</h2>'
      + '<table style="border-collapse:collapse;width:100%">'
      + row('Name',    p.name)
      + row('Service', p.service)
      + row('Date',    dateStr)
      + row('Time',    timeStr)
      + row('Phone',   p.phone)
      + row('Email',   p.email)
      + (p.notes ? row('Notes', p.notes) : '')
      + '</table>'
      + '<div style="margin-top:1.75rem;display:flex;gap:12px">'
      + '<a href="' + confirmUrl + '" style="display:inline-block;background:#9d174d;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">✓ Accept</a>'
      + '<a href="' + declineUrl + '" style="display:inline-block;background:#6b7280;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold">✗ Decline</a>'
      + '</div></div>'
  });

  return { ok: true };
}

function handleConfirm(p) {
  try {
    var cal     = CalendarApp.getCalendarById(CALENDAR_ID);
    var pending = cal.getEventById(p.eventId);

    if (pending) {
      var start = pending.getStartTime();
      var end   = pending.getEndTime();
      pending.deleteEvent();

      // Recreate as confirmed event with guest + sendInvites — this reliably sends the calendar invite
      cal.createEvent('YYNails — ' + p.name, start, end, {
        description: 'Service: ' + p.service + '\nPhone: ' + p.phone,
        location: '7 Paddock Street, Lidcombe NSW 2141',
        guests: p.email,
        sendInvites: true
      });
    }

    MailApp.sendEmail({
      to: p.email,
      subject: 'Your YYNails appointment is confirmed!',
      body: 'Hi ' + p.name + ',\n\n'
        + 'Your appointment has been confirmed!\n\n'
        + 'Service:  ' + p.service + '\n'
        + 'Date:     ' + p.date    + '\n'
        + 'Time:     ' + p.time    + '\n'
        + 'Location: 7 Paddock Street, Lidcombe NSW 2141\n\n'
        + 'A calendar invitation has also been sent to this email.\n\n'
        + 'See you soon!\n'
        + 'YYNails · 0481 917 479'
    });
    return page('Confirmed ✓', 'Booking for ' + p.name + ' on ' + p.date + ' at ' + p.time + ' is confirmed. A calendar invite has been sent to the customer.');
  } catch (err) {
    return page('Error', err.message);
  }
}

function handleDecline(p) {
  try {
    var cal   = CalendarApp.getCalendarById(CALENDAR_ID);
    var event = cal.getEventById(p.eventId);
    if (event) event.deleteEvent();
    MailApp.sendEmail({
      to: p.email,
      subject: 'Your YYNails booking request',
      body: 'Hi ' + p.name + ',\n\n'
        + 'Unfortunately we\'re unable to confirm your booking for ' + p.date + ' at ' + p.time + '.\n\n'
        + 'Please call us on 0481 917 479 to arrange an alternative time.\n\n'
        + 'Sorry for the inconvenience.\n'
        + 'YYNails · 0481 917 479'
    });
    return page('Declined', 'The booking for ' + p.name + ' has been declined and the time slot released. The customer has been notified.');
  } catch (err) {
    return page('Error', err.message);
  }
}

// ---- Helpers ----

function row(label, value) {
  return '<tr>'
    + '<td style="padding:6px 16px 6px 0;font-weight:600;color:#57534e;white-space:nowrap">' + label + '</td>'
    + '<td style="padding:6px 0;color:#1a1714">' + value + '</td>'
    + '</tr>';
}

function page(title, message) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title>'
    + '<style>*{box-sizing:border-box}body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f1ea}'
    + '.c{background:#fff;border-radius:16px;padding:2.5rem 2rem;max-width:400px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.1)}'
    + 'h1{margin:0 0 .75rem;font-size:1.35rem;color:#1a1714}p{color:#57534e;margin:0;line-height:1.6}</style>'
    + '</head><body><div class="c"><h1>' + title + '</h1><p>' + message + '</p></div></body></html>'
  );
}

function pad(n) { return String(n).padStart(2, '0'); }

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
