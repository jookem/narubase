import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { registerFonts } from './fonts'

registerFonts()

const BRAND = '#3D3DB4'
const BRAND_LIGHT = '#EEF0FC'
const GRAY = '#6B7280'
const DARK = '#111827'
const GREEN = '#166534'
const GREEN_LIGHT = '#F0FDF4'
const ORANGE_LIGHT = '#FFF7ED'
const ORANGE = '#EA580C'

const s = StyleSheet.create({
  page: { fontFamily: 'NotoSansJP', fontSize: 10, color: DARK, padding: 36, paddingBottom: 44 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: BRAND },
  headerLeft: { flex: 1 },
  schoolName: { fontSize: 7, color: BRAND, fontWeight: 700, letterSpacing: 1.5, marginBottom: 2 },
  studentName: { fontSize: 18, fontWeight: 700, color: BRAND, marginBottom: 2 },
  studentMeta: { fontSize: 9, color: GRAY },
  headerRight: { alignItems: 'flex-end' },
  metaLine: { fontSize: 8, color: GRAY, textAlign: 'right', marginBottom: 1 },

  section: { marginBottom: 10 },
  sectionLabel: { fontSize: 7, fontWeight: 700, color: GRAY, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },

  row2: { flexDirection: 'row', gap: 14 },
  col: { flex: 1 },
  dl: { flexDirection: 'row', marginBottom: 3 },
  dt: { fontSize: 9, color: GRAY, width: 110 },
  dd: { fontSize: 9, color: DARK, flex: 1 },

  goalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  goalTitle: { fontSize: 9, color: DARK, flex: 1 },
  goalDate: { fontSize: 8, color: GRAY, marginLeft: 6 },
  goalBadge: { fontSize: 7, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 5, borderRadius: 8 },
  badgeActive: { backgroundColor: BRAND_LIGHT, color: BRAND },
  badgeAchieved: { backgroundColor: GREEN_LIGHT, color: GREEN },
  badgeOther: { backgroundColor: '#F3F4F6', color: GRAY },

  skillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  skillLabel: { fontSize: 9, color: GRAY, width: 60 },
  skillBarBg: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginHorizontal: 7 },
  skillBarFill: { height: 6, backgroundColor: BRAND, borderRadius: 3 },
  skillScore: { fontSize: 9, color: DARK, width: 18, textAlign: 'right' },
  cefrBadge: { backgroundColor: BRAND, color: '#FFFFFF', fontSize: 8, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 7, borderRadius: 3, alignSelf: 'flex-start', marginBottom: 6 },
  notesBox: { backgroundColor: '#F9FAFB', padding: 7, borderRadius: 3, fontSize: 9, color: DARK, lineHeight: 1.4 },

  historyDivider: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: BRAND },
  historyTitle: { fontSize: 12, fontWeight: 700, color: BRAND },
  historyCount: { fontSize: 8, color: GRAY },

  lessonCard: { marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 5, padding: 8 },
  lessonCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  lessonDate: { fontSize: 10, fontWeight: 700, color: DARK },
  lessonTime: { fontSize: 8, color: GRAY, marginTop: 1 },
  badgeRow: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  badge: { fontSize: 7, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 5, borderRadius: 8 },
  badgeCompleted: { backgroundColor: GREEN_LIGHT, color: GREEN },
  badgeScheduled: { backgroundColor: BRAND_LIGHT, color: BRAND },
  badgeType: { backgroundColor: '#F3F4F6', color: GRAY },
  badgeGroup: { backgroundColor: '#F3E8FF', color: '#7C3AED' },

  subLabel: { fontSize: 7, fontWeight: 700, color: GRAY, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  body: { fontSize: 9, color: DARK, lineHeight: 1.45 },

  vocabItem: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3, backgroundColor: BRAND_LIGHT, padding: 4, borderRadius: 3 },
  vocabWord: { fontWeight: 700, color: BRAND, fontSize: 9 },
  vocabDash: { color: GRAY, marginHorizontal: 3 },
  vocabDef: { color: DARK, fontSize: 9, flex: 1 },
  vocabExample: { fontSize: 7.5, color: GRAY, fontStyle: 'italic', marginTop: 1 },

  grammarItem: { backgroundColor: GREEN_LIGHT, padding: 4, borderRadius: 3, marginBottom: 3 },
  grammarPoint: { fontWeight: 700, color: GREEN, fontSize: 9, marginBottom: 1 },
  grammarExp: { color: DARK, fontSize: 8 },

  sideBySide: { flexDirection: 'row', gap: 8, marginTop: 5 },
  strengthBox: { flex: 1, backgroundColor: GREEN_LIGHT, padding: 6, borderRadius: 3, borderLeftWidth: 3, borderLeftColor: '#16A34A' },
  focusBox: { flex: 1, backgroundColor: ORANGE_LIGHT, padding: 6, borderRadius: 3, borderLeftWidth: 3, borderLeftColor: ORANGE },
  privateBox: { backgroundColor: '#F9FAFB', padding: 6, borderRadius: 3, borderLeftWidth: 2, borderLeftColor: '#D1D5DB', marginTop: 5 },

  noNotes: { fontSize: 8.5, color: '#9CA3AF', fontStyle: 'italic' },

  footer: { position: 'absolute', bottom: 18, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 5 },
  footerText: { fontSize: 7, color: GRAY },
})

