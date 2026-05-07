import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { retargetMixamoClip } from '@/lib/mixamoRetarget'

// ── Types ──────────────────────────────────────────────────────────────────

type VRMExpression = 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised' | 'relaxed' | 'thinking'

interface WorkerConfig {
  autoBlink: boolean
  orbitControls: boolean
  showGrid: boolean
  facingDirection?: 'left' | 'right'
  framing: 'full' | 'bust' | 'head'
  cameraOffsetX: number
}

// ── Fake DOM element for OrbitControls ────────────────────────────────────
// Three.js 0.184 uses domElement.getRootNode() for offscreen canvas compat.
// Returning globalThis makes pointermove/pointerup listeners attach to the
// worker scope, where we can dispatch them from the message handler.

class FakeElement extends EventTarget {
  style = { cursor: '' as string, touchAction: '' as string }
  clientWidth = 0
  clientHeight = 0

  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight }
  }
  getRootNode() { return globalThis as unknown as EventTarget }
  get ownerDocument() { return globalThis as unknown as Document }
  setPointerCapture() {}
  releasePointerCapture() {}
}

// ── Module-level state ────────────────────────────────────────────────────

const fakeElement = new FakeElement()
const EXPRESSIONS: VRMExpression[] = ['neutral', 'happy', 'angry', 'sad', 'surprised', 'relaxed', 'thinking']
const FRAME_MS = 1000 / 30

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let vrmObj: VRM | null = null
let mixer: THREE.AnimationMixer | null = null
let currentAction: THREE.AnimationAction | null = null
const clipCache = new Map<string, THREE.AnimationClip>()
let rafId = 0
let vrmLoaded = false
let prevTime = 0
let elapsed = 0
let lastFrameTime = 0
let expressionTargets: Record<string, number> = {}
let desiredAnimUrl: string | null = null
let currentAnimUrl: string | null = null
let animMap: Record<string, string> = {}
let autoBlink = true
let blinkTimer = 2
let nextBlink = 3 + Math.random() * 3
let blinkProgress = -1

// Lazily created loaders (created on init, reused for animations)
let vrmaLoader: GLTFLoader | null = null
let fbxLoader: FBXLoader | null = null

// ── Message handler ───────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const msg = e.data
  switch (msg.type) {
    case 'init':         handleInit(msg);           break
    case 'expression':   handleExpression(msg.name); break
    case 'animationMap': handleAnimMap(msg.map);     break
    case 'exprValue':    handleExprValue(msg.name, msg.value); break
    case 'clearExprs':   handleClearExprs();         break
    case 'pointer':      handlePointer(msg);         break
    case 'wheel':        handleWheel(msg);           break
    case 'contextmenu':  fakeElement.dispatchEvent(new Event('contextmenu')); break
    case 'resize':       handleResize(msg.w, msg.h); break
    case 'dispose':      handleDispose();            break
  }
}

// ── Init ──────────────────────────────────────────────────────────────────

