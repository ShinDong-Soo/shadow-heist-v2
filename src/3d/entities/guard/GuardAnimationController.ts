import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Guard } from './Guard';
import type { GuardController, GuardState } from './GuardController';

export type GuardAnimationState = 'IDLE' | 'PATROL' | 'TURN' | 'SUSPICIOUS' | 'INVESTIGATE' | 'SEARCH' | 'RETURN' | 'ALERT' | 'CHASE';

export class GuardAnimationController {
  state: GuardAnimationState = 'PATROL';
  private elapsed = 0;
  private locomotionPhase = 0;
  private distanceSinceFootstep = 0;
  private readonly previousPosition: Vector3;
  private previewIndex = -1;
  private previewState: GuardAnimationState | null = null;
  private static readonly PREVIEW_STATES: readonly GuardAnimationState[] = [
    'IDLE', 'PATROL', 'TURN', 'SUSPICIOUS', 'INVESTIGATE', 'SEARCH', 'RETURN', 'ALERT', 'CHASE',
  ];

  constructor(
    private readonly guard: Guard,
    private readonly controller: GuardController,
    private readonly onFootstep: (strength: number) => void,
  ) {
    this.previousPosition = guard.position.clone();
  }

  update(deltaTime: number) {
    const travel = Vector3.Distance(this.guard.position, this.previousPosition);
    this.previousPosition.copyFrom(this.guard.position);
    const nextState = this.previewState ?? this.mapState(this.controller.state);
    if (nextState !== this.state) {
      this.state = nextState;
      this.elapsed = 0;
      this.distanceSinceFootstep = 0;
    }
    this.elapsed += deltaTime;
    const previewTravel = this.previewState && (nextState === 'PATROL' || nextState === 'ALERT' || nextState === 'INVESTIGATE' || nextState === 'RETURN' || nextState === 'CHASE')
      ? deltaTime * (nextState === 'CHASE' ? 4.4 : nextState === 'ALERT' ? 2.55 : 1.65)
      : travel;
    this.updateLocomotion(previewTravel);
    this.applyPose(deltaTime);
  }

  reset() {
    this.state = 'PATROL';
    this.elapsed = 0;
    this.locomotionPhase = 0;
    this.distanceSinceFootstep = 0;
    this.previousPosition.copyFrom(this.guard.position);
    this.previewIndex = -1;
    this.previewState = null;
    this.guard.visual.resetPose();
  }

  cyclePreview() {
    this.previewIndex += 1;
    if (this.previewIndex >= GuardAnimationController.PREVIEW_STATES.length) {
      this.previewIndex = -1;
      this.previewState = null;
      return 'AUTO';
    }
    this.previewState = GuardAnimationController.PREVIEW_STATES[this.previewIndex];
    return this.previewState;
  }

  get isPreviewing() {
    return this.previewState !== null;
  }

  private mapState(state: GuardState): GuardAnimationState {
    if (state === 'PATROL') return 'PATROL';
    if (state === 'TURN') return 'TURN';
    if (state === 'ALERT') return 'ALERT';
    if (state === 'DETECTED') return 'CHASE';
    if (state === 'CAPTURE') return 'SUSPICIOUS';
    if (state === 'INVESTIGATE') return 'INVESTIGATE';
    if (state === 'SEARCH') return this.controller.isSearchingOnMove ? 'INVESTIGATE' : 'SEARCH';
    if (state === 'RETURN') return 'RETURN';
    if (state === 'SUSPICIOUS') return 'SUSPICIOUS';
    return 'IDLE';
  }

  private updateLocomotion(travel: number) {
    const moving = this.state === 'PATROL' || this.state === 'ALERT' || this.state === 'INVESTIGATE' || this.state === 'RETURN' || this.state === 'CHASE';
    if (!moving || travel <= .0001) return;
    const stride = this.state === 'CHASE' ? 1.18 : this.state === 'ALERT' ? 1.18 : 1.05;
    this.locomotionPhase += travel / stride * Math.PI * 2;
    this.distanceSinceFootstep += travel;
    while (this.distanceSinceFootstep >= stride / 2) {
      this.distanceSinceFootstep -= stride / 2;
      this.onFootstep(this.state === 'CHASE' ? 1 : this.state === 'ALERT' ? .82 : .6);
    }
  }

