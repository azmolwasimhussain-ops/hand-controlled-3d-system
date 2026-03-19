const PARTICLE_COUNT = 8000;
const PARTICLE_SIZE = 0.15;

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 20;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const targetPositions = new Float32Array(PARTICLE_COUNT * 3); 

for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 50;
    targetPositions[i] = positions[i];
    colors[i] = 1.0;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));


const getTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
};

const material = new THREE.PointsMaterial({
    size: PARTICLE_SIZE,
    map: getTexture(),
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

function setShape(shapeName) {
    const positionsArr = targetPositions;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        let x, y, z;

        if (shapeName === 'sphere') {
            const r = 8;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            x = r * Math.sin(phi) * Math.cos(theta);
            y = r * Math.sin(phi) * Math.sin(theta);
            z = r * Math.cos(phi);
        } 
        else if (shapeName === 'heart') {
            let t = Math.random() * Math.PI * 2;
            let r = Math.sqrt(Math.random()) * 0.8; 
            x = 16 * Math.pow(Math.sin(t), 3);
            y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
            z = (Math.random() - 0.5) * 5; 
            x *= 0.5; y *= 0.5; 
        } 
        else if (shapeName === 'saturn') {
            const r = Math.random();
            if (r > 0.3) {
                const rad = 4;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                x = rad * Math.sin(phi) * Math.cos(theta);
                y = rad * Math.sin(phi) * Math.sin(theta);
                z = rad * Math.cos(phi);
            } else {
                const rad = 6 + Math.random() * 4;
                const theta = Math.random() * Math.PI * 2;
                x = rad * Math.cos(theta);
                z = rad * Math.sin(theta);
                y = (Math.random() - 0.5) * 0.5;
            }
        }
        else if (shapeName === 'flower') {
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI;
            const r = Math.sin(3 * u) * 5 + 5;
            x = r * Math.sin(v) * Math.cos(u);
            y = r * Math.sin(v) * Math.sin(u);
            z = (Math.random() - 0.5) * 2;
        }

        positionsArr[i3] = x;
        positionsArr[i3 + 1] = y;
        positionsArr[i3 + 2] = z;
    }
}

let currentShapeIndex = 0;
const shapeList = ['sphere', 'heart', 'saturn', 'flower'];
setShape(shapeList[0]);

let handPresent = false;
let handX = 0, handY = 0;
let expansionFactor = 0;
let hueShift = 0;
let lastPinchState = false;


const videoElement = document.getElementById('video-feed');
const statusElement = document.getElementById('status');

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handPresent = true;
        const landmarks = results.multiHandLandmarks[0];
        
        handX = (landmarks[0].x - 0.5) * -2; 
        handY = (landmarks[0].y - 0.5) * -2;

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        const isPinching = distance < 0.05;

        if (isPinching && !lastPinchState) {
            currentShapeIndex = (currentShapeIndex + 1) % shapeList.length;
            setShape(shapeList[currentShapeIndex]);
            hueShift = Math.random(); 
        }
        lastPinchState = isPinching;


        const wrist = landmarks[0];
        const middle = landmarks[12];
        const handSize = Math.sqrt(Math.pow(wrist.x - middle.x, 2) + Math.pow(wrist.y - middle.y, 2));
        
        expansionFactor = THREE.MathUtils.mapLinear(handSize, 0.2, 0.6, 0.5, 2.5);
        expansionFactor = THREE.MathUtils.clamp(expansionFactor, 0.5, 3.0);

        statusElement.innerText = `Tracking Hand | Shape: ${shapeList[currentShapeIndex].toUpperCase()}`;
        statusElement.style.color = "#00ff00";

    } else {
        handPresent = false;
        statusElement.innerText = "No Hand Detected";
        statusElement.style.color = "white";
        expansionFactor = THREE.MathUtils.lerp(expansionFactor, 1, 0.05);
    }
}

const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const cameraFeed = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
});
cameraFeed.start();



const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    const positionsArr = particles.geometry.attributes.position.array;
    const colorsArr = particles.geometry.attributes.color.array;


    if(handPresent) {
        particles.rotation.x = THREE.MathUtils.lerp(particles.rotation.x, handY * 0.5, 0.05);
        particles.rotation.y = THREE.MathUtils.lerp(particles.rotation.y, handX * 0.5, 0.05);
    } else {
        particles.rotation.y += 0.002; 
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        
    
        const tx = targetPositions[i3];
        const ty = targetPositions[i3 + 1];
        const tz = targetPositions[i3 + 2];

        
        let px = positionsArr[i3];
        let py = positionsArr[i3 + 1];
        let pz = positionsArr[i3 + 2];

        let finalTx = tx * (handPresent ? expansionFactor : 1);
        let finalTy = ty * (handPresent ? expansionFactor : 1);
        let finalTz = tz * (handPresent ? expansionFactor : 1);

       
        finalTx += Math.sin(time + px) * 0.02;
        finalTy += Math.cos(time + py) * 0.02;

       
        positionsArr[i3] += (finalTx - px) * 0.05; 
        positionsArr[i3 + 1] += (finalTy - py) * 0.05;
        positionsArr[i3 + 2] += (finalTz - pz) * 0.05;

        const colorObj = new THREE.Color();
        const hue = (hueShift + (positionsArr[i3] * 0.01) + (time * 0.05)) % 1;
        colorObj.setHSL(hue, 0.8, 0.6);
        
        colorsArr[i3] = colorObj.r;
        colorsArr[i3 + 1] = colorObj.g;
        colorsArr[i3 + 2] = colorObj.b;
    }

    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.color.needsUpdate = true;

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});