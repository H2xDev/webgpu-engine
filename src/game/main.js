import { vec3 } from "gl-matrix";
import { Pane } from "tweakpane";

import { Scene, MeshInstance, Environment, DirectionalLight, PostProcess } from "@core/nodes";
import { GlbMesh, Material, PlaneMesh, Texture } from "@core/resources";

import { Player } from "@game/player.js";
import { PuzzleLevel, FIRST_LAYOUT } from "@game/puzzleLevel.js";
import { generateLayout } from "@game/levelGenerator.js";
import "@game/music.js";
import { FollowCamera } from "@game/followCamera.js";
import { MaterialManager } from "./materialManager.js";
import { TO_RAD } from "@core";

export const MainScene = new class MainScene extends Scene {
  /** @type { Player } */
  player

  /** @type { FollowCamera } */
  camera

  /** @type { PostProcess } */
  postProcess

  fps = 0.0;

  /** @type { PuzzleLevel | null } */
  level = null;

  /** Zero-based index of the current level. */
  levelIndex = 0;
  levelNumber = 1;

  /** The first level is hand-made; later ones are generated (seeded, so restarting repeats the same one). */
  loadLevel(index) {
    if (this.level) {
      this.removeChild(this.level);
      this.level.cleanup();
    }

    this.levelIndex = index;
    this.levelNumber = index + 1;

    const layout = index === 0
      ? FIRST_LAYOUT
      : generateLayout(index * 7919 + 13, Math.min(2 + index, 6));

    this.level = this.addChild(new PuzzleLevel(this.player, layout));
    this.level.onSolved = () => this.loadLevel(index + 1);
  }

  createGroundPlane() {
    this.addChild(new MeshInstance(new PlaneMesh({
      size: 2000,
      material: MaterialManager.get("ground"),
    })));
  }

  async setupSun() {
    const env = this.addChild(await Environment.createFromTexture("./src/game/sky_124_2k.png"));
    const light = this.addChild(new DirectionalLight(50));
    light.color = vec3.scale(vec3.create(), [0.96, 0.83, 0.61], 2.0);
    light.transform.rotate([0, 1, 0], 80 * TO_RAD);
    light.transform.rotate(light.transform.right, -45 * TO_RAD);
  }

  setupCamera() {
    this.camera = this.addChild(new FollowCamera(this.player));
  }


  async prepareMaterials() {
    const groundOptions = {
      normalMap: await Texture.load("./src/game/materials/ground_tiles_21_1k/ground_tiles_21_normal_gl_1k.png"),
      roughness: 1.0,
      metallic: 0.2,
      normalScale: 0.5,
      uvScale: 1/8.0,
      flags: Material.Flags.TRIPLANAR_MAPPING,
    }
    MaterialManager.createMaterial("ground", groundOptions);

    MaterialManager.createMaterial("ground-notrip", {
      // albedo: await Texture.load("./src/game/materials/ground_tiles_21_1k/ground_tiles_21_baseColor_1k.png"),
      albedoTint: [0.8, 0.8, 0.8],
      normalMap: await Texture.load("./src/game/materials/ground_tiles_21_1k/ground_tiles_21_normal_gl_1k.png"),
      ormMap: await Texture.load("./src/game/materials/ground_tiles_21_1k/ground_tiles_21_roughness_1k.png"),
      roughness: 0.8,
      metallic: 0.5,
      normalScale: 2.0,
      uvScale: 1/8.0,
      flags: 0,
    });
  }

  defineDebugUI() {
    this.postProcess = this.addChild(new PostProcess({
      aaEdgeThreshold: 0.0,
      aaSpan: 0.0,
      dofMaxRadius: 20.0,
      dofAperture: 15.0,
      dofSamples: 32,
      aoRadius: 0,

      vingetteIntensity: 0.0,
    }));

    const pane = new Pane({ title: "Pilik 3D by H2xDev" });
    pane.containerElem_.style.width = "350px";

    pane.addBinding({ text: "WASD - controls\nHold LMB - control camera\nShift + LBM - pane camera\nR - restart the level" }, "text", {
      readonly: true,
      multiline: true,
      rows: 5,
    })

    pane.addBinding(this, "levelNumber", { readonly: true, label: "Level (R = restart)", format: (v) => v.toFixed(0) });

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
    ppf.addBinding(this.postProcess, "aoIntensity", { min: 0.0, max: 4.0 });
    ppf.addBinding(this.postProcess, "aoRadius", { min: 0.05, max: 5.0 });


    const mat = pane.addFolder({ title: "Material Settings" });
    const groundMat = MaterialManager.get("ground");
    mat.addBinding(groundMat, "roughness", { min: 0.0, max: 1.0 });
    mat.addBinding(groundMat, "metallic", { min: 0.0, max: 1.0 });
    mat.addBinding(groundMat, "normalScale", { min: 0.0, max: 10.0 });
    mat.addBinding(groundMat, "uvScale", { min: 0.0000001, max: 2.0 });
  }

  async enter() {
    await this.prepareMaterials();
    await this.setupSun()

    this.player = this.addChild(new Player());
    this.loadLevel(0);
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyR" && !e.repeat) this.loadLevel(this.levelIndex);
    });
    this.setupCamera()
    this.createGroundPlane();
    this.defineDebugUI();
  }

  /** @param { number } dt */
  update(dt) {
    this.fps = 1.0 / dt;

    const distanceToCamera = vec3.distance(this.player.globalPosition, this.camera.camera.globalPosition);
    if (distanceToCamera != this.postProcess.dofFocusDistance) {
      this.postProcess.dofFocusDistance = distanceToCamera - 0.7;
    }
  }
}

