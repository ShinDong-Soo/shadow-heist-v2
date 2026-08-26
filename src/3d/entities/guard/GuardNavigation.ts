import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GUARD_CONFIG } from '../../config/guardConfig';
import { canOccupyCircle, moveCircleWithSliding, type CollisionBox } from '../../systems/CollisionWorld';
import type { Guard } from './Guard';

export class GuardNavigation {
  readonly target = Vector3.Zero();
  readonly velocity = Vector3.Zero();
  readonly direction = new Vector3(0, 0, 1);
  moving = false;
  blocked = false;
  stalledFor = 0;
  remainingDistance = Infinity;
  progressThisFrame = 0;
  private hasTargetValue = false;
  private bestDistance = Infinity;
  private readonly finalTarget = Vector3.Zero();
  private waypoints: Vector3[] = [];
  private waypointIndex = 0;

  constructor(
    private readonly guard: Guard,
    private readonly collisionBoxes: CollisionBox[],
  ) {}

  setTarget(position: Vector3) {
    const nextFinal = position.clone();
    nextFinal.y = 0;
    if (this.hasTargetValue && Vector3.DistanceSquared(this.finalTarget, nextFinal) < .12) {
      this.finalTarget.copyFrom(nextFinal);
      if (this.waypoints.length > 0) this.waypoints[this.waypoints.length - 1].copyFrom(nextFinal);
      return;
    }
    this.finalTarget.copyFrom(nextFinal);
    this.waypoints = this.buildPortalPath(this.guard.position, nextFinal);
    this.waypointIndex = 0;
    this.selectWaypoint(this.waypoints[0] ?? nextFinal);
  }

  private selectWaypoint(position: Vector3) {
    this.target.copyFrom(position);
    this.target.y = 0;
    this.guard.navigationTarget.position.copyFrom(this.target);
    this.hasTargetValue = true;
    this.stalledFor = 0;
    this.remainingDistance = Vector3.Distance(this.guard.position, this.target);
    this.bestDistance = this.remainingDistance;
    this.progressThisFrame = 0;
  }

  stop() {
    this.velocity.setAll(0);
    this.moving = false;
    this.blocked = false;
  }

