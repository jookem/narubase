import { signOut } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'

export function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
        <div className="text-4xl">⏳</div>
        <h1 className="text-xl font-semibold text-gray-900">Account pending approval</h1>
        <p className="text-sm text-gray-600">
          Your teacher account is awaiting review. You will receive access once an admin approves your account.
          This usually takes 1–2 business days.
        </p>
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
