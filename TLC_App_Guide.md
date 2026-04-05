# TLC English App — Feature Guide

---

## Overview

TLC English is a web application designed for English teachers working with Japanese students. It centralises lesson management, student tracking, vocabulary learning, and scheduling into one place — replacing scattered spreadsheets, messaging apps, and paper notes.

The app has two roles: **Teacher** and **Student**. Each role sees a different set of features tailored to their needs.

---

## Getting Started

### Creating an Account

Both teachers and students sign up at the app's homepage. During signup, you select your role (Teacher or Student) and enter your full name and email address.

### Connecting Teacher and Student

After signing up, a teacher and student must be linked before they can use most features together.

**Teacher side:**
- A unique 6-character invite code (e.g. `AB3K9X`) is automatically generated for every teacher account
- The teacher can find their code on the **Students** page and in **Settings**
- The teacher shares this code with their student (by text, email, or verbally)

**Student side:**
- The student goes to **Settings → Join a Teacher**
- They enter the 6-character code and click "Join Class"
- The connection is made instantly — no approval required

Once connected, the teacher can see the student in their roster and the student gains access to booking, goals, vocabulary, and lesson notes from that teacher.

---

## Teacher Features

### Dashboard

The teacher dashboard is the first screen after login. It shows:

- **Active Students** — total number of currently enrolled students
- **Upcoming Lessons** — count of scheduled lessons still to come
- **Pending Requests** — booking requests from students awaiting approval
- **Weekly Lesson Chart** — a bar chart showing how many lessons were completed each week over the last 8 weeks
- **Upcoming Lessons list** — the next 5 scheduled lessons with student name, date/time, and lesson type
- **Booking Requests list** — all pending requests with student name, requested time, optional student note, and a button to review/approve/decline

---

### Students

The Students page shows all currently active students as cards. Each card displays the student's name, email, and a link to their full profile. Teachers can also remove a student from this page.

At the top of the page is the teacher's invite code with a one-click copy button so it's always easy to share.

---

### Student Profile

Each student has a dedicated profile page accessible from the Students page. This is the main hub for tracking an individual student's progress. It contains:

**Stats summary**
- Total lessons completed
- Number of active goals
- Average skill score from the latest assessment

**Goals**
- A list of all learning goals set for the student, showing title, target date, days remaining (or overdue), and status (Active / Achieved / Paused / Dropped)
- A form to create new goals with a title, optional description, and optional target date

**Progress Assessment**
- The latest skill scores across Speaking, Listening, Reading, and Writing (each rated 1–10), displayed as progress bars
- CEFR level badge (A1 through C2) if assessed
- A progress chart showing how scores have changed across multiple assessments
- A form to record a new assessment snapshot at any time

**Vocabulary Bank**
- A complete list of all vocabulary words in the student's bank, showing the word, English definition, Japanese definition (if added), example sentence, and current mastery level
- A form to add new words directly — no lesson required
- Each word can be removed individually
- Words added here immediately appear in the student's Vocabulary page for review

**Recent Lessons**
- The 10 most recent lessons for this student with date, time, status, and a link to view full lesson notes

---

### Lessons

The Lessons page shows a full timeline of lessons organised by student. The teacher selects a student from the sidebar to see all their lessons in reverse chronological order.

At the top of the selected student's lessons:
- Total lesson count, completed count, and upcoming count
- A **+ Log Lesson** button to schedule or record a lesson

Each lesson card shows the date, time, status (Scheduled / Completed / Cancelled), lesson type, and a preview of the lesson summary. The card can be expanded inline for quick note editing, or opened in full for the complete lesson editor.

---

### Lesson Detail (Teacher View)

Opening a lesson gives the teacher a full editing environment. It includes:

**Lesson Notes Editor** — autosaves every 2 seconds, with a manual save button. Contains:
- **Session Summary** — free text overview of the lesson
- **Vocabulary** — add words with English definition and example sentence. A "Save all to Vocab Bank" button pushes all words from this lesson directly into the student's permanent vocabulary bank
- **Grammar Points** — add grammar topics covered with explanations
- **Homework** — instructions for what the student should do before the next lesson
- **Strengths** — what the student did well
- **Areas to Focus** — what to work on next
- **Goals Addressed** — tag which of the student's active goals were worked on in this lesson
- **Private Teacher Notes** — notes only the teacher can see (not shown to the student)
- **Visible to student** toggle — controls whether the student can see these notes

**Attachments** — upload photos, PDFs, worksheets, audio files, or any document (up to 20 MB). Files can be dragged and dropped or selected via a file browser. Each attachment shows the file name, size, and type icon. The teacher can remove attachments at any time. Students can download but not delete attachments.

