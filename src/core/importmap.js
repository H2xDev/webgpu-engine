// Define importmap
const importMap = {
  imports: {
    "@core/nodes": "/src/core/nodes/index.js",
    "@core/resources": "/src/core/resources/index.js",
    "@core": "/src/core/index.js",
    "@game/": "/src/game/",
    "gl-matrix": "/src/core/gl-matrix/index.js"
  }
}

const script = document.createElement("script");
script.type = "importmap";
script.textContent = JSON.stringify(importMap, null, 2);
document.currentScript.after(script);