const GRADE_LABELS: Record<string, string> = {
  elementary_1: 'Elementary 1st grade', elementary_2: 'Elementary 2nd grade',
  elementary_3: 'Elementary 3rd grade', elementary_4: 'Elementary 4th grade',
  elementary_5: 'Elementary 5th grade', elementary_6: 'Elementary 6th grade',
  middle_1: 'Middle School 1st year', middle_2: 'Middle School 2nd year',
  middle_3: 'Middle School 3rd year', high_1: 'High School 1st year',
  high_2: 'High School 2nd year', high_3: 'High School 3rd year',
  university: 'University Student', adult: 'Adult / Working', other: 'Other',
}
const EIKEN_LABELS: Record<string, string> = {
  '5': '5級', '4': '4級', '3': '3級', 'pre-2': '準2級', 'pre-2-plus': '準2級プラス', '2': '2級', 'pre-1': '準1級', '1': '1級',
}

type Props = {
  student: any
  details: any
  goals: any[]
  latestSnapshot: any
  lessons: any[]
  teacherName: string
}

function pickNotes(lesson: any, studentId: string) {
  const arr: any[] = Array.isArray(lesson.lesson_notes)
    ? lesson.lesson_notes
    : lesson.lesson_notes ? [lesson.lesson_notes] : []
  if (arr.length === 0) return null
  // Group lesson: show the shared note (student_id IS NULL)
  // Individual lesson: show the per-student note, fall back to shared
  const groupNote = arr.find((n: any) => n.student_id === null)
  const studentNote = arr.find((n: any) => n.student_id === studentId)
  return lesson.is_group
    ? (groupNote ?? studentNote ?? arr[0])
    : (studentNote ?? groupNote ?? arr[0])
}

