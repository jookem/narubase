import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, ImageRun, SectionType, BorderStyle,
  TableRow, TableCell, Table, WidthType, ShadingType,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  convertInchesToTwip, UnderlineType,
} from 'docx'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const BRAND = '02508E'
const BRAND_LIGHT = 'E8F2FA'
const GRAY = '6B7280'
const DARK = '111827'
const WHITE = 'FFFFFF'

// Convert SVG logo to PNG
const svgBuffer = fs.readFileSync(path.join(ROOT, 'public/tlc_logo.svg'))
const logoPng = await sharp(svgBuffer)
  .resize(600, 250, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toBuffer()

// ─── Helpers ───────────────────────────────────────────────

function brand(text, opts = {}) {
  return new TextRun({ text, color: BRAND, ...opts })
}

function bold(text, opts = {}) {
  return new TextRun({ text, bold: true, ...opts })
}

function body(text, opts = {}) {
  return new TextRun({ text, color: DARK, size: 22, ...opts })
}

function para(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing: { after: 120 },
    ...opts,
  })
}

function heading1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: BRAND, size: 36 })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_LIGHT, space: 4 } },
  })
}

function heading2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: DARK, size: 26 })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
  })
}

function heading3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: BRAND, size: 23, italics: true })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
  })
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [body(text)],
    bullet: { level },
    spacing: { after: 80 },
  })
}

function divider() {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 } },
    spacing: { before: 200, after: 200 },
  })
}

function callout(label, text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: BRAND },
            children: [new Paragraph({
              children: [new TextRun({ text: label, bold: true, color: WHITE, size: 20 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
            })],
          }),
          new TableCell({
            width: { size: 85, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: BRAND_LIGHT },
            children: [new Paragraph({
              children: [body(text)],
              spacing: { before: 60, after: 60 },
            })],
          }),
        ],
      }),
    ],
    margins: { top: 100, bottom: 200 },
  })
}

function featureTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: BRAND },
            children: [new Paragraph({
              children: [new TextRun({ text: 'Feature', bold: true, color: WHITE, size: 20 })],
              spacing: { before: 80, after: 80 },
            })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: BRAND },
            children: [new Paragraph({
              children: [new TextRun({ text: 'Description', bold: true, color: WHITE, size: 20 })],
              spacing: { before: 80, after: 80 },
            })],
          }),
        ],
      }),
      ...rows.map(([feature, desc], i) =>
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? BRAND_LIGHT : WHITE },
              children: [new Paragraph({
                children: [new TextRun({ text: feature, bold: true, color: BRAND, size: 20 })],
                spacing: { before: 60, after: 60 },
              })],
            }),
            new TableCell({
              shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? BRAND_LIGHT : WHITE },
              children: [new Paragraph({
                children: [body(desc)],
                spacing: { before: 60, after: 60 },
              })],
            }),
          ],
        })
      ),
    ],
    margins: { top: 0, bottom: 240 },
  })
}

