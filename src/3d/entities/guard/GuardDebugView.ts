import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { GUARD_CONFIG } from '../../config/guardConfig';
import type { Guard } from './Guard';
import type { GuardPatrol } from './GuardPatrol';
import type { GuardController } from './GuardController';

export class GuardDebugView {
  private readonly visuals: AbstractMesh[] = [];
  private readonly lastSeenMarker: AbstractMesh;
  private readonly lastHeardMarker: AbstractMesh;
  private readonly targetMarker: AbstractMesh;
  private readonly searchMarkers: AbstractMesh[] = [];
  private navigationLine: LinesMesh;
  private visible = false;

  constructor(scene: Scene, private readonly guard: Guard, patrol: GuardPatrol) {
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

    const makeMarkerMaterial = (name: string, color: Color3) => {
      const material = new StandardMaterial(name, scene);
      material.diffuseColor = color;
      material.emissiveColor = color.scale(.45);
      return material;
    };
    const seenMaterial = makeMarkerMaterial('guard-debug-last-seen-material', new Color3(1, .62, .12));
    const heardMaterial = makeMarkerMaterial('guard-debug-last-heard-material', new Color3(.22, .65, 1));
    const targetMaterial = makeMarkerMaterial('guard-debug-target-material', new Color3(1, .22, .18));
    const searchMaterial = makeMarkerMaterial('guard-debug-search-material', new Color3(.32, 1, .48));

    this.lastSeenMarker = MeshBuilder.CreateSphere('guard-debug-last-seen', { diameter: .28, segments: 8 }, scene);
    this.lastSeenMarker.material = seenMaterial;
    this.lastSeenMarker.isPickable = false;
    this.lastSeenMarker.visibility = .9;
    this.visuals.push(this.lastSeenMarker);

    this.lastHeardMarker = MeshBuilder.CreateSphere('guard-debug-last-heard', { diameter: .22, segments: 8 }, scene);
    this.lastHeardMarker.material = heardMaterial;
    this.lastHeardMarker.isPickable = false;
    this.lastHeardMarker.visibility = .65;
    this.visuals.push(this.lastHeardMarker);

    this.targetMarker = MeshBuilder.CreateSphere('guard-debug-navigation-target', { diameter: .18, segments: 8 }, scene);
    this.targetMarker.material = targetMaterial;
    this.targetMarker.isPickable = false;
    this.visuals.push(this.targetMarker);

    for (let index = 0; index < 4; index += 1) {
      const marker = MeshBuilder.CreateSphere(`guard-debug-search-${index + 1}`, { diameter: .16, segments: 8 }, scene);
      marker.material = searchMaterial;
      marker.isPickable = false;
      this.searchMarkers.push(marker);
      this.visuals.push(marker);
    }

    this.navigationLine = MeshBuilder.CreateLines('guard-debug-navigation-path', {
      points: [guard.position.clone(), guard.position.clone()],
      updatable: true,
    }, scene);
    this.navigationLine.color = new Color3(.96, .28, .18);
    this.navigationLine.alpha = .7;
    this.navigationLine.isPickable = false;
    this.visuals.push(this.navigationLine);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.visuals.forEach(mesh => { mesh.isVisible = visible; });
  }

  update(controller: GuardController) {
    if (!this.visible) return;
    const memory = controller.memory;
    this.lastSeenMarker.isVisible = Number.isFinite(memory.seenAge);
    this.lastSeenMarker.position.copyFrom(memory.lastSeenPosition).addInPlaceFromFloats(0, .18, 0);
    this.lastHeardMarker.isVisible = Number.isFinite(memory.heardAge);
    this.lastHeardMarker.position.copyFrom(memory.lastHeardPosition).addInPlaceFromFloats(0, .14, 0);
    this.targetMarker.isVisible = controller.navigation.hasTarget;
    this.targetMarker.position.copyFrom(controller.navigation.target).addInPlaceFromFloats(0, .11, 0);
    this.searchMarkers.forEach((marker, index) => {
      const point = controller.search.points[index];
      marker.isVisible = Boolean(point) && controller.fsmState === 'SEARCH';
      if (point) marker.position.copyFrom(point).addInPlaceFromFloats(0, .1, 0);
    });
    this.navigationLine = MeshBuilder.CreateLines('guard-debug-navigation-path', {
      points: [this.guard.position, controller.navigation.target],
      instance: this.navigationLine,
    }, this.navigationLine.getScene());
  }

  dispose() {
    this.visuals.forEach(mesh => mesh.dispose());
  }
}
