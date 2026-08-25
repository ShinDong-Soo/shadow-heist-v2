import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { GUARD_CONFIG } from '../../config/guardConfig';
import type { Guard } from './Guard';
import type { GuardPatrol } from './GuardPatrol';

export class GuardDebugView {
  private readonly visuals: AbstractMesh[] = [];

  constructor(scene: Scene, guard: Guard, patrol: GuardPatrol) {
    const route = MeshBuilder.CreateLines('guard-debug-patrol-route', {
      points: [...patrol.points, patrol.points[0]].map(point => new Vector3(point.x, .045, point.z)),
    }, scene);
    route.color = new Color3(.2, .78, .68);
    route.alpha = .58;
    route.isPickable = false;
    this.visuals.push(route);

    patrol.points.forEach((point, index) => {
      const marker = MeshBuilder.CreateSphere(`guard-debug-waypoint-${index + 1}`, { diameter: .2, segments: 8 }, scene);
      marker.position.copyFromFloats(point.x, .12, point.z);
      marker.isPickable = false;
      this.visuals.push(marker);
    });

    const forward = MeshBuilder.CreateLines('guard-debug-forward', {
      points: [new Vector3(0, .08, 0), new Vector3(0, .08, 1.45)],
    }, scene);
    forward.parent = guard.root;
    forward.color = new Color3(.95, .52, .18);
    forward.isPickable = false;
    this.visuals.push(forward);

    const flashlight = MeshBuilder.CreateLines('guard-debug-flashlight-direction', {
      points: [Vector3.Zero(), new Vector3(0, GUARD_CONFIG.flashlight.pitch * 2.2, 2.2)],
    }, scene);
    flashlight.parent = guard.flashlightPivot;
    flashlight.color = new Color3(1, .88, .42);
    flashlight.isPickable = false;
    this.visuals.push(flashlight);
  }

  setVisible(visible: boolean) {
    this.visuals.forEach(mesh => { mesh.isVisible = visible; });
  }

  dispose() {
    this.visuals.forEach(mesh => mesh.dispose());
  }
}
