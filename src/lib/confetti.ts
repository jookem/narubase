import confetti from 'canvas-confetti'

export function launchConfetti() {
  // Two bursts from the sides
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.2, y: 0.6 },
    colors: ['#02508E', '#9b51e0', '#10b981', '#f59e0b', '#ef4444'],
  })
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { x: 0.8, y: 0.6 },
      colors: ['#02508E', '#9b51e0', '#10b981', '#f59e0b', '#ef4444'],
    })
  }, 150)
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 90,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#02508E', '#9b51e0', '#10b981', '#f59e0b', '#ef4444'],
    })
  }, 350)
}

// Small single burst for a frequent in-game moment (e.g. catching a word) —
// launchConfetti()'s three staggered bursts are sized for a one-off level
// clear, not something that fires every few seconds.
export function launchGoalConfetti() {
  confetti({
    particleCount: 40,
    spread: 65,
    startVelocity: 32,
    origin: { x: 0.5, y: 0.45 },
    colors: ['#5AB468', '#F2879B', '#7FB8E0', '#E0A52E'],
  })
}