function handleInit(msg: { canvas: OffscreenCanvas; url: string; expression: string; animationMap: Record<string, string>; config: WorkerConfig }) {
  const { canvas, url, config } = msg
  animMap = msg.animationMap
  autoBlink = config.autoBlink

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(self.devicePixelRatio ?? 1, 2))
  renderer.setSize(canvas.width, canvas.height, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(30, canvas.width / (canvas.height || 1), 0.1, 20)
  camera.position.set(0, 1.35, 2.2)

  scene.add(new THREE.AmbientLight(0xffffff, 1.2))
  const key = new THREE.DirectionalLight(0xffffff, 1.8)
  key.position.set(1, 3, 2); scene.add(key)
  const fill = new THREE.DirectionalLight(0xb0c4de, 0.6)
  fill.position.set(-2, 1, -1); scene.add(fill)
  const rim = new THREE.DirectionalLight(0xffffff, 0.4)
  rim.position.set(0, 2, -3); scene.add(rim)

  if (config.showGrid) {
    const grid = new THREE.GridHelper(10, 20, 0x888888, 0xcccccc)
    grid.position.y = -0.01
    ;(grid.material as THREE.Material).opacity = 0.3
    ;(grid.material as THREE.Material).transparent = true
    scene.add(grid)
  }

  fakeElement.clientWidth  = canvas.width
  fakeElement.clientHeight = canvas.height
  controls = new OrbitControls(camera, fakeElement as unknown as HTMLElement)
  controls.target.set(0, 1.1, 0)
  controls.enableDamping   = true
  controls.dampingFactor   = 0.08
  controls.minDistance     = 0.3
  controls.maxDistance     = 6
  controls.maxPolarAngle   = Math.PI * 0.85
  controls.enabled         = config.orbitControls
  controls.update()

  // Set initial expression targets
  const initExpr = msg.expression as VRMExpression
  EXPRESSIONS.forEach(n => { expressionTargets[n] = n === initExpr ? 1 : 0 })
  desiredAnimUrl = animMap[initExpr] ?? animMap['neutral'] ?? null

  vrmaLoader = new GLTFLoader()
  vrmaLoader.register(p => new VRMAnimationLoaderPlugin(p))
  fbxLoader = new FBXLoader()

  THREE.Cache.enabled = true

  const loader = new GLTFLoader()
  loader.register(p => new VRMLoaderPlugin(p))

  loader.load(
    url,
    gltf => {
      const vrm = gltf.userData.vrm as VRM
      if ((vrm.meta as any)?.metaVersion === '0') VRMUtils.rotateVRM0(vrm)
      scene!.add(vrm.scene)
      vrmObj = vrm

      if (vrm.humanoid) {
        const la = vrm.humanoid.getRawBoneNode('leftUpperArm')
        const ra = vrm.humanoid.getRawBoneNode('rightUpperArm')
        const ll = vrm.humanoid.getRawBoneNode('leftLowerArm')
        const rl = vrm.humanoid.getRawBoneNode('rightLowerArm')
        if (la) la.rotation.z  =  Math.PI * 0.22
        if (ra) ra.rotation.z  = -Math.PI * 0.22
        if (ll) ll.rotation.z  =  Math.PI * 0.05
        if (rl) rl.rotation.z  = -Math.PI * 0.05
      }

      if (config.facingDirection) {
        vrm.scene.rotation.y += config.facingDirection === 'right' ? Math.PI * 0.25 : -Math.PI * 0.25
      }

      const box    = new THREE.Box3().setFromObject(vrm.scene)
      const height = box.max.y - box.min.y

      if (config.framing === 'bust') {
        const fb = box.min.y + height * 0.62
        const ft = box.min.y + height * 1.03
        const cy = (fb + ft) / 2
        const cz = (ft - fb) / 2 / Math.tan(Math.PI / 12)
        controls!.target.set(config.cameraOffsetX, cy, 0)
        camera!.position.set(config.cameraOffsetX, cy, cz)
      } else if (config.framing === 'head') {
        const fb = box.min.y + height * 0.79
        const ft = box.min.y + height * 1.02
        const cy = (fb + ft) / 2
        const cz = (ft - fb) / 2 / Math.tan(Math.PI / 12)
        controls!.target.set(config.cameraOffsetX, cy, 0)
        camera!.position.set(config.cameraOffsetX, cy, cz)
      } else {
        const cy = (box.min.y + box.max.y) / 2
        controls!.target.set(0, cy * 0.9, 0)
        camera!.position.set(0, cy * 0.95, height * 1.4)
      }
      controls!.update()

      if (desiredAnimUrl) {
        mixer = new THREE.AnimationMixer(vrm.scene)
        switchAnim(desiredAnimUrl)
      }

      vrmLoaded = true
      prevTime  = performance.now()
      self.postMessage({ type: 'loaded' })
    },
    (ev: ProgressEvent) => {
      if (ev.lengthComputable && ev.total > 0) {
        self.postMessage({ type: 'progress', pct: Math.min(90, Math.round(ev.loaded / ev.total * 90)) })
      }
    },
    () => self.postMessage({ type: 'error', msg: 'Failed to load VRM file' }),
  )

  // Start render loop
  prevTime = performance.now()
  function animate(ts: number) {
    rafId = requestAnimationFrame(animate)
    if (!vrmLoaded) return
    if (ts - lastFrameTime < FRAME_MS) return
    lastFrameTime = ts

    const delta = Math.min((ts - prevTime) / 1000, 0.1)
    prevTime  = ts
    elapsed  += delta
    controls!.update()

    const vrm = vrmObj
    if (vrm) {
      const em = vrm.expressionManager
      if (em) {
        for (const [n, t] of Object.entries(expressionTargets)) {
          em.setValue(n, THREE.MathUtils.lerp(em.getValue(n) ?? 0, t, Math.min(delta * 12, 1)))
        }
      }

      if (autoBlink && em) {
        blinkTimer += delta
        if (blinkProgress >= 0) {
          blinkProgress += delta / 0.12
          const v = blinkProgress < 0.5 ? blinkProgress * 2 : Math.max(0, 2 - blinkProgress * 2)
          em.setValue('blink', v)
          if (blinkProgress >= 1) {
            em.setValue('blink', 0); blinkProgress = -1
            blinkTimer = 0; nextBlink = 3 + Math.random() * 4
          }
        } else if (blinkTimer > nextBlink) {
          blinkProgress = 0
        }
      }

      if (desiredAnimUrl !== currentAnimUrl) {
        if (desiredAnimUrl && !mixer) mixer = new THREE.AnimationMixer(vrm.scene)
        if (mixer) switchAnim(desiredAnimUrl)
      }

      if (!currentAction) {
        const spine = vrm.humanoid?.getRawBoneNode('spine')
        if (spine) { spine.rotation.z = Math.sin(elapsed * 0.4) * 0.012; spine.rotation.x = Math.sin(elapsed * 0.3) * 0.008 }
        const head = vrm.humanoid?.getRawBoneNode('head')
        if (head) { head.rotation.y = Math.sin(elapsed * 0.35) * 0.04; head.rotation.x = Math.sin(elapsed * 0.28) * 0.02 - 0.05 }
      }

      mixer?.update(delta)
      vrm.update(delta)
    }

    renderer!.render(scene!, camera!)
  }
  animate(prevTime)
}

