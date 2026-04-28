import * as THREE from 'three'
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'

// Mixamo bone name (camelCase, no namespace) → VRM humanoid bone name
const MIXAMO_VRM: Record<string, VRMHumanBoneName> = {
  mixamorigHips:          'hips',
  mixamorigSpine:         'spine',
  mixamorigSpine1:        'chest',
  mixamorigSpine2:        'upperChest',
  mixamorigNeck:          'neck',
  mixamorigHead:          'head',
  mixamorigLeftShoulder:  'leftShoulder',
  mixamorigLeftArm:       'leftUpperArm',
  mixamorigLeftForeArm:   'leftLowerArm',
  mixamorigLeftHand:      'leftHand',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm:      'rightUpperArm',
  mixamorigRightForeArm:  'rightLowerArm',
  mixamorigRightHand:     'rightHand',
  mixamorigLeftUpLeg:     'leftUpperLeg',
  mixamorigLeftLeg:       'leftLowerLeg',
  mixamorigLeftFoot:      'leftFoot',
  mixamorigLeftToeBase:   'leftToes',
  mixamorigRightUpLeg:    'rightUpperLeg',
  mixamorigRightLeg:      'rightLowerLeg',
  mixamorigRightFoot:     'rightFoot',
  mixamorigRightToeBase:  'rightToes',
}

/**
 * Normalise a Mixamo bone name to the camelCase format used in MIXAMO_VRM.
 * Handles three variants Mixamo produces:
 *   1. mixamorigHips          (FBX without skin / animation-only download)
 *   2. mixamorig:Hips         (FBX with skin — namespace separator)
 *   3. Hips / Spine / …       (some exports omit the prefix entirely)
 */
function normaliseMixamoName(raw: string): string {
  // strip everything up to and including the last ':' (namespace separator)
  const colonIdx = raw.lastIndexOf(':')
  const name = colonIdx === -1 ? raw : raw.slice(colonIdx + 1)

  // if it already starts with 'mixamorig' return as-is
  if (name.startsWith('mixamorig')) return name

  // otherwise it's a plain bone name like "Hips" → "mixamorigHips"
  return `mixamorig${name}`
}

/**
 * Retarget a Mixamo FBX AnimationClip to a VRM humanoid skeleton.
 *
 * Coordinate system:
 *   VRM 0.x — scene already rotated π around Y by rotateVRM0, bone local spaces
 *              are in the original +Z-forward frame → no quaternion correction needed.
 *   VRM 1.0 — model faces -Z natively; converting +Z→-Z quaternions via conjugation
 *              by 180° Y rotation simplifies to negating X and Z: (x,y,z,w)→(-x,y,-z,w).
 *
 * Non-hips position tracks are dropped to avoid root-motion drift.
 * Logs a warning to the console if zero tracks were mapped (bone name mismatch).
 */
export function retargetMixamoClip(clip: THREE.AnimationClip, vrm: VRM): THREE.AnimationClip {
  const isVrm0 = (vrm.meta as any)?.metaVersion === '0'
  const tracks: THREE.KeyframeTrack[] = []

  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.')
    if (dot === -1) continue
    const rawName = track.name.slice(0, dot)
    const prop    = track.name.slice(dot + 1)

    const normName = normaliseMixamoName(rawName)
    const vrmBone  = MIXAMO_VRM[normName]
    if (!vrmBone) continue
    const node = vrm.humanoid.getNormalizedBoneNode(vrmBone)
    if (!node) continue

    const targetName = `${node.name}.${prop}`
    const values     = new Float32Array(track.values)

    if (prop === 'quaternion') {
      if (!isVrm0) {
        for (let i = 0; i < values.length; i += 4) {
          values[i]     *= -1  // negate x
          values[i + 2] *= -1  // negate z
        }
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(targetName, track.times, values))
    }
    // position tracks dropped — Mixamo world-space hip positions teleport the character off-screen
  }

  if (tracks.length === 0) {
    // Log the first few raw track names so mismatches can be diagnosed
    const sample = clip.tracks.slice(0, 4).map(t => t.name).join(', ')
    console.warn(`[mixamoRetarget] 0 tracks mapped — bone names may not match. Sample: ${sample}`)
  }

  return new THREE.AnimationClip('mixamo', clip.duration, tracks)
}
