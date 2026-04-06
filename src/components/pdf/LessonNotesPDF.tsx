import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'

const BRAND = '#02508E'
const BRAND_LIGHT = '#E8F2FA'
const GRAY = '#6B7280'
const DARK = '#111827'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: DARK, padding: 40, paddingBottom: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: BRAND },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  schoolName: { fontSize: 7, color: BRAND, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, marginBottom: 3 },
  lessonTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND, marginBottom: 4 },
  lessonMeta: { fontSize: 9, color: GRAY, marginBottom: 2 },
  badge: { backgroundColor: BRAND_LIGHT, color: BRAND, fontSize: 8, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4, fontFamily: 'Helvetica-Bold' },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  body: { fontSize: 10, color: DARK, lineHeight: 1.5 },
  vocabItem: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 5, backgroundColor: BRAND_LIGHT, padding: 6, borderRadius: 4 },
  vocabWord: { fontFamily: 'Helvetica-Bold', color: BRAND, fontSize: 10 },
  vocabDash: { color: GRAY, marginHorizontal: 4 },
  vocabDef: { color: DARK, fontSize: 10, flex: 1 },
  vocabExample: { fontSize: 8.5, color: GRAY, fontStyle: 'italic', marginTop: 2, marginLeft: 2 },
  grammarItem: { backgroundColor: '#F0FDF4', padding: 6, borderRadius: 4, marginBottom: 5 },
  grammarPoint: { fontFamily: 'Helvetica-Bold', color: '#166534', fontSize: 10, marginBottom: 2 },
  grammarExp: { color: DARK, fontSize: 9 },
  row2: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  strengthBox: { backgroundColor: '#F0FDF4', padding: 8, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#16A34A' },
  focusBox: { backgroundColor: '#FFF7ED', padding: 8, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#EA580C' },
  privateBox: { backgroundColor: '#F9FAFB', padding: 8, borderRadius: 4, borderLeftWidth: 2, borderLeftColor: '#D1D5DB' },
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 6 },
  footerText: { fontSize: 7.5, color: GRAY },
  divider: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 14 },
})

type Props = {
  lesson: any
  notes: any
  studentName: string
  teacherName: string
  participants?: any[]
}

export function LessonNotesPDF({ lesson, notes, studentName, teacherName, participants }: Props) {
  const dateStr = format(new Date(lesson.scheduled_start), 'EEEE, MMMM d, yyyy')
  const timeStr = format(new Date(lesson.scheduled_start), 'h:mm a') + ' – ' + format(new Date(lesson.scheduled_end), 'h:mm a') + ' JST'
  const isGroup = participants && participants.length > 1
  const displayName = isGroup ? participants!.map((p: any) => p.full_name).join(' & ') : studentName

  const vocab = notes?.vocabulary ?? []
  const grammar = notes?.grammar_points ?? []

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.schoolName}>TOYOOKA LANGUAGE CENTRE</Text>
            <Text style={s.lessonTitle}>{isGroup ? 'Group Lesson' : `${displayName}`}</Text>
            {isGroup && <Text style={[s.lessonMeta, { marginBottom: 4 }]}>{displayName}</Text>}
            <Text style={s.lessonMeta}>{dateStr}</Text>
            <Text style={s.lessonMeta}>{timeStr}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.badge}>{lesson.lesson_type.toUpperCase()}</Text>
            <Text style={[s.lessonMeta, { marginTop: 6 }]}>Teacher: {teacherName}</Text>
          </View>
        </View>

        {/* Summary */}
        {notes?.summary && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Session Summary</Text>
            <Text style={s.body}>{notes.summary}</Text>
          </View>
        )}

        {/* Vocabulary */}
        {vocab.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Vocabulary ({vocab.length} words)</Text>
            {vocab.map((v: any, i: number) => (
              <View key={i} style={s.vocabItem}>
                <Text style={s.vocabWord}>{v.word}</Text>
                <Text style={s.vocabDash}>—</Text>
                <Text style={s.vocabDef}>{v.definition}</Text>
                {v.example ? <Text style={s.vocabExample}>"{v.example}"</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* Grammar */}
        {grammar.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Grammar Points</Text>
            {grammar.map((g: any, i: number) => (
              <View key={i} style={s.grammarItem}>
                <Text style={s.grammarPoint}>{g.point}</Text>
                {g.explanation ? <Text style={s.grammarExp}>{g.explanation}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* Homework */}
        {notes?.homework && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Homework / 宿題</Text>
            <Text style={s.body}>{notes.homework}</Text>
          </View>
        )}

        {/* Strengths + Areas */}
        {(notes?.strengths || notes?.areas_to_focus) && (
          <View style={[s.section, s.row2]}>
            {notes.strengths && (
              <View style={s.col}>
                <Text style={s.sectionLabel}>Strengths</Text>
                <View style={s.strengthBox}>
                  <Text style={s.body}>{notes.strengths}</Text>
                </View>
              </View>
            )}
            {notes.areas_to_focus && (
              <View style={s.col}>
                <Text style={s.sectionLabel}>Areas to Focus</Text>
                <View style={s.focusBox}>
                  <Text style={s.body}>{notes.areas_to_focus}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Private teacher notes */}
        {notes?.teacher_notes && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Private Notes (Teacher Only)</Text>
            <View style={s.privateBox}>
              <Text style={s.body}>{notes.teacher_notes}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Toyooka Language Centre · Confidential</Text>
          <Text style={s.footerText}>{dateStr}</Text>
        </View>
      </Page>
    </Document>
  )
}
