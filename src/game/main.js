import { vec3 } from "gl-matrix";
import { Pane } from "tweakpane";

import { Scene, MeshInstance, Environment, DirectionalLight, PostProcess } from "@core/nodes";
import { GlbMesh, Material, PlaneMesh, Texture } from "@core/resources";

import { Player } from "@game/player.js";
import { FollowCamera } from "@game/followCamera.js";
import { MaterialManager } from "./materialManager.js";

export const MainScene = new class MainScene extends Scene {
  /** @type { Player } */
  player

  /** @type { FollowCamera } */
  camera

  /** @type { PostProcess } */
  postProcess

  fps = 0.0;

  createGroundPlane() {
    this.addChild(new MeshInstance(new PlaneMesh({
      size: 2000,
      material: MaterialManager.get("ground"),
    })));
  }

  async setupSun() {
    const env = this.addChild(await Environment.createFromTexture("/src/game/sky_124_2k.png"));
    const light = this.addChild(new DirectionalLight(50));
    light.color = vec3.scale(vec3.create(), [0.96, 0.83, 0.61], 4.0);
    light.rotate([0, 1, 0], 80);
    light.rotate(light.right, -45);
  }

  setupCamera() {
    this.camera = this.addChild(new FollowCamera(this.player));
  }


  async prepareMaterials() {
    const groundOptions = {
      albedo: await Texture.load("/src/game/materials/ground_tiles_21_1k/ground_tiles_21_baseColor_1k.png"),
      normalMap: await Texture.load("/src/game/materials/ground_tiles_21_1k/ground_tiles_21_normal_gl_1k.png"),
      ormMap: await Texture.load("/src/game/materials/ground_tiles_21_1k/ground_tiles_21_roughness_1k.png"),
      roughness: 0.8,
      metallic: 0.5,
      normalScale: 0.5,
      uvScale: 1/8.0,
      flags: Material.Flags.TRIPLANAR_MAPPING,
    }
    MaterialManager.createMaterial("ground", groundOptions);

    groundOptions.flags = 0;
    MaterialManager.createMaterial("ground-notrip", groundOptions);
  }

  defineDebugUI() {
    this.postProcess = this.addChild(new PostProcess({
      dofMaxRadius: 12.0,
      dofAperture: 20.0,
      dofSamples: 64,

      vingetteIntensity: 1.0,
    }));

    const pane = new Pane({ title: "Pilik 3D by H2xDev" });
    pane.containerElem_.style.width = "350px";

    pane.addBinding({ text: "WASD - controls\nHold LMB - control camera\nShift + LBM - pane camera" }, "text", {
      readonly: true,
      multiline: true,
      rows: 5,
    })

    pane.addBinding(this, "fps", {
      readonly: true,
      min: 0, max: 240
    });
    pane.addBinding(this, "fps", {
      readonly: true,
      view: "graph",
      min: 0, max: 240
    });

    pane.addBinding(this.camera, "controlsEnabled", { label: "Camera controls" });

    const ppf = pane.addFolder({ title: "Post Process Settings" });

    ppf.addBinding(this.postProcess, "aaEdgeThreshold", { min: 0.0, max: 0.1 });
    ppf.addBinding(this.postProcess, "aaSpan", { min: 0.0, max: 5.0 });
    ppf.addBinding(this.postProcess, "vingetteIntensity", { min: 0.0, max: 5.0 });
    ppf.addBinding(this.postProcess, "vingetteRadius", { min: 0.0, max: 1.0 });
    ppf.addBinding(this.postProcess, "vingetteSoftness", { min: 0.0, max: 1.0 });
    ppf.addBinding(this.postProcess, "dofFocusDistance", { min: 1.0, max: 100.0, readonly: true });
    ppf.addBinding(this.postProcess, "dofAperture", { min: 0.0, max: 100.0 });
    ppf.addBinding(this.postProcess, "dofMaxRadius", { min: 0.0, max: 20.0 });
    ppf.addBinding(this.postProcess, "dofSamples", { min: 1, max: 64 });
  }

  async enter() {
    await this.prepareMaterials();
    await this.setupSun()

    this.player = this.addChild(new Player());
    this.setupCamera()
    this.createGroundPlane();
    this.defineDebugUI();
  }

  update(dt) {
    super.update(dt);
    this.fps = 1.0 / dt;

    const distanceToCamera = vec3.distance(this.player.globalPosition, this.camera.camera.globalPosition);
    if (distanceToCamera != this.postProcess.dofFocusDistance) {
      this.postProcess.dofFocusDistance = distanceToCamera;
    }
  }
}