  private applyPose(deltaTime: number) {
    const rig = this.guard.visual;
    const moving = this.state === 'PATROL' || this.state === 'ALERT' || this.state === 'INVESTIGATE' || this.state === 'RETURN' || this.state === 'CHASE';
    const cycle = moving ? Math.sin(this.locomotionPhase) : 0;
    const alert = this.state === 'ALERT';
    const chase = this.state === 'CHASE';
    const blend = 1 - Math.exp(-deltaTime / .18);
    const pose = (current: number, target: number) => Scalar.Lerp(current, target, blend);
    const legAmplitude = chase ? .82 : alert ? .58 : .44;
    const armAmplitude = chase ? .7 : .14;
    const breath = Math.sin(this.elapsed * 1.65) * .009;

    let rootPitch = chase ? .2 : alert ? .09 : .015;
    let chestPitch = alert ? .08 : 0;
    let chestYaw = 0;
    let headYaw = Math.sin(this.elapsed * .7) * (this.state === 'IDLE' ? .12 : .025);
    let leftArmX = -cycle * armAmplitude;
    let rightArmX = -1.02;
    let leftForearmX = chase ? -.25 : -.1;
    let rightForearmX = -.58;
    let leftLegX = cycle * legAmplitude;
    let rightLegX = -cycle * legAmplitude;
    let leftShinX = moving ? Math.max(0, -cycle) * .48 : 0;
    let rightShinX = moving ? Math.max(0, cycle) * .48 : 0;

    if (this.state === 'TURN') {
      const settle = Math.sin(Math.min(1, this.elapsed / .55) * Math.PI);
      leftLegX = .16 * settle;
      rightLegX = -.14 * settle;
      leftArmX = -.08;
      headYaw = .24 * settle;
    } else if (this.state === 'SUSPICIOUS') {
      const brace = Math.min(1, this.elapsed / .18);
      rootPitch = .1 * brace;
      chestPitch = .14 * brace;
      chestYaw = Math.sin(this.elapsed * 2.6) * .12;
      leftArmX = -.24;
      rightArmX = -1.28;
      rightForearmX = -.42;
      headYaw = Math.sin(this.elapsed * 2.6) * .28;
    } else if (this.state === 'INVESTIGATE') {
      // Smaller steps and a guarded upper body make the approach readable as
      // an investigation instead of an ordinary patrol at a different speed.
      rootPitch = .12;
      chestPitch = .1;
      leftArmX = -.18 - cycle * .08;
      rightArmX = -1.22;
      rightForearmX = -.48;
      headYaw = Math.sin(this.elapsed * 1.35) * .18;
    } else if (this.state === 'SEARCH') {
      const deliberateScan = Math.sin(this.elapsed * 2.15);
      rootPitch = .06;
      chestPitch = .08;
      chestYaw = deliberateScan * .2;
      headYaw = deliberateScan * .78;
      leftArmX = -.2;
      rightArmX = -1.3;
      rightForearmX = -.4;
    }

    rig.root.position.y = pose(rig.root.position.y, breath);
    rig.root.rotation.x = pose(rig.root.rotation.x, rootPitch);
    rig.chest.rotation.x = pose(rig.chest.rotation.x, chestPitch);
    rig.chest.rotation.y = pose(rig.chest.rotation.y, chestYaw);
    rig.chest.rotation.z = pose(rig.chest.rotation.z, moving ? cycle * .025 : 0);
    rig.head.rotation.y = pose(rig.head.rotation.y, headYaw);
    rig.leftArm.rotation.x = pose(rig.leftArm.rotation.x, leftArmX);
    rig.rightArm.rotation.x = pose(rig.rightArm.rotation.x, rightArmX);
    rig.leftForearm.rotation.x = pose(rig.leftForearm.rotation.x, leftForearmX);
    rig.rightForearm.rotation.x = pose(rig.rightForearm.rotation.x, rightForearmX);
    rig.leftLeg.rotation.x = pose(rig.leftLeg.rotation.x, leftLegX);
    rig.rightLeg.rotation.x = pose(rig.rightLeg.rotation.x, rightLegX);
    rig.leftShin.rotation.x = pose(rig.leftShin.rotation.x, leftShinX);
    rig.rightShin.rotation.x = pose(rig.rightShin.rotation.x, rightShinX);
  }
}