// ── Animation helpers ─────────────────────────────────────────────────────

function switchAnim(url: string | null) {
  currentAnimUrl = url
  if (!url || !vrmObj || !mixer) { currentAction?.fadeOut(0.4); currentAction = null; return }

  const cached = clipCache.get(url)
  if (cached) { playClip(cached); return }

  const isFbx = url.split('?')[0].toLowerCase().endsWith('.fbx')
  if (isFbx) {
    fbxLoader!.load(url, fbx => {
      const src = fbx.animations[0]
      if (!src || currentAnimUrl !== url || !vrmObj) return
      const clip = retargetMixamoClip(src, vrmObj)
      if (!clip.tracks.length) return
      clipCache.set(url, clip); playClip(clip)
    })
  } else {
    vrmaLoader!.load(url, gltf => {
      if (!gltf.userData.vrmAnimations?.length || currentAnimUrl !== url || !vrmObj) return
      const clip = createVRMAnimationClip(gltf.userData.vrmAnimations[0], vrmObj)
      clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position'))
      if (!clip.tracks.length) return
      clipCache.set(url, clip); playClip(clip)
    })
  }
}

function playClip(clip: THREE.AnimationClip) {
  if (!mixer) return
  const action = mixer.clipAction(clip)
  if (currentAction === action) return
  currentAction?.fadeOut(0.4)
  action.reset(); action.loop = THREE.LoopRepeat
  action.fadeIn(0.4); action.play()
  currentAction = action
}

// ── Expression / animation map ────────────────────────────────────────────

function handleExpression(name: string) {
  EXPRESSIONS.forEach(n => { expressionTargets[n] = n === name ? 1 : 0 })
  desiredAnimUrl = animMap[name] ?? animMap['neutral'] ?? null
}

function handleAnimMap(map: Record<string, string>) {
  animMap = map
  const cur = Object.entries(expressionTargets).find(([, v]) => v > 0.5)?.[0]
  if (cur) desiredAnimUrl = map[cur] ?? map['neutral'] ?? null
}

function handleExprValue(name: string, value: number) {
  expressionTargets = { ...expressionTargets, [name]: value }
}

function handleClearExprs() {
  expressionTargets = {}
  const em = vrmObj?.expressionManager
  if (em) EXPRESSIONS.forEach(n => em.setValue(n, 0))
}

// ── Pointer / wheel events ────────────────────────────────────────────────

function makePointerEvent(msg: { eventType: string; x: number; y: number; button?: number; buttons?: number }) {
  return Object.assign(new Event(msg.eventType, { bubbles: true }), {
    pointerType: 'mouse', pointerId: 1, isPrimary: true,
    clientX: msg.x, clientY: msg.y,
    button: msg.button ?? 0, buttons: msg.buttons ?? 0,
    ctrlKey: false, shiftKey: false, altKey: false,
    preventDefault: () => {}, stopPropagation: () => {},
  })
}

function handlePointer(msg: { eventType: string; x: number; y: number; button?: number; buttons?: number }) {
  const ev = makePointerEvent(msg)
  if (msg.eventType === 'pointerdown') {
    fakeElement.dispatchEvent(ev)
  } else {
    // pointermove / pointerup are registered on globalThis by OrbitControls via getRootNode()
    ;(globalThis as unknown as EventTarget).dispatchEvent(ev)
  }
}

function handleWheel(msg: { deltaY: number }) {
  const ev = Object.assign(new Event('wheel', { bubbles: true }), {
    deltaY: msg.deltaY, ctrlKey: false,
    preventDefault: () => {}, stopPropagation: () => {},
  })
  fakeElement.dispatchEvent(ev)
}

// ── Resize / dispose ──────────────────────────────────────────────────────

function handleResize(w: number, h: number) {
  fakeElement.clientWidth  = w
  fakeElement.clientHeight = h
  renderer?.setSize(w, h, false)
  if (camera) { camera.aspect = w / (h || 1); camera.updateProjectionMatrix() }
}

function handleDispose() {
  cancelAnimationFrame(rafId)
  controls?.dispose()
  currentAction?.stop()
  mixer?.stopAllAction()
  clipCache.clear()
  if (vrmObj) VRMUtils.deepDispose(vrmObj.scene)
  renderer?.dispose()
  vrmObj = null; renderer = null
}
