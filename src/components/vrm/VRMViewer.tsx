import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { retargetMixamoClip } from '@/lib/mixamoRetarget'

export type VRMExpression =
  | 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised' | 'relaxed' | 'thinking'
  | 'blink' | 'blinkLeft' | 'blinkRight'

export interface VRMViewerHandle {
  setExpression: (name: string, value: number) => void
  clearExpressions: () => void
  vrm: VRM | null
}

interface Props {
  url: string
  expression?: VRMExpression | null
  animationMap?: Record<string, string>
  autoBlink?: boolean
  orbitControls?: boolean
  showGrid?: boolean
  facingDirection?: 'left' | 'right'
  framing?: 'full' | 'bust' | 'head'
  cameraOffsetX?: number
  transparent?: boolean
  className?: string
  onLoad?: (vrm: VRM | null) => void
  onError?: (msg: string) => void
  viewerRef?: React.MutableRefObject<VRMViewerHandle | null>
}

const EXPRESSIONS: VRMExpression[] = ['neutral', 'happy', 'angry', 'sad', 'surprised', 'relaxed', 'thinking']

// Whether OffscreenCanvas is supported (once per session)
const SUPPORTS_OFFSCREEN = typeof OffscreenCanvas !== 'undefined'

export function VRMViewer({
  url,
  expression = 'neutral',
  animationMap,
  autoBlink = true,
  orbitControls = true,
  showGrid = false,
  facingDirection,
  framing = 'full',
  cameraOffsetX = 0,
  transparent = false,
  className,
  onLoad,
  onError,
  viewerRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)

  // Main-thread refs (only used in fallback path)
  const vrmRef            = useRef<VRM | null>(null)
  const rendererRef       = useRef<THREE.WebGLRenderer | null>(null)
  const rafRef            = useRef<number>(0)
  const expressionTargets = useRef<Record<string, number>>({})
  const desiredAnimUrlRef = useRef<string | null>(null)
  const currentAnimUrlRef = useRef<string | null>(null)
  const animationMapRef   = useRef<Record<string, string>>(animationMap ?? {})

  const [loading, setLoading]   = useState(true)
  const [loadPct, setLoadPct]   = useState<number | null>(null)
  const [error, setError]       = useState<string | null>(null)

  // ── Worker path: expression / animationMap prop changes ────────────────
  useEffect(() => {
    if (!SUPPORTS_OFFSCREEN) return
    workerRef.current?.postMessage({ type: 'expression', name: expression ?? 'neutral' })
  }, [expression])

  useEffect(() => {
    if (!SUPPORTS_OFFSCREEN) return
    workerRef.current?.postMessage({ type: 'animationMap', map: animationMap ?? {} })
  }, [animationMap])

  // ── Main-thread path: expression / animationMap prop changes ──────────
  useEffect(() => {
    if (SUPPORTS_OFFSCREEN || !expression) return
    const targets: Record<string, number> = {}
    EXPRESSIONS.forEach(n => { targets[n] = n === expression ? 1 : 0 })
    expressionTargets.current = targets
    const map = animationMapRef.current
    desiredAnimUrlRef.current = map[expression] ?? map['neutral'] ?? null
  }, [expression])

  useEffect(() => {
    if (SUPPORTS_OFFSCREEN) return
    animationMapRef.current = animationMap ?? {}
    const map = animationMap ?? {}
    desiredAnimUrlRef.current = expression ? (map[expression] ?? map['neutral'] ?? null) : null
  }, [animationMap, expression])

  // ── viewerRef handle ──────────────────────────────────────────────────
  useEffect(() => {
    if (!viewerRef) return
    if (SUPPORTS_OFFSCREEN) {
      viewerRef.current = {
        setExpression: (name, value) => workerRef.current?.postMessage({ type: 'exprValue', name, value }),
        clearExpressions: () => workerRef.current?.postMessage({ type: 'clearExprs' }),
        get vrm() { return null },
      }
    } else {
      viewerRef.current = {
        setExpression: (name, value) => { expressionTargets.current = { ...expressionTargets.current, [name]: value } },
        clearExpressions: () => {
          expressionTargets.current = {}
          const em = vrmRef.current?.expressionManager
          if (em) EXPRESSIONS.forEach(n => em.setValue(n, 0))
        },
        get vrm() { return vrmRef.current },
      }
    }
  }, [viewerRef])

  // ── Worker path: main initialisation ─────────────────────────────────
  useEffect(() => {
    if (!SUPPORTS_OFFSCREEN) return
    const canvas = canvasRef.current
    if (!canvas) return

    setLoading(true); setLoadPct(null); setError(null)
    let cancelled = false

    const worker = new Worker(new URL('./vrm.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    const offscreen = canvas.transferControlToOffscreen()
    worker.postMessage(
      {
        type: 'init',
        canvas: offscreen,
        url,
        expression: expression ?? 'neutral',
        animationMap: animationMap ?? {},
        config: { autoBlink, orbitControls, showGrid, facingDirection, framing, cameraOffsetX },
      },
      [offscreen],
    )

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      if (cancelled) return
      if (msg.type === 'progress') { setLoadPct(msg.pct) }
      else if (msg.type === 'loaded') { setLoadPct(null); setLoading(false); onLoad?.(null) }
      else if (msg.type === 'error')  { setError(msg.msg); setLoading(false); onError?.(msg.msg) }
    }

    // Forward pointer events for OrbitControls
    let dragging = false
    const onDown = (e: PointerEvent) => {
      dragging = true
      worker.postMessage({ type: 'pointer', eventType: 'pointerdown', x: e.clientX, y: e.clientY, button: e.button, buttons: e.buttons })
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      worker.postMessage({ type: 'pointer', eventType: 'pointermove', x: e.clientX, y: e.clientY, button: e.button, buttons: e.buttons })
    }
    const onUp = (e: PointerEvent) => {
      dragging = false
      worker.postMessage({ type: 'pointer', eventType: 'pointerup', x: e.clientX, y: e.clientY, button: e.button, buttons: e.buttons })
    }
    const onWheel = (e: WheelEvent) => { e.preventDefault(); worker.postMessage({ type: 'wheel', deltaY: e.deltaY }) }
    const onCtx   = (e: Event)      => { e.preventDefault(); worker.postMessage({ type: 'contextmenu' }) }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onCtx)

    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      if (w && h) worker.postMessage({ type: 'resize', w, h })
    })
    ro.observe(canvas)

    return () => {
      cancelled = true
      workerRef.current = null
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onCtx)
      ro.disconnect()
      worker.postMessage({ type: 'dispose' })
      worker.terminate()
    }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Main-thread fallback path ─────────────────────────────────────────
  useEffect(() => {
    if (SUPPORTS_OFFSCREEN) return
    const canvas = canvasRef.current
    if (!canvas) return

    setLoading(true); setLoadPct(null); setError(null)
    let cancelled = false
    let compileTimeout: ReturnType<typeof setTimeout> | null = null

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    rendererRef.current = renderer

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, canvas.clientWidth / canvas.clientHeight, 0.1, 20)
    camera.position.set(0, 1.35, 2.2)

    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(1, 3, 2); scene.add(key)
    const fill = new THREE.DirectionalLight(0xb0c4de, 0.6); fill.position.set(-2, 1, -1); scene.add(fill)
    const rim  = new THREE.DirectionalLight(0xffffff, 0.4); rim.position.set(0, 2, -3); scene.add(rim)

    if (showGrid) {
      const grid = new THREE.GridHelper(10, 20, 0x888888, 0xcccccc)
      grid.position.y = -0.01
      ;(grid.material as THREE.Material).opacity = 0.3
      ;(grid.material as THREE.Material).transparent = true
      scene.add(grid)
    }

    const ctrl = new OrbitControls(camera, canvas)
    ctrl.target.set(0, 1.1, 0); ctrl.enableDamping = true; ctrl.dampingFactor = 0.08
    ctrl.minDistance = 0.3; ctrl.maxDistance = 6; ctrl.maxPolarAngle = Math.PI * 0.85
    ctrl.enabled = orbitControls; ctrl.update()

    const vrmaLoader = new GLTFLoader(); vrmaLoader.register(p => new VRMAnimationLoaderPlugin(p))
    const fbxLoaderM = new FBXLoader()
    const clipCache  = new Map<string, THREE.AnimationClip>()
    let   mixerM: THREE.AnimationMixer | null = null
    let   currentAction: THREE.AnimationAction | null = null

    function playClip(clip: THREE.AnimationClip) {
      if (!mixerM) return
      const action = mixerM.clipAction(clip)
      if (currentAction === action) return
      currentAction?.fadeOut(0.4)
      action.reset(); action.loop = THREE.LoopRepeat; action.fadeIn(0.4); action.play()
      currentAction = action
    }

    function switchAnim(aurl: string | null) {
      currentAnimUrlRef.current = aurl
      if (!aurl || !vrmRef.current) { currentAction?.fadeOut(0.4); currentAction = null; return }
      if (!mixerM) mixerM = new THREE.AnimationMixer(vrmRef.current.scene)
      const cached = clipCache.get(aurl); if (cached) { playClip(cached); return }
      const isFbx = aurl.split('?')[0].toLowerCase().endsWith('.fbx')
      if (isFbx) {
        fbxLoaderM.load(aurl, fbx => {
          if (!vrmRef.current || currentAnimUrlRef.current !== aurl) return
          const clip = retargetMixamoClip(fbx.animations[0], vrmRef.current)
          if (!clip.tracks.length) return
          clipCache.set(aurl, clip); playClip(clip)
        })
      } else {
        vrmaLoader.load(aurl, gltf => {
          if (!gltf.userData.vrmAnimations?.length || !vrmRef.current || currentAnimUrlRef.current !== aurl) return
          const clip = createVRMAnimationClip(gltf.userData.vrmAnimations[0], vrmRef.current)
          clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position'))
          if (!clip.tracks.length) return
          clipCache.set(aurl, clip); playClip(clip)
        })
      }
    }

    THREE.Cache.enabled = true
    const loader = new GLTFLoader(); loader.register(p => new VRMLoaderPlugin(p))

    loader.load(
      url,
      gltf => {
        if (cancelled) return
        const vrm = gltf.userData.vrm as VRM
        if ((vrm.meta as any)?.metaVersion === '0') VRMUtils.rotateVRM0(vrm)
        scene.add(vrm.scene); vrmRef.current = vrm

        if (vrm.humanoid) {
          const la = vrm.humanoid.getRawBoneNode('leftUpperArm');  if (la) la.rotation.z  =  Math.PI * 0.22
          const ra = vrm.humanoid.getRawBoneNode('rightUpperArm'); if (ra) ra.rotation.z  = -Math.PI * 0.22
          const ll = vrm.humanoid.getRawBoneNode('leftLowerArm');  if (ll) ll.rotation.z  =  Math.PI * 0.05
          const rl = vrm.humanoid.getRawBoneNode('rightLowerArm'); if (rl) rl.rotation.z  = -Math.PI * 0.05
        }

        if (facingDirection) vrm.scene.rotation.y += facingDirection === 'right' ? Math.PI * 0.25 : -Math.PI * 0.25

        const box = new THREE.Box3().setFromObject(vrm.scene); const h = box.max.y - box.min.y
        if (framing === 'bust') {
          const fb = box.min.y + h * 0.62, ft = box.min.y + h * 1.03, cy = (fb + ft) / 2
          ctrl.target.set(cameraOffsetX, cy, 0); camera.position.set(cameraOffsetX, cy, (ft - fb) / 2 / Math.tan(Math.PI / 12))
        } else if (framing === 'head') {
          const fb = box.min.y + h * 0.79, ft = box.min.y + h * 1.02, cy = (fb + ft) / 2
          ctrl.target.set(cameraOffsetX, cy, 0); camera.position.set(cameraOffsetX, cy, (ft - fb) / 2 / Math.tan(Math.PI / 12))
        } else {
          const cy = (box.min.y + box.max.y) / 2; ctrl.target.set(0, cy * 0.9, 0); camera.position.set(0, cy * 0.95, h * 1.4)
        }
        ctrl.update()

        if (desiredAnimUrlRef.current) { mixerM = new THREE.AnimationMixer(vrm.scene); switchAnim(desiredAnimUrlRef.current) }

        if (!cancelled) setLoadPct(95)
        let revealed = false
        const doReveal = () => {
          if (revealed || cancelled) return; revealed = true
          if (compileTimeout) { clearTimeout(compileTimeout); compileTimeout = null }
          vrmLoadedRef.current = true; prevTimeRef.current = performance.now()
          setLoadPct(null); setLoading(false); onLoad?.(vrm)
        }
        compileTimeout = setTimeout(doReveal, 8_000)
        if (typeof (renderer as any).compileAsync === 'function') {
          ;(renderer as any).compileAsync(scene, camera).then(doReveal).catch(doReveal)
        } else {
          renderer.compile(scene, camera); doReveal()
        }
      },
      (ev: ProgressEvent) => {
        if (cancelled || !ev.lengthComputable || !ev.total) return
        setLoadPct(Math.min(90, Math.round(ev.loaded / ev.total * 90)))
      },
      () => { if (!cancelled) { setError('Failed to load VRM file'); setLoading(false); onError?.('Failed to load VRM file') } },
    )

    let blinkTimer = 2, nextBlink = 3 + Math.random() * 3, blinkProgress = -1
    const vrmLoadedRef = { current: false }
    const prevTimeRef  = { current: performance.now() }
    let elapsed = 0, lastFrameTime = 0
    const FRAME_MS = 1000 / 30

    function animate(ts: number) {
      rafRef.current = requestAnimationFrame(animate)
      if (!vrmLoadedRef.current) return
      if (ts - lastFrameTime < FRAME_MS) return
      lastFrameTime = ts

      const delta = Math.min((ts - prevTimeRef.current) / 1000, 0.1)
      prevTimeRef.current = ts; elapsed += delta
      ctrl.update()

      const vrm = vrmRef.current
      if (vrm) {
        const em = vrm.expressionManager
        if (em) {
          for (const [n, t] of Object.entries(expressionTargets.current))
            em.setValue(n, THREE.MathUtils.lerp(em.getValue(n) ?? 0, t, Math.min(delta * 12, 1)))
        }
        if (autoBlink && em) {
          blinkTimer += delta
          if (blinkProgress >= 0) {
            blinkProgress += delta / 0.12
            em.setValue('blink', blinkProgress < 0.5 ? blinkProgress * 2 : Math.max(0, 2 - blinkProgress * 2))
            if (blinkProgress >= 1) { em.setValue('blink', 0); blinkProgress = -1; blinkTimer = 0; nextBlink = 3 + Math.random() * 4 }
          } else if (blinkTimer > nextBlink) blinkProgress = 0
        }
        const desired = desiredAnimUrlRef.current
        if (desired !== currentAnimUrlRef.current) { if (desired && !mixerM) mixerM = new THREE.AnimationMixer(vrm.scene); if (mixerM) switchAnim(desired) }
        if (!currentAction) {
          const spine = vrm.humanoid?.getRawBoneNode('spine')
          if (spine) { spine.rotation.z = Math.sin(elapsed * 0.4) * 0.012; spine.rotation.x = Math.sin(elapsed * 0.3) * 0.008 }
          const head = vrm.humanoid?.getRawBoneNode('head')
          if (head) { head.rotation.y = Math.sin(elapsed * 0.35) * 0.04; head.rotation.x = Math.sin(elapsed * 0.28) * 0.02 - 0.05 }
        }
        mixerM?.update(delta); vrm.update(delta)
      }
      renderer.render(scene, camera)
    }
    animate(prevTimeRef.current)

    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
    })
    ro.observe(canvas)

    return () => {
      cancelled = true
      if (compileTimeout) clearTimeout(compileTimeout)
      cancelAnimationFrame(rafRef.current); ro.disconnect(); ctrl.dispose()
      currentAction?.stop(); mixerM?.stopAllAction(); clipCache.clear()
      currentAnimUrlRef.current = null
      if (vrmRef.current) VRMUtils.deepDispose(vrmRef.current.scene)
      renderer.dispose(); vrmRef.current = null; rendererRef.current = null
    }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className={`relative ${transparent ? '' : 'bg-gradient-to-b from-slate-800 to-slate-900'} ${className ?? ''}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">
            {loadPct === null ? 'Loading VRM…' : loadPct >= 95 ? 'Preparing…' : `Loading… ${loadPct}%`}
          </p>
          {loadPct !== null && (
            <div className="w-28 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-brand rounded-full transition-all duration-200" style={{ width: `${loadPct}%` }} />
            </div>
          )}
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