**Mark Complete** button — marks the lesson as completed once it has taken place.

---

### Calendar

A monthly calendar view showing all scheduled and completed lessons. Provides a visual overview of the teaching schedule. Pending booking requests can be reviewed from here.

---

### Availability

The teacher sets their available times here so students know when they can book. Two types of slots:

- **Recurring** — a weekly repeating slot (e.g. every Monday 9:00–12:00)
- **One-off** — a specific date and time range

Slots can be toggled on/off without deleting them. The availability set here directly controls which time slots appear on the student's booking calendar.

---

## Student Features

### Dashboard

The student dashboard shows:

- **Next Lesson card** — date, time, teacher name, and a "Join Meeting" button if a meeting link has been set. Links directly to lesson details.
- **Active Goals** — a list of current learning goals with target dates
- **Recent Lesson Notes** — the 3 most recent lesson notes shared by the teacher, showing summary and homework
- **Book a Lesson** button — quick access to schedule the next lesson

---

### Lessons

Shows all lessons in two groups: Upcoming and Past. Each lesson card displays the date, time, lesson type, and a preview of the summary and homework. Cards can be expanded to show full lesson notes, or opened for the complete detail view.

---

### Lesson Detail (Student View)

Students can view the full details of any lesson. Shows:

- Date, time, lesson type, and status
- Meeting link (if set by teacher)
- Full lesson notes if the teacher has made them visible — including summary, vocabulary list, grammar points, homework, strengths, and areas to focus. Private teacher notes are never shown.
- Attachments uploaded by the teacher — students can view and download all files

---

### Book a Lesson

Students use this page to request lessons with their teacher. It shows a weekly calendar grid with the teacher's available time slots highlighted. The student clicks on an available slot, optionally adds a note, and submits the request.

The teacher then approves or declines from their dashboard or calendar. Once approved, the lesson appears in both the teacher's and student's lessons list.

Any pending requests are shown at the top of the page so students can see what is awaiting approval.

---

### Goals

A dedicated page showing all learning goals set by the teacher. Goals are grouped into Active, Achieved, and Other (Paused/Dropped). Each goal card shows:

- Goal title and description
- Target date with days remaining or overdue (in Japanese and English)
- Status badge in Japanese (進行中 / 達成！/ 一時停止 / 取り消し)

---

### Vocabulary

The vocabulary page shows all words the teacher has added to the student's vocabulary bank, organised by mastery level.

**Mastery Levels:**
- 新しい / New — just added, not yet studied
- 見た / Seen — encountered at least once
- 覚えてる / Familiar — mostly remembered
- マスター / Mastered — fully learned

Words due for review are highlighted in a separate section at the top.

Each word is displayed as a flip card — tap or click the card to reveal the English definition, Japanese definition (if added), and example sentence. The student can then update the mastery level directly on the card.

**Study Session Mode**

The vocabulary page has two study session buttons:
- **Review Due (N)** — starts a focused session with only the words currently due for review
- **Study All** — starts a session with every word in the bank
- Each mastery group also has a **Study this group** button

During a study session:
- Cards are shown one at a time full-screen
- The word is displayed on the front — tap to flip and reveal the definition and example
- After flipping, four rating buttons appear:
  - **Again** (red) — didn't remember; card requeues and review is scheduled for tomorrow
  - **Hard** (yellow) — remembered with difficulty; mastery unchanged, same review interval
  - **Good** (green) — remembered correctly; mastery increases one level
  - **Easy** (blue) — remembered easily; mastery jumps two levels, longer review interval
- A progress bar and card counter are shown throughout
- At the end, a summary screen shows how many cards were rated Again / Hard / Good / Easy

The spaced repetition schedule:
- New (level 0) → review in 1 day
- Seen (level 1) → review in 3 days
- Familiar (level 2) → review in 7 days
- Mastered (level 3) → review in 14 days

---

### Settings

Students can:
- Update their display name
- Change their password
- Join a teacher using a 6-character invite code

---

## Email Notifications

The app sends automatic email notifications for lessons:

**Lesson Confirmation** — when a lesson is created (either by teacher scheduling or by teacher approving a booking request), both the teacher and student receive a confirmation email with the lesson date, time, and type.

**1-Hour Reminder** — one hour before every scheduled lesson, both the teacher and student receive a reminder email with the lesson details.

---

## Settings (Teacher)

Teachers can:
- Update their display name
- Change their password
- View and copy their invite code to share with new students

---

## Technology Notes

- All times are stored in UTC and displayed in Japan Standard Time (JST, UTC+9)
- The app works on desktop and mobile browsers
- All data is private — students can only see their own information, and teachers can only see data for their own students

---

*TLC English App — Internal Documentation*