  update(deltaTime: number, speed: number, arrivalRadius: number) {
    if (!this.hasTargetValue) {
      this.stop();
      return true;
    }
    const toTarget = this.target.subtract(this.guard.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    this.remainingDistance = distance;
    if (distance <= arrivalRadius) {
      if (this.waypointIndex < this.waypoints.length - 1) {
        this.waypointIndex += 1;
        this.selectWaypoint(this.waypoints[this.waypointIndex]);
        return false;
      }
      this.stop();
      this.stalledFor = 0;
      this.bestDistance = distance;
      this.progressThisFrame = 0;
      return true;
    }
    toTarget.scaleInPlace(1 / distance);
    this.direction.copyFrom(toTarget);
    const travel = Math.min(Math.max(0, distance - arrivalRadius), speed * deltaTime);
    let result = this.tryMove(toTarget.x, toTarget.z, travel);
    const directMove = Math.hypot(result.x - this.guard.position.x, result.z - this.guard.position.z);
    if (directMove < Math.min(.004, travel * .2)) {
      const left = this.tryMove(-toTarget.z, toTarget.x, travel);
      const right = this.tryMove(toTarget.z, -toTarget.x, travel);
      const leftMove = Math.hypot(left.x - this.guard.position.x, left.z - this.guard.position.z);
      const rightMove = Math.hypot(right.x - this.guard.position.x, right.z - this.guard.position.z);
      result = leftMove >= rightMove ? left : right;
    }
    const movedX = result.x - this.guard.position.x;
    const movedZ = result.z - this.guard.position.z;
    this.guard.position.x = result.x;
    this.guard.position.z = result.z;
    this.guard.position.y = 0;
    this.velocity.copyFromFloats(movedX / Math.max(.0001, deltaTime), 0, movedZ / Math.max(.0001, deltaTime));
    this.moving = Math.hypot(movedX, movedZ) > .0005;
    this.blocked = (result.blockedX || result.blockedZ) && !this.moving;
    const nextDistance = Math.hypot(this.target.x - result.x, this.target.z - result.z);
    this.progressThisFrame = distance - nextDistance;
    this.remainingDistance = nextDistance;
    // 벽 모서리에서 좌우로 아주 조금씩 흔들리는 움직임은 실제 전진이 아니다.
    // 매 프레임 거리만 비교하면 이 작은 흔들림 때문에 정체 타이머가 계속
    // 초기화되므로, 목표에 가장 가까웠던 거리보다 확실히 가까워졌을 때만
    // 전진한 것으로 판단한다.
    const meaningfulProgress = .025;
    if (nextDistance < this.bestDistance - meaningfulProgress) {
      this.bestDistance = nextDistance;
      this.stalledFor = 0;
    } else {
      this.stalledFor += deltaTime;
    }
    return false;
  }

  canReachPoint(position: Vector3) {
    return canOccupyCircle(position.x, position.z, GUARD_CONFIG.radius, this.collisionBoxes, 0, GUARD_CONFIG.height);
  }

  get hasTarget() {
    return this.hasTargetValue;
  }

  get routeLabel() {
    return `${this.waypointIndex + 1}/${Math.max(1, this.waypoints.length)} → ${this.target.x.toFixed(1)},${this.target.z.toFixed(1)}`;
  }

  private buildPortalPath(start: Vector3, end: Vector3) {
    const portals = [
      { z: -42.5, x: -.8 },
      { z: -32.5, x: 1.2 },
      { z: -22.5, x: -1.4 },
      { z: -12.5, x: 0 },
      { z: -5.5, x: 0 },
    ];
    const zoneIndex = (z: number) => {
      const index = portals.findIndex(portal => z < portal.z);
      return index < 0 ? portals.length : index;
    };
    const startZone = zoneIndex(start.z);
    const endZone = zoneIndex(end.z);
    const points: Vector3[] = [];
    // The outer west aisle contains the Locker and the outer east aisle leads
    // to the emergency shutter. Long-distance routing uses the three clear
    // through-aisles; patrol routes may still visit the outer dead ends.
    const archiveAisles = [-3.2, 0, 3.2];
    const nearestArchiveAisle = (x: number) => archiveAisles.reduce((best, aisle) => (
      Math.abs(aisle - x) < Math.abs(best - x) ? aisle : best
    ), archiveAisles[0]);
    const addZoneTransit = (zone: number, northbound: boolean) => {
      if (zone === 1) {
        points.push(new Vector3(1.8, 0, northbound ? -41.5 : -33.3), new Vector3(1.8, 0, northbound ? -33.3 : -41.5));
      } else if (zone === 2) {
        points.push(new Vector3(3, 0, northbound ? -31.5 : -23.3), new Vector3(3, 0, northbound ? -23.3 : -31.5));
      } else if (zone === 3) {
        points.push(new Vector3(0, 0, northbound ? -21.2 : -13.5), new Vector3(0, 0, northbound ? -13.5 : -21.2));
      } else if (zone === 4) {
        points.push(new Vector3(0, 0, northbound ? -11.5 : -6.2), new Vector3(0, 0, northbound ? -6.2 : -11.5));
      }
    };

    if (startZone !== endZone) {
      const northbound = startZone < endZone;
      if (startZone === 1) points.push(new Vector3(1.8, 0, start.z), new Vector3(1.8, 0, northbound ? -33.3 : -41.5));
      if (startZone === 2) points.push(new Vector3(3, 0, start.z), new Vector3(3, 0, northbound ? -23.3 : -31.5));
      if (startZone === 3) {
        const aisle = nearestArchiveAisle(start.x);
        points.push(new Vector3(aisle, 0, start.z), new Vector3(aisle, 0, northbound ? -13.5 : -21.2));
        points.push(new Vector3(northbound ? 0 : -1.4, 0, northbound ? -13.5 : -21.2));
      }
      if (startZone === 4) points.push(new Vector3(0, 0, start.z), new Vector3(0, 0, northbound ? -6.2 : -11.5));
    }

    if (startZone < endZone) {
      for (let index = startZone; index < endZone; index += 1) {
        const portal = portals[index];
        points.push(new Vector3(portal.x, 0, portal.z - .72), new Vector3(portal.x, 0, portal.z + .72));
        const enteredZone = index + 1;
        if (enteredZone < endZone) addZoneTransit(enteredZone, true);
      }
    } else if (startZone > endZone) {
      for (let index = startZone - 1; index >= endZone; index -= 1) {
        const portal = portals[index];
        points.push(new Vector3(portal.x, 0, portal.z + .72), new Vector3(portal.x, 0, portal.z - .72));
        const enteredZone = index;
        if (enteredZone > endZone) addZoneTransit(enteredZone, false);
      }
    }

    if (startZone !== endZone && endZone === 3) {
      const aisle = nearestArchiveAisle(end.x);
      const enteredFromSouth = startZone < endZone;
      points.push(new Vector3(aisle, 0, enteredFromSouth ? -21.2 : -13.5), new Vector3(aisle, 0, end.z));
    }

    // The post-lockdown service route branches east from Archive and is not
    // part of the main north/south chain.
    const targetInServiceRoute = end.x > 6.7 && end.z < -18.5;
    if (targetInServiceRoute && !(start.x > 6.7 && start.z < -18.5)) {
      points.push(new Vector3(6.35, 0, -18.5), new Vector3(7.75, 0, -18.5));
    }
    points.push(end.clone());
    return points.filter((point, index) => index === points.length - 1 || this.canReachPoint(point));
  }

  private tryMove(x: number, z: number, travel: number) {
    return moveCircleWithSliding(
      this.guard.position.x,
      this.guard.position.z,
      x * travel,
      z * travel,
      GUARD_CONFIG.radius,
      this.collisionBoxes,
      0,
      GUARD_CONFIG.height,
    );
  }
}
