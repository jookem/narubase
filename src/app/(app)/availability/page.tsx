import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AvailabilityManager } from '@/components/calendar/AvailabilityManager'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function AvailabilityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: slots } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('teacher_id', user.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  const recurringSlots = (slots ?? []).filter(s => s.slot_type === 'recurring')
  const oneOffSlots = (slots ?? []).filter(s => s.slot_type === 'one_off')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Availability</h1>
        <p className="text-gray-500 text-sm mt-1">
          Set your recurring schedule and one-off available slots. Students can book within these times.
        </p>
      </div>

      <AvailabilityManager
        recurringSlots={recurringSlots}
        oneOffSlots={oneOffSlots}
      />
    </div>
  )
}
