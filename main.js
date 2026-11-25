import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
// IMPORT DU GUI, LE MENU EN HAUT A DROITE //


// LA SCENE //
const scene = new THREE.Scene();

// HDR //
const hdrLoader = new RGBELoader();
const envMap = await hdrLoader.loadAsync("public/nuitciel.hdr");
envMap.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = envMap;
scene.background = envMap;

// LA CAMERA //
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(2, -0.5, -2);
camera.lookAt(0, 0, 0);

// LE RENDERER //
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

// L'ORBIT CONTROLS //
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.target.set(0, 0, 0);

//  LUMIERE //
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
const helper = new THREE.DirectionalLightHelper( dirLight,8 );
scene.add( helper );
dirLight.position.set( 2, 0, -2);
dirLight.castShadow = true;
scene.add(dirLight);




// LE LOADER //
const gltfLoader = new GLTFLoader();

function loadGLB(path) {
    return new Promise((resolve, reject) =>
        gltfLoader.load(path, (gltf) => resolve(gltf.scene), undefined, reject)
    );
}

// MES ÉLÉMENTS FIXES //

//  garage // 
loadGLB("public/garage.glb").then((model) => {
    model.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
    scene.add(model);
    console.log("garage.glb");
}).catch(e => console.error("❌ ou est mon garage.glb", e)); // au cas ou si iol y une erreur comme ça jvois mieux // 

// les portes / raycastteerrrr // 
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const canvas = renderer.domElement;
const doors = [];

function createDoor({
    path,
    hingeSide = "left",
    front = -1,
    maxOpen = 100,
    openStiffness = 60,
    openDamping = 14,
    slamAccel = 30,
    bounce = 0.3,
    hingeOffsetX = 0,   
    hingeOffsetZ = 0,   
    offsetX = 0,        
    offsetZ = 0,        
}) {
    const door = {
        pivot: new THREE.Group(),
        hitbox: null,
        sign: 1,
        angle: 0,
        velocity: 0,
        hovering: false,
        maxOpen: THREE.MathUtils.degToRad(maxOpen),
        openStiffness, openDamping, slamAccel, bounce,
    };

    loadGLB(path).then((model) => {
        model.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const hinge = new THREE.Vector3(
            (hingeSide === "left" ? box.min.x : box.max.x) + hingeOffsetX,
            0,
            (front > 0 ? box.max.z : box.min.z) + hingeOffsetZ
        );

        door.sign = (hingeSide === "right" ? 1 : -1) * front;

        door.pivot.position.copy(hinge);
        model.position.sub(hinge);
        door.pivot.add(model);

        door.pivot.position.x += offsetX;
        door.pivot.position.z += offsetZ;

        scene.add(door.pivot);

        door.hitbox = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, size.y, size.z),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        door.hitbox.position.copy(center);
        door.hitbox.position.x += offsetX;
        door.hitbox.position.z += offsetZ;
        scene.add(door.hitbox);

        console.log(path);
    }).catch(e => console.error("❌ ou est mon " + path, e));

    doors.push(door);
    return door;
}

// HOVVERRRR // 
canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    let best = null, bestDist = Infinity;
    for (const d of doors) {
        d.hovering = false;
        if (!d.hitbox) continue;
        const hit = raycaster.intersectObject(d.hitbox, false)[0];
        if (hit && hit.distance < bestDist) { best = d; bestDist = hit.distance; }
    }
    if (best) best.hovering = true;
    canvas.style.cursor = best ? "pointer" : "";
});

canvas.addEventListener("pointerleave", () => {
    doors.forEach(d => d.hovering = false);
    canvas.style.cursor = "";
});

// Animation ouverture , fermeture//
let last = performance.now();
function updateDoors(now) {
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;

    for (const d of doors) {
        if (d.hovering) {
            const acc = d.openStiffness * (d.maxOpen - d.angle) - d.openDamping * d.velocity;
            d.velocity += acc * dt;
            d.angle += d.velocity * dt;
            d.angle = Math.min(d.angle, d.maxOpen);
        } else if (d.angle > 0 || d.velocity !== 0) {
            d.velocity -= d.slamAccel * dt;
            d.angle += d.velocity * dt;

            if (d.angle <= 0) {
                d.angle = 0;
                d.velocity = Math.abs(d.velocity) > 0.5 ? -d.velocity * d.bounce : 0;
            }
        }
        d.pivot.rotation.y = d.angle * d.sign;
    }
    requestAnimationFrame(updateDoors);
}
requestAnimationFrame(updateDoors);

// mes 2 portes du frigo //
createDoor({ path: "public/porte_haut.glb", hingeSide: "left", front: -1, offsetZ: 0.02 });
createDoor({ path: "public/porte_bas.glb",  hingeSide: "left", front: -1, offsetZ: 0.02 });



// EN BOUCLE DE RENDU //
function animate() {
    controls.update();
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
//IL EST 22:45 JPP ET LA SEMAINE TT LES SOIRS DESSUS//