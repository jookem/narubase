import { Link } from 'react-router-dom'

const features = [
  {
    title: 'Lesson Management',
    desc: 'Schedule, track, and add notes for every lesson. Students can review their notes anytime.',
  },
  {
    title: 'Progress Tracking',
    desc: 'Set goals, record skill assessments, and visualize student growth over time.',
  },
  {
    title: 'Vocabulary Bank',
    desc: 'Build a personalized word list with spaced-repetition flashcard review.',
  },
  {
    title: 'Easy Booking',
    desc: 'Students book from available slots. Teachers approve with one click.',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <img src="/narubase_v2.svg" alt="NaruBase" style={{ height: 120, width: 'auto' }} className="mx-auto mb-6" />
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
          English lessons,<br />
          <span className="text-brand">organized.</span>
        </h1>
        <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
          The platform for teachers and students. Track progress, manage lessons, and build vocabulary — all in one place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            to="/signup"
            className="bg-brand text-white px-6 py-3 rounded-lg font-medium hover:bg-brand-dark transition-colors"
          >
            Start for free
          </Link>
          <Link
            to="/login"
            className="text-gray-600 px-6 py-3 rounded-lg font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map(f => (
            <div key={f.title} className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} 
      </footer>
    </div>
  )
}
