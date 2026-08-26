import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { PlayerHideState } from '../hide/HideSpotTypes';
import type { Player } from './Player';
import type { PlayerController } from './PlayerController';

export type PlayerAnimationState =
  | 'IDLE'
  | 'WALK'
  | 'RUN'
  | 'CROUCH'
  | 'CROUCH_WALK'
  | 'INTERACT'
  | 'HIDE_ENTER'
  | 'HIDDEN'
  | 'HIDE_EXIT';

export class PlayerAnimationController {
  state: PlayerAnimationState = 'IDLE';
  private elapsed = 0;
  private locomotionPhase = 0;
  private distanceSinceFootstep = 0;
  private readonly previousPosition: Vector3;

  constructor(
    private readonly player: Player,
    private readonly controller: PlayerController,
    private readonly onFootstep: (strength: number) => void,
  ) {
    this.previousPosition = player.position.clone();
  }

  update(deltaTime: number, hideState: PlayerHideState, interacting: boolean) {
    const travel = Vector3.Distance(this.player.position, this.previousPosition);
    this.previousPosition.copyFrom(this.player.position);
    const nextState = this.resolveState(hideState, interacting);
    if (nextState !== this.state) {
      this.state = nextState;
      this.elapsed = 0;
      this.distanceSinceFootstep = 0;
    }
    this.elapsed += deltaTime;
    this.updateLocomotion(travel);
    this.applyPose(deltaTime);
    this.player.detectionTarget.position.y = this.controller.isCrouching ? .72 : 1.15;
  }

  reset() {
    this.state = 'IDLE';
    this.elapsed = 0;
    this.locomotionPhase = 0;
    this.distanceSinceFootstep = 0;
    this.previousPosition.copyFrom(this.player.position);
    this.player.visual.resetPose();
    this.player.detectionTarget.position.y = 1.15;
  }

  private resolveState(hideState: PlayerHideState, interacting: boolean): PlayerAnimationState {
    if (hideState === 'ENTERING_HIDE') return 'HIDE_ENTER';
    if (hideState === 'HIDDEN') return 'HIDDEN';
    if (hideState === 'EXITING_HIDE') return 'HIDE_EXIT';
    if (interacting) return 'INTERACT';
    if (this.controller.isCrouching) return this.controller.speed > .12 ? 'CROUCH_WALK' : 'CROUCH';
    if (this.controller.isRunning && this.controller.speed > .2) return 'RUN';
    return this.controller.speed > .12 ? 'WALK' : 'IDLE';
  }

  private updateLocomotion(travel: number) {
    const moving = this.state === 'WALK' || this.state === 'RUN' || this.state === 'CROUCH_WALK';
    if (!moving || travel <= .0001) return;
    const stride = this.state === 'RUN' ? 1.35 : this.state === 'CROUCH_WALK' ? .72 : 1.05;
    this.locomotionPhase += travel / stride * Math.PI * 2;
    this.distanceSinceFootstep += travel;
    const footDistance = stride / 2;
    while (this.distanceSinceFootstep >= footDistance) {
      this.distanceSinceFootstep -= footDistance;
      this.onFootstep(this.state === 'RUN' ? 1 : this.state === 'CROUCH_WALK' ? .18 : .42);
    }
  }

  private applyPose(deltaTime: number) {
    const rig = this.player.visual;
    const moving = this.state === 'WALK' || this.state === 'RUN' || this.state === 'CROUCH_WALK';
    const run = this.state === 'RUN';
    const crouched = this.state === 'CROUCH' || this.state === 'CROUCH_WALK';
    const cycle = moving ? Math.sin(this.locomotionPhase) : 0;
    const stepLift = moving ? Math.max(0, Math.sin(this.locomotionPhase * 2)) : 0;
    const legSwing = cycle * (run ? .78 : crouched ? .34 : .52);
    const armSwing = -cycle * (run ? .72 : crouched ? .18 : .3);
    const breath = Math.sin(this.elapsed * 2.15) * .012;
    const blend = 1 - Math.exp(-deltaTime / .16);
    const pose = (current: number, target: number) => Scalar.Lerp(current, target, blend);

    let rootY = crouched ? -.22 : 0;
    let rootPitch = run ? .2 : crouched ? .22 : moving ? .06 : .025;
    let chestPitch = run ? .12 : crouched ? .18 : 0;
    let leftArmX = armSwing;
    let rightArmX = -armSwing;
    let leftForearmX = run ? -.38 : -.12;
    let rightForearmX = run ? -.38 : -.12;
    let leftLegX = legSwing;
    let rightLegX = -legSwing;
    let leftShinX = moving ? Math.max(0, -cycle) * .52 + stepLift * .08 : 0;
    let rightShinX = moving ? Math.max(0, cycle) * .52 + (1 - stepLift) * .04 : 0;
    let headYaw = Math.sin(this.elapsed * .72) * (this.state === 'IDLE' ? .14 : .035);

    if (crouched) {
      leftLegX = -.36 + legSwing;
      rightLegX = -.36 - legSwing;
      leftShinX = .76 + (moving ? Math.max(0, -cycle) * .18 : 0);
      rightShinX = .76 + (moving ? Math.max(0, cycle) * .18 : 0);
    }

    if (this.state === 'INTERACT') {
      // Reach the display and hold the contact pose until the steal sequence
      // starts. The previous full sine wave retracted the hands too early.
      const reach = Math.sin(Math.min(1, this.elapsed / .72) * Math.PI * .5);
      rootPitch = .12 * reach;
      chestPitch = .2 * reach;
      leftArmX = -1.18 * reach;
      rightArmX = -1.32 * reach;
      leftForearmX = -.38 * reach;
      rightForearmX = -.28 * reach;
    } else if (this.state === 'HIDE_ENTER') {
      rootY = -.18;
      rootPitch = .32;
      chestPitch = .18;
      leftArmX = -.8;
      rightArmX = -.92;
    } else if (this.state === 'HIDDEN') {
      rootY = -.3;
      rootPitch = .18;
      chestPitch = .12;
      leftArmX = -.35;
      rightArmX = -.45;
      leftLegX = -.22;
      rightLegX = -.22;
      leftShinX = .36;
      rightShinX = .36;
      headYaw = Math.sin(this.elapsed * .55) * .08;
    } else if (this.state === 'HIDE_EXIT') {
      rootY = -.12;
      rootPitch = .22;
      leftArmX = -.65;
      rightArmX = -.75;
    }

    rig.root.position.y = pose(rig.root.position.y, rootY + breath);
    rig.root.rotation.x = pose(rig.root.rotation.x, rootPitch);
    rig.chest.rotation.x = pose(rig.chest.rotation.x, chestPitch);
    rig.chest.rotation.z = pose(rig.chest.rotation.z, moving ? cycle * .035 : breath * .8);
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