// ─── Document ──────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [{
      reference: 'bullet-list',
      levels: [{ level: 0, format: NumberFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 180 } } } }],
    }],
  },
  sections: [

    // ── COVER PAGE ────────────────────────────────────────
    {
      properties: { type: SectionType.NEXT_PAGE },
      children: [
        new Paragraph({ children: [], spacing: { after: 1200 } }),

        new Paragraph({
          children: [new ImageRun({ data: logoPng, transformation: { width: 280, height: 116 } })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 800 },
        }),

        new Paragraph({
          children: [new TextRun({ text: 'The Language Centre App', bold: true, color: BRAND, size: 64 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
        }),

        new Paragraph({
          children: [new TextRun({ text: 'Feature Guide & User Documentation', color: GRAY, size: 30 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),

        new Paragraph({
          children: [new TextRun({ text: '英語学習管理システム', color: BRAND, size: 26 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 1600 },
        }),

        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BRAND_LIGHT } },
          children: [],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [body('A comprehensive platform for English teachers and Japanese students — managing lessons, vocabulary, goals, scheduling, and communication in one place.')],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [new TextRun({ text: `Document Date: April 2026`, color: GRAY, size: 20 })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    },

    // ── MAIN CONTENT ──────────────────────────────────────
    {
      properties: { type: SectionType.NEXT_PAGE },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new ImageRun({ data: logoPng, transformation: { width: 80, height: 33 } }),
                new TextRun({ text: '  |  The Language Centre App — Feature Guide', color: GRAY, size: 18 }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'The Language Centre · Confidential  ', color: GRAY, size: 16 }),
                new TextRun({ children: [PageNumber.CURRENT], color: GRAY, size: 16 }),
                new TextRun({ text: ' / ', color: GRAY, size: 16 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], color: GRAY, size: 16 }),
              ],
              alignment: AlignmentType.RIGHT,
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } },
            }),
          ],
        }),
      },
      children: [

        // OVERVIEW
        heading1('Overview'),
        para([body('The Language Centre is a web application built for English teachers working with Japanese students. It replaces scattered spreadsheets, messaging apps, and paper notes with a single centralised platform for lesson management, student tracking, vocabulary learning, and scheduling.\n')]),
        para([body('The app has two roles — '), bold('Teacher'), body(' and '), bold('Student'), body(' — each with a tailored set of features.')]),
        divider(),

        // GETTING STARTED
        heading1('Getting Started'),

        heading2('Creating an Account'),
        para([body('Both teachers and students sign up at the app\'s homepage. During signup you select your role, enter your full name and email address, and set a password.')]),

        heading2('Student Login — Two Options'),
        para([body('Students can log in in two ways, depending on whether they have an email address:')]),

        callout('Option A — Class Code (young students)', 'The student enters the teacher\'s 6-character class code on the login screen, selects their name from a dropdown, and enters their password. No email required. The teacher creates the account and sets the initial password from the Students page.'),
        new Paragraph({ children: [], spacing: { after: 120 } }),
        callout('Option B — Email signup (adult students)', 'Students sign up with their own email address, then go to Settings → Join a Teacher and enter the class code to link their account.'),
        new Paragraph({ children: [], spacing: { after: 120 } }),

        heading2('Connecting a Teacher and Student (adult/email flow)'),
        para([body('After signing up with an email, a student must be linked to their teacher before most features become available.')]),

        callout('Teacher', 'A unique 6-character invite code is automatically generated (e.g. AB3K9X). Find it on the Students page or in Settings, then share it with your student.'),
        new Paragraph({ children: [], spacing: { after: 120 } }),
        callout('Student', 'Go to Settings → Join a Teacher, enter the 6-character code, and click "Join Class". The connection is instant — no teacher approval needed.'),
        new Paragraph({ children: [], spacing: { after: 120 } }),

        divider(),

        // TEACHER FEATURES
        heading1('Teacher Features'),

        // Dashboard
        heading2('Dashboard'),
        para([body('The first screen after login. Shows a real-time overview of your teaching practice:')]),
        featureTable([
          ['Active Students', 'Total number of currently enrolled students'],
          ['Upcoming Lessons', 'Count of scheduled lessons still to come'],
          ['Pending Requests', 'Booking requests from students awaiting approval'],
          ['Weekly Lesson Chart', 'Bar chart of lessons completed over the last 8 weeks'],
          ['Upcoming Lessons list', 'Next 5 scheduled lessons with student name, date/time, and lesson type'],
          ['Booking Requests list', 'Pending requests with student note and a Review button to approve or decline'],
        ]),

        // Students
        heading2('Students'),
        para([body('Shows all active students as cards with name and email. At the top, your invite code is always visible with a one-click copy button for sharing with new students. Each student card links to their full profile, and students can be removed from here.')]),

        heading3('Adding Students (Teacher-Created Accounts)'),
        para([body('Teachers can add students directly — ideal for young learners who don\'t have an email address.')]),
        bullet('Click "+ Add Student", enter the student\'s name and an initial password'),
        bullet('The student can now log in immediately using the class code + name + password method'),
        bullet('From the student\'s card, click "Set Password" at any time to reset their login password'),
        bullet('If the student later creates their own email account, click "Link Email →" on their card, enter their email, and all lessons and data transfer to their real account'),
        new Paragraph({ children: [], spacing: { after: 80 } }),
        callout('Class Code', 'The class code displayed at the top of the Students page is what students enter on the login screen. Students with teacher-created accounts use: Class Code → select name → enter password.'),
        new Paragraph({ children: [], spacing: { after: 120 } }),

        // Student Profile
        heading2('Student Profile'),
        para([body('The main hub for tracking an individual student. Accessible from the Students page.')]),

        heading3('Stats Summary'),
        bullet('Total lessons completed'),
        bullet('Number of active goals'),
        bullet('Average skill score from latest assessment'),

        heading3('Profile'),
        para([body('Extended background information about the student — managed by the teacher. Click the Edit button on the Profile card to fill in or update any fields.')]),
        featureTable([
          ['Age & Grade', 'Student\'s age and school grade (Elementary 1–6, Middle 1–3, High 1–3, University, Adult)'],
          ['School / Occupation', 'School name for younger students; job title or field for adults'],
          ['EIKEN Grade', 'Current EIKEN certification level (5級 through 1級)'],
          ['TOEIC / IELTS / TOEFL', 'Standardised test scores'],
          ['Self-assessed CEFR', 'The student\'s own estimate of their level (A1–C2)'],
          ['Hobbies & Interests', 'Topics to use in conversation practice'],
          ['Likes / Dislikes', 'What the student enjoys or wants to avoid in lessons'],
          ['Learning Goals', 'Free-text description of what the student wants to achieve'],
          ['Notes', 'Private teacher notes about the student'],
        ]),

        heading3('Goals'),
        bullet('Full list of learning goals with title, target date, days remaining (or overdue), and status'),
        bullet('Status options: Active / Achieved / Paused / Dropped'),
        bullet('Add new goals with title, optional description, and optional target date'),

        heading3('Progress Assessment'),
        bullet('Skill scores for Speaking, Listening, Reading, and Writing (each rated 1–10)'),
        bullet('CEFR level badge (A1 through C2)'),
        bullet('Progress chart showing score changes across multiple assessment snapshots'),
        bullet('Record a new snapshot at any time'),

        heading3('Vocabulary Bank'),
        bullet('Complete list of all vocabulary words for this student'),
        bullet('Shows word, English definition, Japanese definition, example sentence, and mastery level'),
        bullet('Add new words directly — no lesson required'),
        bullet('Remove individual words'),
        bullet('Words appear immediately in the student\'s Vocabulary page'),

        heading3('Recent Lessons'),
        bullet('The 10 most recent lessons with date, time, status, and link to full lesson notes'),
        bullet('Use the "+ Add Lesson" button here to schedule a new lesson or log a past one directly from the student\'s profile'),

        // Lessons
        heading2('Lessons'),
        para([body('A timeline of all lessons organised by student. Select a student from the sidebar to see their full lesson history. From here you can:')]),
        bullet('See total, completed, and upcoming lesson counts'),
        bullet('Open any lesson to view or edit notes'),
        bullet('Use "+ Add Lesson" to schedule a new lesson or record a past one'),
        new Paragraph({ children: [], spacing: { after: 80 } }),
        callout('Teacher Tip', 'You can also schedule a lesson directly from a student\'s profile page — the "+ Add Lesson" button appears in the Recent Lessons section, so you don\'t have to navigate to the Lessons page first.'),
        new Paragraph({ children: [], spacing: { after: 120 } }),

        heading3('Adding a Lesson'),
        para([body('The "+ Add Lesson" button opens a modal where you can schedule an upcoming lesson or record a past one. All times are entered in Japan Standard Time (JST).')]),
        featureTable([
          ['Date & Time', 'Pick the date, start time, and end time. Past dates are saved as "completed"; future dates as "scheduled".'],
          ['Lesson Type', 'Trial, Regular, or Intensive'],
          ['Group Lesson', 'Toggle on to add co-participants from your other students. All participants see the lesson in their own Lessons page.'],
          ['Repeat Weekly x4', 'Toggle on to automatically schedule the same slot for 4 consecutive weeks. Weeks that conflict with existing lessons are skipped automatically.'],
        ]),

        heading3('Group Lessons'),
        para([body('Group lessons allow multiple students to share a single lesson slot — useful for pair or small-group classes.')]),
        bullet('Enable the "Group Lesson" toggle when logging a lesson'),
        bullet('Select one or more co-participants from your student list'),
        bullet('The lesson appears in every participant\'s lesson history'),
        bullet('Lesson notes vocabulary saved to the Vocab Bank is added for all participants simultaneously'),
        bullet('Group lessons are marked with a purple "Group" badge and show all participant names'),

        // Lesson Detail
        heading2('Lesson Detail'),
        para([body('Opening a lesson gives access to the full lesson editor with auto-save (every 2 seconds).')]),

        heading3('Lesson Notes Editor'),
        featureTable([
          ['Session Summary', 'Free text overview of what was covered and how the student performed'],
          ['Vocabulary', 'Add words with English definition and optional example. "Save all to Vocab Bank" pushes words to the student\'s permanent vocabulary bank'],
          ['Grammar Points', 'Topics covered with explanations'],
          ['Homework / 宿題', 'Instructions for the student before the next lesson'],
          ['Strengths', 'What the student did well'],
          ['Areas to Focus', 'What to work on in the next lesson'],
          ['Goals Addressed', 'Tag which active goals were worked on in this lesson'],
          ['Private Teacher Notes', 'Visible to teacher only — never shown to the student'],
          ['Visible to student', 'Toggle to control whether the student can see these notes'],
        ]),

        heading3('Mark Complete'),
        para([body('When a scheduled lesson has finished, click "Mark Complete" in the top-right of the lesson detail to update its status to completed. This triggers the lesson to appear in the student\'s Past Lessons list.')]),

        heading3('Attachments'),
        bullet('Upload photos, PDFs, worksheets, audio files, or any document (up to 20 MB)'),
        bullet('Drag-and-drop or click to browse'),
        bullet('File type icon, name, and size shown for each attachment'),
        bullet('Teacher can remove attachments; students can view and download only'),

        // Calendar
        heading2('Calendar'),
        para([body('Monthly calendar view of all scheduled and completed lessons. Provides a visual overview of the full teaching schedule. Pending booking requests can be reviewed and actioned from here.')]),

        // Availability
        heading2('Availability'),
        para([body('Set available times so students can book lessons. Two slot types:')]),
        bullet('Recurring — repeats weekly (e.g. every Monday 9:00–12:00)'),
        bullet('One-off — a specific date and time range'),
        para([body('Slots can be toggled on/off without being deleted. These slots appear directly on the student\'s booking calendar.')]),

        divider(),

        // STUDENT FEATURES
        heading1('Student Features'),

        // Dashboard
        heading2('Dashboard'),
        para([body('The student\'s home screen shows:')]),
        bullet('Next lesson date, time, and teacher name — with a "Join Meeting" button if a link is set'),
        bullet('Active learning goals with target dates'),
        bullet('The 3 most recent lesson notes from the teacher (summary and homework)'),
        bullet('Quick "Book a Lesson" button'),

        // Lessons
        heading2('Lessons'),
        para([body('Shows all lessons split into Upcoming and Past. Each card displays the date, time, lesson type, summary preview, and homework. Cards expand inline to show full notes, or can be opened for the complete lesson detail view.')]),

        // Lesson Detail (Student)
        heading2('Lesson Detail — Student View'),
        para([body('Students can view full lesson details including:')]),
        bullet('Date, time, lesson type, status, and meeting link'),
        bullet('Full lesson notes if the teacher has made them visible — summary, vocabulary, grammar points, homework, strengths, and areas to focus'),
        bullet('Private teacher notes are never shown to students'),
        bullet('All attachments uploaded by the teacher — students can download but not delete'),

        // Book a Lesson
        heading2('Book a Lesson / 予約'),
        para([body('Students request lessons using a weekly calendar grid showing the teacher\'s available slots. Click an available slot, add an optional note, and submit. The teacher approves or declines from their dashboard. Any pending requests are shown at the top of the page.')]),

        // Goals
        heading2('Goals / 目標'),
        para([body('All learning goals set by the teacher, grouped into Active, Achieved, and Other. Each goal shows the title, description, target date, and days remaining (shown in both English and Japanese). Status labels are displayed in Japanese:')]),
        bullet('進行中 — Active'),
        bullet('達成！— Achieved'),
        bullet('一時停止 — Paused'),
        bullet('取り消し — Dropped'),

        // Vocabulary
        heading2('Vocabulary / 単語'),
        para([body('All vocabulary words added by the teacher, organised by mastery level. Words due for review appear in a highlighted section at the top.')]),

        heading3('Mastery Levels'),
        featureTable([
          ['新しい / New', 'Just added — not yet studied'],
          ['見た / Seen', 'Encountered at least once'],
          ['覚えてる / Familiar', 'Mostly remembered'],
          ['マスター / Mastered', 'Fully learned'],
        ]),

        heading3('Text-to-Speech (TTS)'),
        para([body('Every vocabulary word has a 🔊 speaker button. Tap it to hear the word read aloud in English. In Study Session mode, the word is automatically spoken when each new card appears (can be turned off in Settings).')]),

        heading3('Flashcard Review'),
        para([body('Each word is displayed as a flip card — tap to reveal the definition, Japanese translation, and example sentence. Update the mastery level directly on the card.')]),

        heading3('Study Session Mode'),
        para([body('A focused full-screen study mode for working through vocabulary systematically.')]),
        bullet('Review Due (N) — study only words currently due for review'),
        bullet('Study All — study every word in the bank'),
        bullet('Study this group — study words from a specific mastery level'),
        new Paragraph({ children: [], spacing: { after: 80 } }),
        para([body('During a session, each word is shown one at a time. Tap to flip and reveal the definition. Then rate your recall:')]),

        featureTable([
          ['Again (red)', 'Didn\'t remember — card requeues and review scheduled for tomorrow'],
          ['Hard (yellow)', 'Remembered with difficulty — mastery unchanged, same interval'],
          ['Good (green)', 'Remembered correctly — mastery increases one level'],
          ['Easy (blue)', 'Remembered easily — mastery jumps two levels, longer interval'],
        ]),

        heading3('Spaced Repetition Schedule'),
        featureTable([
          ['New (Level 0)', 'Review again in 1 day'],
          ['Seen (Level 1)', 'Review again in 3 days'],
          ['Familiar (Level 2)', 'Review again in 7 days'],
          ['Mastered (Level 3)', 'Review again in 14 days'],
        ]),

        divider(),

        // EMAIL NOTIFICATIONS
        heading1('Email Notifications'),
        para([body('The app sends automatic email notifications for lessons. Both the teacher and student receive emails for every event.')]),

        featureTable([
          ['Lesson Confirmed', 'Sent immediately when a lesson is created or a booking request is approved. Includes lesson date, time, and type.'],
          ['1-Hour Reminder', 'Sent to both teacher and student approximately 1 hour before every scheduled lesson.'],
        ]),

        divider(),

        // SETTINGS
        heading1('Settings'),

        heading2('Teacher Settings'),
        bullet('Update display name'),
        bullet('Change account password'),
        bullet('View and copy invite code to share with new students'),
        bullet('Toggle email notifications on/off'),
        bullet('Set default lesson duration (30 min / 45 min / 1 hour / 90 min / 2 hours) — auto-fills end time when scheduling'),

        heading2('Student Settings'),
        bullet('Update display name'),
        bullet('Change account password'),
        bullet('Join a teacher using their 6-character invite code'),
        bullet('Toggle email notifications on/off'),
        bullet('Toggle vocabulary TTS (text-to-speech) auto-play on/off'),
        bullet('Set study session size (10 / 20 / 30 / all words per session)'),

        divider(),

        // TECHNICAL NOTES
        heading1('Technical Notes'),
        featureTable([
          ['Timezones', 'All times stored in UTC, displayed in Japan Standard Time (JST, UTC+9)'],
          ['Platform', 'Web application — works on desktop and mobile browsers'],
          ['Data privacy', 'Students can only see their own data. Teachers only see data for their own students.'],
          ['File storage', 'Lesson attachments stored securely with access controlled per lesson'],
          ['Notifications', 'Powered by Supabase Edge Functions and Resend email delivery'],
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // BACK COVER
        new Paragraph({ children: [], spacing: { after: 800 } }),

        new Paragraph({
          children: [new ImageRun({ data: logoPng, transformation: { width: 200, height: 83 } })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),

        new Paragraph({
          children: [new TextRun({ text: 'Teaching smarter.', color: BRAND, size: 32, bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),

        new Paragraph({
          children: [new TextRun({ text: 'Learning better.', color: GRAY, size: 28 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
        }),

        new Paragraph({
          children: [new TextRun({ text: 'もっと上手に教え、より良く学ぶ。', color: BRAND, size: 22, italics: true })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    },
  ],
})

const buffer = await Packer.toBuffer(doc)
const outPath = path.join(ROOT, 'TLC_App_Guide.docx')
fs.writeFileSync(outPath, buffer)
console.log(`Created: ${outPath}`)
