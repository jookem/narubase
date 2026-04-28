import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'

export type VRMExpression =
  | 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised' | 'relaxed'
  | 'blink' | 'blinkLeft' | 'blinkRight'

export interface VRMViewerHandle {
  setExpression: (name: string, value: number) => void
  clearExpressions: () => void
  vrm: VRM | null
}

interface Props {
  url: string
  expression?: VRMExpression | null
  autoBlink?: boolean
  orbitControls?: boolean
  className?: string
  onLoad?: (vrm: VRM) => void
  onError?: (msg: string) => void
  viewerRef?: React.MutableRefObject<VRMViewerHandle | null>
}

const EXPRESSIONS: VRMExpression[] = ['neutral', 'happy', 'angry', 'sad', 'surprised', 'relaxed']

export function VRMViewer({
  url,
  expression = 'neutral',
  autoBlink = true,
  orbitControls = true,
  className,
  onLoad,
  onError,
  viewerRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vrmRef = useRef<VRM | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const rafRef = useRef<number>(0)
  const expressionTargets = useRef<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Expose handle
  useEffect(() => {
    if (!viewerRef) return
    viewerRef.current = {
      setExpression: (name, value) => {
        expressionTargets.current = { ...expressionTargets.current, [name]: value }
      },
      clearExpressions: () => {
        expressionTargets.current = {}
        const em = vrmRef.current?.expressionManager
        if (em) EXPRESSIONS.forEach(n => em.setValue(n, 0))
      },
      get vrm() { return vrmRef.current },
    }
  }, [viewerRef])

  // Switch expression when prop changes
  useEffect(() => {
    if (!expression) return
    const targets: Record<string, number> = {}
    EXPRESSIONS.forEach(n => { targets[n] = n === expression ? 1 : 0 })
    expressionTargets.current = targets
  }, [expression])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ── Renderer ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    rendererRef.current = renderer

    // ── Scene ─────────────────────────────────────────────────
    const scene = new THREE.Scene()

    // ── Camera ────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(30, canvas.clientWidth / canvas.clientHeight, 0.1, 20)
    camera.position.set(0, 1.35, 2.2)

    // ── Lights ────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const key = new THREE.DirectionalLight(0xffffff, 1.8)
    key.position.set(1, 3, 2)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xb0c4de, 0.6)
    fill.position.set(-2, 1, -1)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.4)
    rim.position.set(0, 2, -3)
    scene.add(rim)

    // ── Grid ─────────────────────────────────────────────────
    const grid = new THREE.GridHelper(10, 20, 0x888888, 0xcccccc)
    grid.position.y = -0.01
    ;(grid.material as THREE.Material).opacity = 0.3
    ;(grid.material as THREE.Material).transparent = true
    scene.add(grid)

    // ── Orbit controls ───────────────────────────────────────
    const controls = new OrbitControls(camera, canvas)
    controls.target.set(0, 1.1, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 0.3
    controls.maxDistance = 6
    controls.maxPolarAngle = Math.PI * 0.85
    controls.enabled = orbitControls
    controls.update()

    // ── Load VRM ─────────────────────────────────────────────
    const loader = new GLTFLoader()
    loader.register(parser => new VRMLoaderPlugin(parser))

    loader.load(
      url,
      gltf => {
        const vrm = gltf.userData.vrm as VRM
        VRMUtils.removeUnnecessaryVertices(gltf.scene)
        VRMUtils.combineSkeletons(gltf.scene)
        if ((vrm.meta as any)?.metaVersion === '0') VRMUtils.rotateVRM0(vrm)
        scene.add(vrm.scene)
        vrmRef.current = vrm

        // Recentre camera on the model head
        const box = new THREE.Box3().setFromObject(vrm.scene)
        const cy = (box.min.y + box.max.y) / 2
        const height = box.max.y - box.min.y
        controls.target.set(0, cy * 0.9, 0)
        camera.position.set(0, cy * 0.95, height * 1.4)
        controls.update()

        setLoading(false)
        onLoad?.(vrm)
      },
      undefined,
      () => {
        const msg = 'Failed to load VRM file'
        setError(msg)
        setLoading(false)
        onError?.(msg)
      },
    )

    // ── Blink state ───────────────────────────────────────────
    let blinkTimer = 2
    let nextBlink = 3 + Math.random() * 3
    let blinkProgress = -1

    const clock = new THREE.Clock()

    // ── Animation loop ────────────────────────────────────────
    function animate() {
      rafRef.current = requestAnimationFrame(animate)
      const delta = Math.min(clock.getDelta(), 0.1)
      controls.update()

      const vrm = vrmRef.current
      if (vrm) {
        const em = vrm.expressionManager

        // Smooth expression transitions
        if (em) {
          for (const [name, target] of Object.entries(expressionTargets.current)) {
            const cur = em.getValue(name) ?? 0
            em.setValue(name, THREE.MathUtils.lerp(cur, target, Math.min(delta * 12, 1)))
          }
        }

        // Auto blink
        if (autoBlink && em) {
          blinkTimer += delta
          if (blinkProgress >= 0) {
            blinkProgress += delta / 0.12
            const v = blinkProgress < 0.5
              ? blinkProgress * 2
              : Math.max(0, 2 - blinkProgress * 2)
            em.setValue('blink', v)
            if (blinkProgress >= 1) {
              em.setValue('blink', 0)
              blinkProgress = -1
              blinkTimer = 0
              nextBlink = 3 + Math.random() * 4
            }
          } else if (blinkTimer > nextBlink) {
            blinkProgress = 0
          }
        }

        // Subtle idle sway
        const t = clock.elapsedTime
        if (vrm.humanoid) {
          const spine = vrm.humanoid.getRawBoneNode('spine')
          if (spine) {
            spine.rotation.z = Math.sin(t * 0.4) * 0.012
            spine.rotation.x = Math.sin(t * 0.3) * 0.008
          }
          const head = vrm.humanoid.getRawBoneNode('head')
          if (head) {
            head.rotation.y = Math.sin(t * 0.35) * 0.04
            head.rotation.x = Math.sin(t * 0.28) * 0.02 - 0.05
          }
        }

        vrm.update(delta)
      }

      renderer.render(scene, camera)
    }
    animate()

    // ── Resize observer ───────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      controls.dispose()
      if (vrmRef.current) VRMUtils.deepDispose(vrmRef.current.scene)
      renderer.dispose()
      vrmRef.current = null
      rendererRef.current = null
    }
  }, [url])

  return (
    <div className={`relative bg-gradient-to-b from-slate-800 to-slate-900 ${className ?? ''}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading VRM…</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-red-400 text-sm bg-black/40 px-4 py-2 rounded-lg">{error}</p>
        </div>
      )}
    </div>
  )
}
