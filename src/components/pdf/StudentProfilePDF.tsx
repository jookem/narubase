import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'

const BRAND = '#3D3DB4'
const BRAND_LIGHT = '#EEF0FC'
const GRAY = '#6B7280'
const DARK = '#111827'
const GREEN = '#166534'
const GREEN_LIGHT = '#F0FDF4'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: DARK, padding: 40, paddingBottom: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: BRAND },
  headerLeft: { flex: 1 },
  schoolName: { fontSize: 7, color: BRAND, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, marginBottom: 3 },
  studentName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BRAND, marginBottom: 3 },
  studentMeta: { fontSize: 9, color: GRAY },
  dateGenerated: { fontSize: 8, color: GRAY, textAlign: 'right' },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  row2: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  dl: { flexDirection: 'row', marginBottom: 4 },
  dt: { fontSize: 9, color: GRAY, width: 110 },
  dd: { fontSize: 9, color: DARK, flex: 1 },
  goalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  goalTitle: { fontSize: 9.5, color: DARK, flex: 1 },
  goalDate: { fontSize: 8.5, color: GRAY, marginLeft: 8 },
  goalBadge: { fontSize: 7.5, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 10, fontFamily: 'Helvetica-Bold' },
  badgeActive: { backgroundColor: BRAND_LIGHT, color: BRAND },
  badgeAchieved: { backgroundColor: GREEN_LIGHT, color: GREEN },
  badgeOther: { backgroundColor: '#F3F4F6', color: GRAY },
  skillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  skillLabel: { fontSize: 9, color: GRAY, width: 60 },
  skillBarBg: { flex: 1, height: 7, backgroundColor: '#E5E7EB', borderRadius: 4, marginHorizontal: 8 },
  skillBarFill: { height: 7, backgroundColor: BRAND, borderRadius: 4 },
  skillScore: { fontSize: 9, color: DARK, width: 20, textAlign: 'right' },
  cefrBadge: { backgroundColor: BRAND, color: '#FFFFFF', fontSize: 9, fontFamily: 'Helvetica-Bold', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 8 },
  notesBox: { backgroundColor: '#F9FAFB', padding: 8, borderRadius: 4, fontSize: 9.5, color: DARK, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 6 },
  footerText: { fontSize: 7.5, color: GRAY },
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
  '5': '5級', '4': '4級', '3': '3級', 'pre-2': '準2級', '2': '2級', 'pre-1': '準1級', '1': '1級',
}

type Props = {
  student: any
  details: any
  goals: any[]
  latestSnapshot: any
  teacherName: string
}

export function StudentProfilePDF({ student, details: d, goals, latestSnapshot, teacherName }: Props) {
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
          <View>
            <Text style={s.dateGenerated}>Teacher: {teacherName}</Text>
            <Text style={[s.dateGenerated, { marginTop: 3 }]}>Generated: {format(new Date(), 'MMM d, yyyy')}</Text>
          </View>
        </View>

        <View style={s.row2}>
          {/* Left column */}
          <View style={s.col}>

            {/* Background */}
            {d && (d.age || d.grade || d.school_name || d.occupation) && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Background</Text>
                {d.age ? <View style={s.dl}><Text style={s.dt}>Age</Text><Text style={s.dd}>{d.age}</Text></View> : null}
                {d.grade ? <View style={s.dl}><Text style={s.dt}>Grade / Level</Text><Text style={s.dd}>{GRADE_LABELS[d.grade] ?? d.grade}</Text></View> : null}
                {!isAdult && d.school_name ? <View style={s.dl}><Text style={s.dt}>School</Text><Text style={s.dd}>{d.school_name}</Text></View> : null}
                {isAdult && d.occupation ? <View style={s.dl}><Text style={s.dt}>Occupation</Text><Text style={s.dd}>{d.occupation}</Text></View> : null}
              </View>
            )}

            {/* English Proficiency */}
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

            {/* Personal */}
            {d && (d.hobbies || d.likes || d.dislikes) && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Personal</Text>
                {d.hobbies ? <View style={s.dl}><Text style={s.dt}>Hobbies</Text><Text style={s.dd}>{d.hobbies}</Text></View> : null}
                {d.likes ? <View style={s.dl}><Text style={s.dt}>Likes</Text><Text style={s.dd}>{d.likes}</Text></View> : null}
                {d.dislikes ? <View style={s.dl}><Text style={s.dt}>Dislikes</Text><Text style={s.dd}>{d.dislikes}</Text></View> : null}
              </View>
            )}

            {/* Learning Goals text */}
            {d?.learning_goals && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Life Goals</Text>
                <View style={s.notesBox}>
                  <Text>{d.learning_goals}</Text>
                </View>
              </View>
            )}

            {/* Private Notes */}
            {d?.notes && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>Teacher Notes</Text>
                <View style={s.notesBox}>
                  <Text>{d.notes}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Right column */}
          <View style={s.col}>

            {/* Skill Assessment */}
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

            {/* Goals */}
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

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>NaruBase · Confidential</Text>
          <Text style={s.footerText}>{student.full_name} · {format(new Date(), 'MMM d, yyyy')}</Text>
        </View>
      </Page>
    </Document>
  )
}