export function StudentReportPDF({ student, details: d, goals, latestSnapshot, lessons, teacherName }: Props) {
  const isAdult = d?.grade === 'adult' || d?.grade === 'university' || d?.grade === 'other'
  const activeGoals = goals.filter(g => g.status === 'active')
  const otherGoals = goals.filter(g => g.status !== 'active')

  const skills = latestSnapshot
    ? [
        { label: 'Speaking', score: latestSnapshot.speaking_score ?? 0 },
        { label: 'Listening', score: latestSnapshot.listening_score ?? 0 },
        { label: 'Reading', score: latestSnapshot.reading_score ?? 0 },
        { label: 'Writing', score: latestSnapshot.writing_score ?? 0 },
      ]
    : []

  // Only completed lessons, newest first
  const completedLessons = lessons
    .filter(l => l.status === 'completed')
    .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.schoolName}>NARUBASE</Text>
            <Text style={s.studentName}>{student.full_name}</Text>
            <Text style={s.studentMeta}>{student.email}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.metaLine}>Teacher: {teacherName}</Text>
            <Text style={s.metaLine}>Generated: {format(new Date(), 'MMM d, yyyy')}</Text>
            <Text style={s.metaLine}>{completedLessons.length} completed lesson{completedLessons.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Profile — two columns */}
        <View style={s.row2}>
          <View style={s.col}>
            {d && (d.age || d.grade || d.school_name || d.occupation) && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Background</Text>
                {d.age ? <View style={s.dl}><Text style={s.dt}>Age</Text><Text style={s.dd}>{d.age}</Text></View> : null}
                {d.grade ? <View style={s.dl}><Text style={s.dt}>Grade / Level</Text><Text style={s.dd}>{GRADE_LABELS[d.grade] ?? d.grade}</Text></View> : null}
                {!isAdult && d.school_name ? <View style={s.dl}><Text style={s.dt}>School</Text><Text style={s.dd}>{d.school_name}</Text></View> : null}
                {isAdult && d.occupation ? <View style={s.dl}><Text style={s.dt}>Occupation</Text><Text style={s.dd}>{d.occupation}</Text></View> : null}
              </View>
            )}

            {d && (d.eiken_grade || d.self_cefr || d.toeic_score || d.ielts_score || d.toefl_score) && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>English Proficiency</Text>
                {d.self_cefr ? <View style={s.dl}><Text style={s.dt}>Self-assessed CEFR</Text><Text style={s.dd}>{d.self_cefr}</Text></View> : null}
                {d.eiken_grade ? <View style={s.dl}><Text style={s.dt}>EIKEN</Text><Text style={s.dd}>{EIKEN_LABELS[d.eiken_grade] ?? d.eiken_grade}</Text></View> : null}
                {d.toeic_score ? <View style={s.dl}><Text style={s.dt}>TOEIC</Text><Text style={s.dd}>{d.toeic_score}</Text></View> : null}
                {d.ielts_score ? <View style={s.dl}><Text style={s.dt}>IELTS</Text><Text style={s.dd}>{d.ielts_score}</Text></View> : null}
                {d.toefl_score ? <View style={s.dl}><Text style={s.dt}>TOEFL iBT</Text><Text style={s.dd}>{d.toefl_score}</Text></View> : null}
              </View>
            )}

            {d && (d.hobbies || d.likes || d.dislikes) && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Personal</Text>
                {d.hobbies ? <View style={s.dl}><Text style={s.dt}>Hobbies</Text><Text style={s.dd}>{d.hobbies}</Text></View> : null}
                {d.likes ? <View style={s.dl}><Text style={s.dt}>Likes</Text><Text style={s.dd}>{d.likes}</Text></View> : null}
                {d.dislikes ? <View style={s.dl}><Text style={s.dt}>Dislikes</Text><Text style={s.dd}>{d.dislikes}</Text></View> : null}
              </View>
            )}

            {d?.learning_goals && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Dreams</Text>
                <View style={s.notesBox}><Text>{d.learning_goals}</Text></View>
              </View>
            )}

            {d?.notes && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Teacher Notes</Text>
                <View style={s.notesBox}><Text>{d.notes}</Text></View>
              </View>
            )}
          </View>

          <View style={s.col}>
            {latestSnapshot && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>
                  Latest Assessment · {format(new Date(latestSnapshot.snapshot_date), 'MMM d, yyyy')}
                </Text>
                {latestSnapshot.cefr_level && (
                  <Text style={s.cefrBadge}>{latestSnapshot.cefr_level}</Text>
                )}
                {skills.map(({ label, score }) => (
                  <View key={label} style={s.skillRow}>
                    <Text style={s.skillLabel}>{label}</Text>
                    <View style={s.skillBarBg}>
                      <View style={[s.skillBarFill, { width: `${(score / 10) * 100}%` }]} />
                    </View>
                    <Text style={s.skillScore}>{score}</Text>
                  </View>
                ))}
              </View>
            )}

            {goals.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Goals ({goals.length})</Text>
                {activeGoals.map(goal => (
                  <View key={goal.id} style={s.goalItem}>
                    <Text style={s.goalTitle}>{goal.title}</Text>
                    {goal.target_date && (
                      <Text style={s.goalDate}>{format(new Date(goal.target_date), 'MMM d, yyyy')}</Text>
                    )}
                    <Text style={[s.goalBadge, s.badgeActive]}>active</Text>
                  </View>
                ))}
                {otherGoals.map(goal => (
                  <View key={goal.id} style={s.goalItem}>
                    <Text style={[s.goalTitle, { color: GRAY }]}>{goal.title}</Text>
                    <Text style={[s.goalBadge, goal.status === 'achieved' ? s.badgeAchieved : s.badgeOther]}>
                      {goal.status}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Lesson history divider */}
        <View style={s.historyDivider}>
          <Text style={s.historyTitle}>Lesson History</Text>
          <Text style={s.historyCount}>{completedLessons.length} completed lesson{completedLessons.length !== 1 ? 's' : ''}, newest first</Text>
        </View>

        {completedLessons.length === 0 && (
          <Text style={s.noNotes}>No completed lessons recorded yet.</Text>
        )}

        {completedLessons.map(lesson => {
          const notes = pickNotes(lesson, student.id)
          const vocab: any[] = notes?.vocabulary ?? []
          const grammar: any[] = notes?.grammar_points ?? []
          const hasContent = notes?.summary || vocab.length > 0 || grammar.length > 0
            || notes?.homework || notes?.strengths || notes?.areas_to_focus

          return (
            <View key={lesson.id} style={s.lessonCard}>
              <View style={s.lessonCardHeader} wrap={false}>
                <View>
                  <Text style={s.lessonDate}>
                    {format(new Date(lesson.scheduled_start), 'EEEE, MMMM d, yyyy')}
                  </Text>
                  <Text style={s.lessonTime}>
                    {format(new Date(lesson.scheduled_start), 'h:mm a')}
                    {' – '}
                    {format(new Date(lesson.scheduled_end), 'h:mm a')}
                  </Text>
                </View>
                <View style={s.badgeRow}>
                  <Text style={[s.badge, s.badgeType]}>{lesson.lesson_type}</Text>
                  {lesson.is_group && (
                    <Text style={[s.badge, s.badgeGroup]}>{lesson.group_name ?? 'group'}</Text>
                  )}
                </View>
              </View>

              {!hasContent ? (
                <Text style={s.noNotes}>No notes recorded.</Text>
              ) : (
                <>
                  {notes?.summary && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={s.subLabel}>Summary</Text>
                      <Text style={s.body}>{notes.summary}</Text>
                    </View>
                  )}

                  {vocab.length > 0 && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={s.subLabel}>Vocabulary ({vocab.length})</Text>
                      {vocab.map((v: any, i: number) => (
                        <View key={i} style={s.vocabItem}>
                          <Text style={s.vocabWord}>{v.word}</Text>
                          <Text style={s.vocabDash}>—</Text>
                          <Text style={s.vocabDef}>{v.definition ?? v.definition_en ?? v.definition_ja ?? ''}</Text>
                          {v.example ? <Text style={s.vocabExample}>"{v.example}"</Text> : null}
                        </View>
                      ))}
                    </View>
                  )}

                  {grammar.length > 0 && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={s.subLabel}>Grammar</Text>
                      {grammar.map((g: any, i: number) => (
                        <View key={i} style={s.grammarItem}>
                          <Text style={s.grammarPoint}>{g.point}</Text>
                          {g.explanation ? <Text style={s.grammarExp}>{g.explanation}</Text> : null}
                        </View>
                      ))}
                    </View>
                  )}

                  {notes?.homework && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={s.subLabel}>Homework</Text>
                      <Text style={s.body}>{notes.homework}</Text>
                    </View>
                  )}

                  {(notes?.strengths || notes?.areas_to_focus) && (
                    <View style={s.sideBySide}>
                      {notes.strengths && (
                        <View style={s.strengthBox}>
                          <Text style={s.subLabel}>Strengths</Text>
                          <Text style={s.body}>{notes.strengths}</Text>
                        </View>
                      )}
                      {notes.areas_to_focus && (
                        <View style={s.focusBox}>
                          <Text style={s.subLabel}>Areas to Focus</Text>
                          <Text style={s.body}>{notes.areas_to_focus}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {notes?.teacher_notes && (
                    <View style={s.privateBox}>
                      <Text style={s.subLabel}>Private Notes</Text>
                      <Text style={s.body}>{notes.teacher_notes}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )
        })}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>NaruBase · Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${student.full_name} · p. ${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
