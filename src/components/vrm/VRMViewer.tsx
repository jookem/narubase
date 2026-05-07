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
  /** Map of VRM expression name → .vrma animation URL. Lazy-loaded and crossfaded. */
  animationMap?: Record<string, string>
  autoBlink?: boolean
  orbitControls?: boolean
  showGrid?: boolean
  facingDirection?: 'left' | 'right'
  framing?: 'full' | 'bust' | 'head'
  /** Shift camera & target horizontally in world units. Positive = character appears left of centre. */
  cameraOffsetX?: number
  transparent?: boolean
  className?: string
  onLoad?: (vrm: VRM) => void
  onError?: (msg: string) => void
  viewerRef?: React.MutableRefObject<VRMViewerHandle | null>
}

const EXPRESSIONS: VRMExpression[] = ['neutral', 'happy', 'angry', 'sad', 'surprised', 'relaxed', 'thinking']

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
  const vrmRef = useRef<VRM | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const rafRef = useRef<number>(0)
  const expressionTargets = useRef<Record<string, number>>({})

  // Animation: desired URL (set from expression effect), current URL (set when playing starts)
  const desiredAnimUrlRef = useRef<string | null>(null)
  const currentAnimUrlRef = useRef<string | null>(null)
  // Map ref stays current without triggering re-renders
  const animationMapRef = useRef<Record<string, string>>(animationMap ?? {})

  const [loading, setLoading] = useState(true)
  const [loadPct, setLoadPct] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep animationMapRef and desiredAnimUrl in sync when props change
  useEffect(() => {
    animationMapRef.current = animationMap ?? {}
    const map = animationMap ?? {}
    const desired = expression ? (map[expression] ?? map['neutral'] ?? null) : null
    desiredAnimUrlRef.current = desired
    console.log('[VRMViewer] mapSync', { expression, keys: Object.keys(map), desired: desired?.split('/').pop() })
  }, [animationMap, expression])

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

  // Switch expression targets + desired animation when expression prop changes
  useEffect(() => {
    if (!expression) return
    const targets: Record<string, number> = {}
    EXPRESSIONS.forEach(n => { targets[n] = n === expression ? 1 : 0 })
    expressionTargets.current = targets
    const map = animationMapRef.current
    desiredAnimUrlRef.current = map[expression] ?? map['neutral'] ?? null
  }, [expression])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false

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
    if (showGrid) {
      const grid = new THREE.GridHelper(10, 20, 0x888888, 0xcccccc)
      grid.position.y = -0.01
      ;(grid.material as THREE.Material).opacity = 0.3
      ;(grid.material as THREE.Material).transparent = true
      scene.add(grid)
    }

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

    // ── Animation state (local to this effect) ────────────────
    const vrmaLoader = new GLTFLoader()
    vrmaLoader.register(parser => new VRMAnimationLoaderPlugin(parser))
    const fbxLoader  = new FBXLoader()

    const clipCache    = new Map<string, THREE.AnimationClip>()
    const loadingAnims = new Set<string>()
    let mixer: THREE.AnimationMixer | null = null
    let currentAction: THREE.AnimationAction | null = null

    function playClip(clip: THREE.AnimationClip) {
      if (!mixer) return
      const action = mixer.clipAction(clip)
      if (currentAction === action) return
      currentAction?.fadeOut(0.4)
      // reset() before fadeIn clears any residual weight/time state on the action object
      action.reset()
      action.loop = THREE.LoopRepeat
      action.fadeIn(0.4)
      action.play()
      currentAction = action
    }

    function switchAnim(url: string | null) {
      currentAnimUrlRef.current = url

      if (!url || !vrmRef.current) {
        currentAction?.fadeOut(0.4)
        currentAction = null
        return
      }

      if (!mixer) mixer = new THREE.AnimationMixer(vrmRef.current.scene)

      const cached = clipCache.get(url)
      if (cached) { playClip(cached); return }
      if (loadingAnims.has(url)) return

      loadingAnims.add(url)

      const isFbx = url.split('?')[0].toLowerCase().endsWith('.fbx')

      if (isFbx) {
        fbxLoader.load(
          url,
          fbx => {
            loadingAnims.delete(url)
            if (!vrmRef.current || currentAnimUrlRef.current !== url) return
            const srcClip = fbx.animations[0]
            if (!srcClip) return
            const clip = retargetMixamoClip(srcClip, vrmRef.current)
            if (clip.tracks.length === 0) return
            clipCache.set(url, clip)
            playClip(clip)
          },
          undefined,
          err => {
            loadingAnims.delete(url)
            console.error('[VRMViewer] FBX load error:', err)
          },
        )
      } else {
        vrmaLoader.load(url, gltf => {
          loadingAnims.delete(url)
          if (!gltf.userData.vrmAnimations?.length || !vrmRef.current) return
          if (currentAnimUrlRef.current !== url) return
          const clip = createVRMAnimationClip(gltf.userData.vrmAnimations[0], vrmRef.current)
          // Strip all position tracks so every emotion plays at the character's
          // rest position — any offset shifts the character relative to animations
          // that have no position tracks.
          clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position'))
          // If only position tracks existed, don't play an empty clip (T-pose);
          // let idle sway continue instead.
          if (clip.tracks.length === 0) return
          clipCache.set(url, clip)
          playClip(clip)
        })
      }
    }

    // ── Load VRM ─────────────────────────────────────────────
    const loader = new GLTFLoader()
    loader.register(parser => new VRMLoaderPlugin(parser))

    // Cache raw binary so the same URL isn't re-fetched when two viewers share it
    THREE.Cache.enabled = true

    loader.load(
      url,
      gltf => {
        const vrm = gltf.userData.vrm as VRM
        // Both removeUnnecessaryVertices and combineSkeletons are optional
        // optimisation passes that can freeze the main thread for 500ms–5s+
        // on complex models (O(n²) bone-mapping in combineSkeletons). Skip both.
        if ((vrm.meta as any)?.metaVersion === '0') VRMUtils.rotateVRM0(vrm)
        scene.add(vrm.scene)
        vrmRef.current = vrm

        // Natural A-pose
        if (vrm.humanoid) {
          const leftUpperArm  = vrm.humanoid.getRawBoneNode('leftUpperArm')
          const rightUpperArm = vrm.humanoid.getRawBoneNode('rightUpperArm')
          const leftLowerArm  = vrm.humanoid.getRawBoneNode('leftLowerArm')
          const rightLowerArm = vrm.humanoid.getRawBoneNode('rightLowerArm')
          if (leftUpperArm)  leftUpperArm.rotation.z  =  Math.PI * 0.22
          if (rightUpperArm) rightUpperArm.rotation.z = -Math.PI * 0.22
          if (leftLowerArm)  leftLowerArm.rotation.z  =  Math.PI * 0.05
          if (rightLowerArm) rightLowerArm.rotation.z = -Math.PI * 0.05
        }

        // Facing direction (positive Y = turns toward viewer's right)
        if (facingDirection) {
          const offset = Math.PI * 0.25
          vrm.scene.rotation.y += facingDirection === 'right' ? offset : -offset
        }

        // Camera framing
        const box = new THREE.Box3().setFromObject(vrm.scene)
        const height = box.max.y - box.min.y

        if (framing === 'bust') {
          // Frame from lower-chest (62%) to just above head (103%), camera looks straight ahead
          const frameBottom = box.min.y + height * 0.62
          const frameTop    = box.min.y + height * 1.03
          const centerY     = (frameBottom + frameTop) / 2
          const halfH       = (frameTop - frameBottom) / 2
          const camZ        = halfH / Math.tan(Math.PI / 12) // tan(15°) for 30° FOV
          // cameraOffsetX shifts camera & target together so character appears off-centre
          controls.target.set(cameraOffsetX, centerY, 0)
          camera.position.set(cameraOffsetX, centerY, camZ)
        } else if (framing === 'head') {
          // Neck (79%) to just above hair/accessories (102%) — head fills top of circle
          const frameBottom = box.min.y + height * 0.79
          const frameTop    = box.min.y + height * 1.02
          const centerY     = (frameBottom + frameTop) / 2
          const halfH       = (frameTop - frameBottom) / 2
          const camZ        = halfH / Math.tan(Math.PI / 12)
          controls.target.set(cameraOffsetX, centerY, 0)
          camera.position.set(cameraOffsetX, centerY, camZ)
        } else {
          const cy = (box.min.y + box.max.y) / 2
          controls.target.set(0, cy * 0.9, 0)
          camera.position.set(0, cy * 0.95, height * 1.4)
        }
        controls.update()

        // Start animation for current expression if map has one
        if (desiredAnimUrlRef.current) {
          mixer = new THREE.AnimationMixer(vrm.scene)
          switchAnim(desiredAnimUrlRef.current)
        }

        // Pre-warm GPU: compileAsync uses KHR_parallel_shader_compile off the
        // main thread when the extension is available, avoiding the freeze that
        // happens when shaders compile synchronously on the first render call.
        if (!cancelled) setLoadPct(95)  // download done, GPU prep next

        const doReveal = () => {
          if (cancelled) return
          vrmLoaded = true
          prevTime = performance.now()
          setLoadPct(null)
          setLoading(false)
          onLoad?.(vrm)
        }
        if (typeof (renderer as any).compileAsync === 'function') {
          ;(renderer as any).compileAsync(scene, camera).then(doReveal)
        } else {
          // Fallback: force GPU upload synchronously while spinner is still visible
          renderer.render(scene, camera)
          doReveal()
        }
      },
      (event: ProgressEvent) => {
        if (cancelled) return
        if (event.lengthComputable && event.total > 0) {
          setLoadPct(Math.min(90, Math.round(event.loaded / event.total * 90)))
        }
      },
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

    let prevTime = performance.now()
    let elapsed = 0
    let lastFrameTime = 0
    let vrmLoaded = false
    const FRAME_MS = 1000 / 30  // cap at 30fps

    // ── Animation loop ────────────────────────────────────────
    function animate(timestamp: number) {
      rafRef.current = requestAnimationFrame(animate)

      // Skip all rendering until VRM is in scene to keep main thread free during loading
      if (!vrmLoaded) return

      // Cap at 30fps — halves GPU work and gives the main thread more breathing room
      if (timestamp - lastFrameTime < FRAME_MS) return
      lastFrameTime = timestamp

      const delta = Math.min((timestamp - prevTime) / 1000, 0.1)
      prevTime = timestamp
      elapsed += delta
      controls.update()

      const vrm = vrmRef.current
      if (vrm) {
        const em = vrm.expressionManager

        // Smooth blend-shape transitions
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

        // Switch animation if expression changed (create mixer lazily if needed)
        const desired = desiredAnimUrlRef.current
        if (desired !== currentAnimUrlRef.current) {
          if (desired && !mixer) mixer = new THREE.AnimationMixer(vrm.scene)
          if (mixer) switchAnim(desired)
        }

        // Idle sway only when no animation is playing
        if (!currentAction) {
          const t = elapsed
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
        }

        mixer?.update(delta)
        vrm.update(delta)
      }

      renderer.render(scene, camera)
    }
    animate(prevTime)

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
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      controls.dispose()
      currentAction?.stop()
      mixer?.stopAllAction()
      clipCache.clear()
      currentAnimUrlRef.current = null
      if (vrmRef.current) VRMUtils.deepDispose(vrmRef.current.scene)
      renderer.dispose()
      vrmRef.current = null
      rendererRef.current = null
    }
  }, [url])

  return (
    <div className={`relative ${transparent ? '' : 'bg-gradient-to-b from-slate-800 to-slate-900'} ${className ?? ''}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">
            {loadPct === null
              ? 'Loading VRM…'
              : loadPct >= 95
              ? 'Preparing…'
              : `Loading… ${loadPct}%`}
          </p>
          {loadPct !== null && (
            <div className="w-28 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-200"
                style={{ width: `${loadPct}%` }}
              />
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
