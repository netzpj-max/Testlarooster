import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {wallPose} from './maneuvers.js';
import {THRUSTER_PORTS,thrusterCommands} from './thrusters.js';

const {PI}=Math;
const C={lime:0xd8ff3e,red:0xff3c32,white:0xe5eef5};
const mat=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.55,...opts});
const bodyMat=new THREE.MeshPhysicalMaterial({color:0xa8b4be,metalness:.92,roughness:.23,clearcoat:1,clearcoatRoughness:.15});
const blackMat=mat(0x101619,{metalness:.65,roughness:.32});
const rubberMat=mat(0x080a0c,{roughness:.92});
const glassMat=mat(0x10252b,{metalness:.92,roughness:.12});
const emissive=(color,intensity=2)=>mat(color,{emissive:color,emissiveIntensity:intensity,toneMapped:true});
const limeMat=emissive(C.lime,2),redMat=emissive(C.red,3),whiteMat=emissive(0xd9efff,3);
const sharedBox=new THREE.BoxGeometry(1,1,1);
function box(parent,w,h,d,x,y,z,material,rx=0,ry=0,rz=0){
 const m=new THREE.Mesh(sharedBox,material);m.scale.set(w,h,d);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function cylinder(parent,r1,r2,h,x,y,z,material,n=16){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n),material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function line(parent,points,color,opacity=1){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));parent.add(m);return m;}
function canvasTexture(width,height,draw){const c=document.createElement('canvas');c.width=width;c.height=height;draw(c.getContext('2d'),width,height);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;}
function textTexture(text,sub='',color='#d8ff3e'){
 return canvasTexture(1024,384,(ctx,w,h)=>{ctx.fillStyle='#111719';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#47514c';ctx.lineWidth=3;ctx.strokeRect(12,12,w-24,h-24);ctx.fillStyle=color;ctx.font='bold 130px Bahnschrift, Arial';ctx.textAlign='center';ctx.fillText(text,w/2,175);ctx.font='28px Arial';ctx.letterSpacing='6px';ctx.fillStyle='#a7b4b0';ctx.fillText(sub,w/2,270);});
}
function sign(parent,text,sub,x,y,z,w=12,h=4,color){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:textTexture(text,sub,color),side:THREE.DoubleSide}));m.position.set(x,y,z);parent.add(m);return m;}

// Bespoke lofted body, not a downloaded vehicle model.
function loft(sections,material){
 const pos=[],idx=[];
 for(const s of sections){const [z,w,bottom,shoulder,top]=s;pos.push(-w,bottom,z,w,bottom,z,w,shoulder,z,w*.73,top,z,-w*.73,top,z,-w,shoulder,z);}
 for(let i=0;i<sections.length-1;i++)for(let j=0;j<6;j++){const a=i*6+j,b=i*6+(j+1)%6,c=(i+1)*6+j,d=(i+1)*6+(j+1)%6;idx.push(a,c,b,b,c,d);}
 idx.push(0,1,2,0,2,3,0,3,4,0,4,5);const n=(sections.length-1)*6;idx.push(n,n+2,n+1,n,n+3,n+2,n,n+4,n+3,n,n+5,n+4);
 for(let i=0;i<idx.length;i+=3){const b=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=b;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
export function makeCar(){
 const group=new THREE.Group(),shell=new THREE.Group();group.add(shell);
 const pearl=bodyMat.clone();
 const hull=loft([[-2.56,.79,-.15,.10,.19],[-2.29,1.12,-.26,.22,.34],[-1.42,1.22,-.30,.34,.52],[.20,1.21,-.30,.37,.50],[1.38,1.28,-.30,.43,.54],[2.30,1.18,-.21,.42,.47],[2.48,1.05,-.10,.28,.30]],pearl);shell.add(hull);
 box(shell,2.47,.12,4.13,0,-.30,.12,blackMat);
 box(shell,2.35,.065,.52,0,-.24,-2.26,blackMat);
 // Cockpit canopy, dark glass, shoulders and roof spine.
 shell.add(loft([[-1.19,.82,.37,.43,.49],[-.34,.81,.42,1.01,1.09],[.68,.76,.44,1.04,1.10],[1.30,.89,.46,.49,.52]],glassMat));
 box(shell,.14,.08,1.18,0,1.1,.15,blackMat,.01);
 for(const side of [-1,1]){
  const shoulder=loft([[-1.23,.12,.1,.35,.42],[.55,.13,.12,.41,.51],[1.52,.18,.15,.49,.60]],pearl);shoulder.position.x=side*1.02;shell.add(shoulder);
  box(shell,.11,.14,2.27,side*1.20,-.12,.14,blackMat);
  box(shell,.026,.026,1.75,side*1.218,.04,.12,limeMat);
  box(shell,.035,.045,1.03,side*.78,.76,-.79,blackMat,-.61);
  box(shell,.06,.13,1.00,side*.80,.99,.10,pearl);
  box(shell,.25,.075,.19,side*1.26,.61,-.73,blackMat,0,.12*side);
  box(shell,.025,.07,.20,side*1.39,.61,-.75,pearl);
  // Slim front light bars and sculpted air intake.
  box(shell,.72,.042,.055,side*.65,.28,-2.34,whiteMat,0,-.12*side);
  box(shell,.49,.12,.055,side*.72,-.085,-2.44,blackMat);
  box(shell,.075,.09,.07,side*.89,.22,-2.37,whiteMat);
  line(shell,[[side*.92,.44,-1.40],[side*.96,.44,.40],[side*.95,.45,1.03]],0x34424a);
  // Rear quarter cooling slots.
  for(let k=0;k<5;k++)box(shell,.30,.018,.065,side*.91,.52,1.40+k*.13,blackMat,.04);
 }
 // Rear light blade, titanium diffuser, four gas nozzles.
 box(shell,2.18,.045,.055,0,.34,2.44,redMat);
 box(shell,2.32,.10,.28,0,.40,2.16,blackMat);
 for(let i=-2;i<=2;i++)box(shell,.045,.27,.51,i*.37,-.19,2.19,blackMat);
 const nozzles=[];
 for(const x of [-.78,-.27,.27,.78]){
  const outer=cylinder(shell,.125,.16,.23,x,.005,2.43,mat(0x626d73,{metalness:.95,roughness:.21}),24);outer.rotation.x=PI/2;
  const inner=cylinder(shell,.09,.09,.24,x,.005,2.44,blackMat,20);inner.rotation.x=PI/2;nozzles.push(new THREE.Vector3(x,.02,2.59));
 }
 // Rooster crest, styled as an aerodynamic fin.
 const crest=new THREE.Shape();crest.moveTo(-.42,0);crest.lineTo(-.30,.18);crest.lineTo(-.16,.08);crest.lineTo(-.02,.30);crest.lineTo(.13,.13);crest.lineTo(.28,.24);crest.lineTo(.43,0);crest.closePath();
 const crestMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(crest,{depth:.055,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.018,bevelThickness:.018}),mat(0xdb322d,{metalness:.5,roughness:.3}));crestMesh.rotation.y=PI/2;crestMesh.position.set(-.03,1.14,.52);shell.add(crestMesh);
 // Wheels, machined spokes, brake rotors and lime calipers.
 const wheels=[];
 for(const x of [-1.14,1.14])for(const z of [-1.54,1.53]){
  const pivot=new THREE.Group();pivot.position.set(x,-.08,z);shell.add(pivot);
  const wheel=new THREE.Group();pivot.add(wheel);wheels.push({pivot,wheel,front:z<0});
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,.30,40,1),rubberMat);tire.rotation.z=PI/2;wheel.add(tire);
  const side=Math.sign(x),rim=new THREE.Mesh(new THREE.CylinderGeometry(.345,.345,.018,32),mat(0x747e84,{metalness:1,roughness:.22}));rim.rotation.z=PI/2;rim.position.x=side*.164;wheel.add(rim);
  const plate=new THREE.Mesh(new THREE.CylinderGeometry(.30,.30,.025,32),blackMat);plate.rotation.z=PI/2;plate.position.x=side*.18;wheel.add(plate);
  for(let i=0;i<10;i++){const a=i*PI/5;box(wheel,.03,.055,.30,side*.20,Math.sin(a)*.15,Math.cos(a)*.15,mat(0x8c989e,{metalness:1,roughness:.25}),-a);}
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.045,16),blackMat);hub.rotation.z=PI/2;hub.position.x=side*.22;wheel.add(hub);
  box(pivot,.04,.22,.085,side*.17,.04,-.24,limeMat);
  const torus=new THREE.Mesh(new THREE.TorusGeometry(.39,.009,4,48),mat(0x30383b));torus.rotation.y=PI/2;torus.position.x=side*.155;wheel.add(torus);
 }
 // Badges and racing details.
 const badge=sign(shell,'TR','ROOSTER',0,.27,-2.48,.23,.08,'#d8ff3e');badge.rotation.y=PI;
 for(let i=0;i<3;i++)box(shell,.025,.008,.35,-.075+i*.075,.36,-1.92,limeMat);
 const under=new THREE.PointLight(C.lime,.7,3,2);under.position.set(0,-.2,0);shell.add(under);
 const jets=makeThrusters(shell);
 return {group,shell,wheels,nozzles,under,jets};
}

function makeThrusters(shell){
 const exhaustAxis=new THREE.Vector3(0,-1,0),nozzleAxis=new THREE.Vector3(0,1,0);
 const gasGeometry=new THREE.CylinderGeometry(.04,.30,2.3,16,1,true);
 const coreGeometry=new THREE.CylinderGeometry(.024,.07,.68,12,1,true);
 const steel=mat(0x77858d,{metalness:.95,roughness:.25});
 return THRUSTER_PORTS.map((port,index)=>{
  const position=new THREE.Vector3(...port.position),direction=new THREE.Vector3(...port.direction);
  if(port.kind!=='rear'){
   const housing=new THREE.Mesh(new THREE.CylinderGeometry(.10,.075,.11,16),steel);
   housing.quaternion.setFromUnitVectors(nozzleAxis,direction);housing.position.copy(position).addScaledVector(direction,-.035);shell.add(housing);
   const mouth=new THREE.Mesh(new THREE.CircleGeometry(.074,16),blackMat);mouth.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);mouth.position.copy(position).addScaledVector(direction,.023);shell.add(mouth);
  }
  const plume=new THREE.Group();plume.position.copy(position);plume.quaternion.setFromUnitVectors(exhaustAxis,direction);plume.visible=false;shell.add(plume);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{time:{value:0},strength:{value:0},phase:{value:index*2.71}},vertexShader:'varying vec2 vUv;uniform float time;uniform float phase;void main(){vUv=uv;vec3 p=position;float f=1.-uv.y;p.x+=sin(uv.y*23.-time*35.+phase)*.025*f;p.z+=cos(uv.y*19.-time*31.+phase)*.025*f;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;uniform float strength;uniform float phase;void main(){float fade=pow(vUv.y,1.6)*smoothstep(0.,.08,vUv.y);float turbulence=.7+.3*sin(vUv.y*62.-time*32.+phase+sin(vUv.x*31.));float side=.35+.65*pow(max(0.,sin(vUv.x*3.14159)),.65);vec3 gas=mix(vec3(.42,.72,1.),vec3(.9,.97,1.),vUv.y);gl_FragColor=vec4(gas*1.8,fade*turbulence*side*strength*.55);}'});
  const gas=new THREE.Mesh(gasGeometry,material);gas.position.y=-1.15;gas.frustumCulled=false;plume.add(gas);
  const coreMat=new THREE.MeshBasicMaterial({color:0xdcf3ff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
  const core=new THREE.Mesh(coreGeometry,coreMat);core.position.y=-.34;plume.add(core);
  return {port,position,direction,plume,material,coreMat,accumulator:0};
 });
}

export class Graphics{
 constructor(canvas,world){
  this.canvas=canvas;this.world=world;this.elapsed=0;this.low=false;this.motion=false;this.mode='menu';this.frameCount=0;this.cameraInitialized=false;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.info.autoReset=false;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x0b141e);this.scene.fog=new THREE.FogExp2(0x101e29,.0042);
  const pmrem=new THREE.PMREMGenerator(this.renderer),studio=new RoomEnvironment();this.scene.environment=pmrem.fromScene(studio,.045).texture;this.scene.environmentIntensity=.45;studio.dispose();pmrem.dispose();
  this.camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,700);
  this.camera.position.set(8,3,47);
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
  this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.27,.7,1.3);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  this.lights();this.sky();this.terrain();this.arena();this.props();
  this.car=makeCar();this.scene.add(this.car.group);this.car.group.position.set(0,.6,55);
  this.particles=new ParticleSystem(this.scene,650);this.trails=new SkidTrails(this.scene);
  this.ringMeshes=[];this.makeChallenges();
  this.batchStaticWorld();
  this.spotTarget=new THREE.Object3D();this.scene.add(this.spotTarget);
  this.headlight=new THREE.SpotLight(0xc6e7ff,65,52,.46,.65,1.4);this.scene.add(this.headlight);this.headlight.target=this.spotTarget;
  this.camTarget=new THREE.Vector3();this.camDesired=new THREE.Vector3();this.tmp=new THREE.Vector3();this.camLook=new THREE.Vector3();this.followYaw=0;this.wallCameraHold=0;
  this.wallVisibilityRay=new THREE.Raycaster();this.cameraWallOccluded=false;
  this.jetPosition=new THREE.Vector3();this.jetDirection=new THREE.Vector3();this.bodyQuaternion=new THREE.Quaternion();this.activeJets=[];
  this.resize();
 }
 batchStaticWorld(){
  // Merge immobile world boxes by shared material; the car and flight gates remain dynamic.
  this.scene.updateMatrixWorld(true);const groups=new Map();
  for(const child of [...this.scene.children]){if(!child.isMesh||child.geometry!==sharedBox)continue;const key=child.material.uuid;if(!groups.has(key))groups.set(key,{material:child.material,meshes:[]});groups.get(key).meshes.push(child);}
  for(const {material,meshes} of groups.values()){if(meshes.length<3)continue;const geometries=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrixWorld));const merged=mergeGeometries(geometries);if(!merged)continue;const mesh=new THREE.Mesh(merged,material);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);for(const m of meshes)this.scene.remove(m);for(const g of geometries)g.dispose();}
 }
 lights(){
  this.scene.add(new THREE.HemisphereLight(0x95b6c7,0x141910,.85));
  const moon=new THREE.DirectionalLight(0xa9c4db,.85);moon.position.set(-45,70,20);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);moon.shadow.camera.left=-65;moon.shadow.camera.right=65;moon.shadow.camera.top=65;moon.shadow.camera.bottom=-65;moon.shadow.camera.far=200;moon.shadow.bias=-.0003;moon.shadow.normalBias=.06;this.scene.add(moon);this.moon=moon;this.scene.add(moon.target);
  const key=new THREE.SpotLight(0xd7edff,260,70,.68,.65,1.7);key.position.set(-4,15,48);key.target.position.set(0,0,55);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.001;this.scene.add(key,key.target);
  const fill=new THREE.PointLight(0xafd6f5,24,30,1.8);fill.position.set(8,5,53);this.scene.add(fill);
  const rim=new THREE.PointLight(0xd8ff66,12,25,1.8);rim.position.set(-7,3,60);this.scene.add(rim);
 }
 sky(){
  const sky=new THREE.Mesh(new THREE.SphereGeometry(500,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x03070f)},bottom:{value:new THREE.Color(0x253946)}},vertexShader:'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vPos; uniform vec3 top; uniform vec3 bottom;void main(){float h=normalize(vPos).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-.05,.65,h)),1.);}'}));this.scene.add(sky);
  const p=[];let seed=42;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<750;i++){const theta=rand()*PI*2,phi=rand()*PI*.48,r=450;p.push(r*Math.cos(theta)*Math.sin(phi),r*Math.cos(phi),r*Math.sin(theta)*Math.sin(phi));}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));this.scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xc1d1dd,size:.65,sizeAttenuation:true,transparent:true,opacity:.8,depthWrite:false})));
  const moon=new THREE.Mesh(new THREE.SphereGeometry(2.1,20,20),new THREE.MeshBasicMaterial({color:0xd8e6ea}));moon.position.set(-140,155,-360);this.scene.add(moon);
 }
 terrain(){
  const tex=canvasTexture(512,512,(ctx,w,h)=>{ctx.fillStyle='#252b2c';ctx.fillRect(0,0,w,h);let s=77;for(let i=0;i<38000;i++){s=(s*16807)%2147483647;const x=s%w;s=(s*16807)%2147483647;const y=s%h;const v=22+s%45;ctx.fillStyle=`rgba(${v},${v+2},${v+3},.3)`;ctx.fillRect(x,y,s%3+1,1);}ctx.strokeStyle='#353c3c';ctx.lineWidth=1;for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(i*65,0);ctx.lineTo(i*65+15,512);ctx.stroke();}});tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(45,45);tex.anisotropy=8;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),mat(0x252e32,{map:tex,metalness:.15,roughness:.63,envMapIntensity:.25}));ground.rotation.x=-PI/2;ground.receiveShadow=true;this.scene.add(ground);
  // Continuous ridgeline with several scales of erosion, rather than repeated cones.
  const mountainMat=mat(0x080f16,{roughness:1,envMapIntensity:.1});
  const vertices=[],indices=[],segments=180,bands=9;
  for(let band=0;band<=bands;band++){const r=195+band*35;for(let i=0;i<=segments;i++){const a=i/segments*PI*2;const ridge=30+Math.sin(a*5+.7)*13+Math.sin(a*11)*8+Math.sin(a*27+band*.6)*4;const elevation=Math.sin(band/bands*PI*.85)*ridge+Math.sin(a*17+band)*2;vertices.push(Math.cos(a)*r,Math.max(-2,elevation),Math.sin(a)*r-65);if(band<bands&&i<segments){const n=band*(segments+1)+i;indices.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);}}}
  const terrain=new THREE.BufferGeometry();terrain.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));terrain.setIndex(indices);terrain.computeVertexNormals();const hills=new THREE.Mesh(terrain,mountainMat);this.scene.add(hills);
 }
 arena(){
  const concrete=mat(0x4a5152,{roughness:.75,metalness:.12});
  box(this.scene,27,.13,285,0,-.02,-61,mat(0x161e23,{roughness:.58,metalness:.2,envMapIntensity:.2}));
  // Red runway seams and alternating lane markings.
  for(const x of [-14.5,14.5]){
   box(this.scene,.09,.025,285,x,.07,-61,redMat);
   for(let z=75;z>-205;z-=12){box(this.scene,.7,.02,2.4,x,.09,z,whiteMat);box(this.scene,1.4,.16,.25,x,.13,z+4,blackMat);}
  }
  const paint=mat(0x87918a,{roughness:1});for(let z=70;z>-200;z-=10)box(this.scene,.12,.016,3.5,0,.07,z,paint);
  for(const side of [-1,1])for(let z=80;z>-210;z-=10){box(this.scene,.45,1.15,7.5,side*62,.57,z,concrete);box(this.scene,.05,.1,7.4,side*61.75,1.1,z,redMat);}
  // Hero circular pit with radial etched details.
  cylinder(this.scene,7.6,7.7,.12,0,.01,55,mat(0x232b2e,{metalness:.65,roughness:.34}),96);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(7.5,.026,4,128),limeMat);ring.rotation.x=PI/2;ring.position.set(0,.085,55);this.scene.add(ring);
  for(let i=0;i<48;i++){const a=i/48*PI*2;box(this.scene,.035,.008,.32,Math.sin(a)*7,.09,55+Math.cos(a)*7,paint,0,a);}
  // Floodlight structures and luminous panel heads.
  for(const side of [-1,1])for(const z of [65,-5,-85,-165]){
   const x=side*42;box(this.scene,.4,20,.4,x,10,z,blackMat);box(this.scene,5.2,.35,.6,x,20,z,blackMat);
   for(let i=0;i<4;i++)box(this.scene,.86,.26,.12,x-1.8+i*1.2,19.95,z+.34,whiteMat,-.35);
   const spot=new THREE.SpotLight(0xc8e7f0,330,70,.75,.65,1.7);spot.position.set(x,20,z);spot.target.position.set(side*7,0,z-12);this.scene.add(spot,spot.target);
   // Delicate haze beam, additive and intentionally low contrast.
   const beam=new THREE.Mesh(new THREE.ConeGeometry(8,24,20,1,true),new THREE.MeshBasicMaterial({color:0xaacbdb,transparent:true,opacity:.018,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));beam.position.set(x,9,z);beam.rotation.z=side*.32;this.scene.add(beam);
  }
  for(const z of [34,-40,-115,-190]){const banner=sign(this.scene,'TESTLA','ROOSTER / FLIGHT TEST DIVISION',-53,4,z,14,4);banner.rotation.y=PI/5;box(this.scene,.18,7,.18,-58,3.5,z,blackMat);box(this.scene,.18,7,.18,-48,3.5,z,blackMat);}
 }
 props(){
  const metal=mat(0x4b575c,{metalness:.75,roughness:.35});
  // Flight-control hangar and mission gantry.
  box(this.scene,24,11,15,49,5.4,-180,mat(0x293338,{metalness:.4,roughness:.55}));
  for(let x=38;x<=60;x+=2.2)box(this.scene,.13,10.5,.2,x,5.4,-172.4,metal);
  box(this.scene,15,6,.15,49,3,-172.2,blackMat);sign(this.scene,'R / 01','FLIGHT CONTROL',49,8.5,-172,16,3);
  for(let i=0;i<4;i++){box(this.scene,4,2,8,40+i*5,1,15,mat(i%2?0x333e3e:0x45504a));for(let k=0;k<8;k++)box(this.scene,.08,1.9,.02,38.5+i*5+k*.43,1,19.02,metal);}
  // Futuristic launch tower, deliberately simple silhouette.
  box(this.scene,4,32,4,56,16,-112,blackMat);for(const y of [5,13,21,29]){box(this.scene,4.15,.1,4.15,56,y,-112,redMat);}
  for(let y=1;y<30;y+=3)line(this.scene,[[54,y,-110],[58,y+3,-110],[54,y+6,-110]],0x667476,.6);
  // Cones are off the main driving line.
  for(let i=0;i<35;i++){const x=(i%2?-1:1)*(17+(i*7)%15),z=75-i*8;cylinder(this.scene,.035,.26,.7,x,.35,z,mat(0xad6230),10);box(this.scene,.55,.07,.55,x,.035,z,blackMat);}
 }
 makeChallenges(){
  const W=this.world;const rampMat=mat(0x576164,{metalness:.35,roughness:.5});
  const {x,z,width,length,height}=W.ramp;
  // Northward takeoff wedge with explicit top surface.
  const z0=z+length/2,z1=z-length/2;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x-width/2,0,z0,x+width/2,0,z0,x-width/2,height,z1,x+width/2,height,z1],3));g.setIndex([0,2,1,1,2,3]);g.computeVertexNormals();const ramp=new THREE.Mesh(g,rampMat);ramp.receiveShadow=true;ramp.material.side=THREE.DoubleSide;this.scene.add(ramp);
  for(const xx of [x-width/2,x+width/2])line(this.scene,[[xx,.08,z0],[xx,height+.08,z1]],C.lime);
  for(let i=1;i<8;i++){let t=i/8;box(this.scene,width*.85,.025,.25,x,height*t+.09,z0-length*t,limeMat,Math.atan2(height,length));}
  const tr=W.truckRamp;
  if(tr){const a=tr.z+tr.length/2,b=tr.z-tr.length/2;const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute([tr.x-tr.width/2,0,a,tr.x+tr.width/2,0,a,tr.x-tr.width/2,tr.height,b,tr.x+tr.width/2,tr.height,b],3));tg.setIndex([0,2,1,1,2,3]);tg.computeVertexNormals();const tm=new THREE.Mesh(tg,rampMat);tm.receiveShadow=true;this.scene.add(tm);for(const xx of [tr.x-tr.width/2,tr.x+tr.width/2])line(this.scene,[[xx,.1,a],[xx,tr.height+.1,b]],C.lime);for(let i=1;i<6;i++){const t=i/6;box(this.scene,tr.width*.85,.025,.25,tr.x,tr.height*t+.1,a-tr.length*t,limeMat,Math.atan2(tr.height,tr.length));}}
  // Curved inverted wall test, matching simulation's arc radius.
  const wall=W.wall||{x:-28,z:-100,width:16,radius:14};const wx=wall.x,wz=wall.z,wr=wall.radius||14,ww=wall.width||16;
  const startZ=wall.entryZ??-83;
  const pts=[],idx=[];for(let i=0;i<=96;i++){const a=i/96*PI,{surface}=wallPose(a,wall);pts.push(wx-ww/2,surface.y,surface.z,wx+ww/2,surface.y,surface.z);if(i<96){const j=i*2;idx.push(j,j+2,j+1,j+1,j+2,j+3);}}
  const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));wg.setIndex(idx);wg.computeVertexNormals();const wallMesh=new THREE.Mesh(wg,mat(0x667074,{side:THREE.DoubleSide,roughness:.68,metalness:.15}));wallMesh.receiveShadow=true;this.scene.add(wallMesh);this.wallMesh=wallMesh;
  for(const xx of [wx-ww/2,wx+ww/2]){const p=[];for(let i=0;i<=96;i++){const {surface,normal}=wallPose(i/96*PI,wall);p.push([xx,surface.y+normal.y*.06,surface.z+normal.z*.06]);}line(this.scene,p,C.red);}
  // A visible illuminated lip makes the inversion/return point unambiguous.
  box(this.scene,ww,.08,.12,wx,wr*2-.04,startZ,redMat);
  for(const xx of [wx-ww/2-1,wx+ww/2+1]){box(this.scene,.5,28,.5,xx,14,wz+wr,blackMat);for(let y=1;y<28;y+=4)line(this.scene,[[xx,y,wz+wr],[xx,y+4,wz+wr-5],[xx,y+8,wz+wr]],0x637079);}
  sign(this.scene,'02 / INVERT','SUCTION TEST / KEEP CLUCKING',wx,30,wz+wr,18,4);
  // Flight rings.
  const rings=W.rings||[{x:0,y:9,z:-70},{x:0,y:13,z:-100},{x:0,y:10,z:-132}];
  rings.forEach((r,i)=>{const group=new THREE.Group();group.position.set(r.x,r.y,r.z);this.scene.add(group);const radius=r.radius||5;
   const tor=new THREE.Mesh(new THREE.TorusGeometry(radius,.09,8,72),limeMat);group.add(tor);
   const outer=new THREE.Mesh(new THREE.TorusGeometry(radius+.3,.06,6,72),blackMat);group.add(outer);
   for(let k=0;k<8;k++){const a=k*PI/4;box(group,.09,.8,.15,Math.sin(a)*(radius+.3),Math.cos(a)*(radius+.3),0,whiteMat,0,0,-a);}
   box(group,.10,r.y,.10,-radius-1,-r.y/2,0,blackMat);box(group,.10,r.y,.10,radius+1,-r.y/2,0,blackMat);sign(group,`0${i+1}`,'FLIGHT GATE',0,radius+1.3,0,3,1);this.ringMeshes.push({group,tor,base:r,passed:false});
  });
  // Parking fleet obstacle, broad truck with visible landing clearance.
  const truck=W.truck||(W.trucks?.[0])||{x:25,z:-70,width:6,length:12};const tx=truck.x??25,tz=truck.z??-70;
  const truckGroup=new THREE.Group();truckGroup.position.set(tx,0,tz);this.scene.add(truckGroup);
  const th=truck.height||4;
  box(truckGroup,truck.width||5,th-.5,10,0,(th+.5)/2,0,mat(0x6d7980,{metalness:.7,roughness:.35}));box(truckGroup,4.9,2.3,3,0,1.65,-6,blackMat);box(truckGroup,4.7,.7,.09,0,2.6,-7.55,glassMat);
  for(const xx of [-2.3,2.3])for(const zz of [-5.4,2.6,4]){const wheel=cylinder(truckGroup,.63,.63,.35,xx,.65,zz,rubberMat,16);wheel.rotation.z=PI/2;}
  box(truckGroup,4.2,.08,.12,0,1.8,-7.62,whiteMat);sign(truckGroup,'EGGS','FRAGILE / DEFINITELY NOT A SEMI',0,3.1,5.06,4.5,2);
  // Dedicated assisted launch lane beside truck.
  const pad=W.landing||W.landingPad||{x:0,z:-160,radius:14};this.padCenter=new THREE.Vector3(pad.x||0,0,pad.z??-160);
  const padTex=canvasTexture(1024,1024,(ctx,w,h)=>{ctx.clearRect(0,0,w,h);ctx.strokeStyle='#d8ff3e';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(w/2,h/2,420,460,0,0,PI*2);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.arc(w/2,h/2,350,0,PI*2);ctx.stroke();ctx.fillStyle='#d8ff3e';ctx.textAlign='center';ctx.font='bold 190px Bahnschrift,Arial';ctx.fillText('R',w/2,h/2+60);ctx.font='32px Arial';ctx.fillText('LAND. DON’T LAY.',w/2,760);});
  const padMesh=new THREE.Mesh(new THREE.PlaneGeometry(27,27),new THREE.MeshBasicMaterial({map:padTex,transparent:true,depthWrite:false}));padMesh.rotation.x=-PI/2;padMesh.position.copy(this.padCenter);padMesh.position.y=.1;this.scene.add(padMesh);
  sign(this.scene,'TOUCHDOWN','LAND ON YOUR WHEELS / PLEASE',0,6,-182,19,4);
  const gate=W.gate||{x:0,z:12,width:18};for(const xx of [-gate.width/2,gate.width/2]){box(this.scene,.18,5,.18,gate.x+xx,2.5,gate.z,limeMat);}box(this.scene,gate.width,.16,.16,gate.x,5,gate.z,limeMat);sign(this.scene,'01 / LAUNCH','MAKE SOME QUESTIONABLE DECISIONS',gate.x,6.5,gate.z,18,2.6);
  // Direction painted into the floor, guiding the two launch paths.
  for(const [px,pz,txt] of [[0,30,'LAUNCH'],[-28,-55,'WALL RUN'],[25,-42,'KICKFLIP'],[0,-145,'LANDING']]){const t=textTexture(txt,'FLIGHT TEST COURSE');const m=new THREE.Mesh(new THREE.PlaneGeometry(9,3),new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:.65}));m.rotation.x=-PI/2;m.position.set(px,.095,pz);this.scene.add(m);}
 }
 settings(s){this.low=s.quality==='low';this.motion=!!s.reducedMotion;this.renderer.shadowMap.enabled=!this.low;this.bloom.enabled=!this.low;this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.low?1:1.5));this.resize();}
 resize(){const w=innerWidth,h=innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer.setSize(w,h);}
 setMode(mode){if(mode!==this.mode){this.mode=mode;this.cameraInitialized=false;this.wallCameraHold=0;}}
 render(dt,snapshot,input={}){
  this.elapsed+=dt;const c=snapshot.car;this.frameCount++;
  const menu=this.mode==='menu';
  if(menu){this.car.group.position.set(0,.6,55);this.car.group.rotation.set(0,0,0);this.car.shell.rotation.set(0,0,0);
   const a=this.motion?0:Math.sin(this.elapsed*.13)*.18;
   this.camDesired.set(7.4+Math.sin(a)*3,3.1,46.4+Math.cos(a)*.4);this.camLook.set(2.9,.85,55);
   if(innerWidth<700){this.camDesired.set(9,4,43);this.camLook.set(0,.9,55);}
   this.camera.position.lerp(this.camDesired,Math.min(1,dt*2));this.camera.lookAt(this.camLook);
  }else{
   this.car.group.position.set(c.x,c.y,c.z);this.car.group.rotation.set(0,c.yaw,0);this.car.shell.rotation.set(c.pitch,0,c.roll,'YXZ');
   const speed=Math.abs(c.speed);const dist=9.6+Math.min(speed*.075,4);
   // Stay outside the edge of the curved slab, then hold that shot until the car clears the lip.
   // A conventional camera behind the new heading would be on the far side of the road itself.
   this.wallCameraHold=c.wallRide ? .85 : Math.max(0,this.wallCameraHold-dt);
   const wallShot=c.wallRide||this.wallCameraHold>0;
   const desiredYaw=c.wallRide?-c.pitch:c.yaw;
   if(!this.cameraInitialized)this.followYaw=desiredYaw;
   this.followYaw+=Math.atan2(Math.sin(desiredYaw-this.followYaw),Math.cos(desiredYaw-this.followYaw))*(1-Math.exp(-dt*5));
   this.camDesired.set(c.x+Math.sin(this.followYaw)*dist,c.y+(c.airborne||c.wallRide?4.4:3.8),c.z+Math.cos(this.followYaw)*dist);
   this.camLook.set(c.x-Math.sin(c.yaw)*(c.wallRide?0:4),c.y+.7,c.z-Math.cos(c.yaw)*(c.wallRide?0:4));
   if(wallShot){this.camDesired.set(c.x+(this.world.wall.width/2+8),c.y+4.5,c.z+8);this.camLook.set(c.x,c.y+.4*Math.cos(c.pitch)*Math.cos(c.roll),c.z);}
   if(!this.cameraInitialized){this.camera.position.copy(this.camDesired);this.camTarget.copy(this.camLook);this.cameraInitialized=true;}
   this.camera.position.lerp(this.camDesired,1-Math.exp(-dt*4.5));this.camTarget.lerp(this.camLook,1-Math.exp(-dt*6));
   this.camera.position.y=Math.max(this.camera.position.y,1.5);this.camera.lookAt(this.camTarget);
   const fov=43+Math.min(speed*.23,12)+(input.boost?3:0);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,fov,dt*3);this.camera.updateProjectionMatrix();
   for(const w of this.car.wheels){w.wheel.rotation.x-=c.speed*dt/.46;w.pivot.rotation.y=w.front?(input.steer||0)*-.32:0;}
   if(input.brake&&Math.abs(c.speed)>7&&!c.airborne&&!c.wallRide){for(const side of [-1.1,1.1]){this.tmp.set(side,-.45,1.5).applyEuler(this.car.group.rotation).add(this.car.group.position);this.trails.add(this.tmp.x,this.tmp.z,c.yaw);if(this.frameCount%2===0)this.particles.emit(this.tmp.x,.2,this.tmp.z,(Math.random()-.5)*2,1,(Math.random()-.5)*2,.6,1,0x7c8c90);}}
  }
  this.updateThrusters(dt,menu?{}:c);
  this.particles.update(dt);this.trails.update(dt);
  for(let i=0;i<this.ringMeshes.length;i++){const r=this.ringMeshes[i];r.tor.rotation.z=this.elapsed*.07;const passed=!!snapshot.rings?.[i];if(passed!==r.passed){r.passed=passed;r.tor.material=passed?whiteMat:limeMat;}}
  this.tmp.set(0,.2,-2.2).applyEuler(this.car.group.rotation).add(this.car.group.position);this.headlight.position.copy(this.tmp);this.spotTarget.position.set(this.car.group.position.x-Math.sin(menu?0:c.yaw)*22,.15,this.car.group.position.z-Math.cos(menu?0:c.yaw)*22);
  // Follow player's light/shadow region instead of a fixed origin.
  this.moon.position.set(this.car.group.position.x-35,65,this.car.group.position.z+25);this.moon.target.position.copy(this.car.group.position);
  this.renderer.info.reset();if(this.low)this.renderer.render(this.scene,this.camera);else this.composer.render();
  this.cameraWallOccluded=false;
  if(!menu&&(c.wallRide||this.wallCameraHold>0)){
   this.tmp.set(0,.35,0).applyMatrix4(this.car.shell.matrixWorld);const distance=this.camera.position.distanceTo(this.tmp);
   this.tmp.sub(this.camera.position).normalize();this.wallVisibilityRay.set(this.camera.position,this.tmp);
   this.cameraWallOccluded=this.wallVisibilityRay.intersectObject(this.wallMesh,false).some(hit=>hit.distance<distance-.4);
  }
 }
 updateThrusters(dt,car){
  const commands=thrusterCommands(car);this.car.group.updateMatrixWorld(true);this.car.shell.getWorldQuaternion(this.bodyQuaternion);this.activeJets=[];
  for(let i=0;i<this.car.jets.length;i++){
   const jet=this.car.jets[i],strength=commands[i].strength;
   jet.plume.visible=strength>.025;jet.material.uniforms.strength.value=strength;jet.material.uniforms.time.value=this.elapsed;jet.coreMat.opacity=strength*.85;
   jet.plume.scale.set(.7+strength*.45,.55+strength*.65,.7+strength*.45);
   if(!jet.plume.visible){jet.accumulator=0;continue;}
   this.jetPosition.copy(jet.position).applyMatrix4(this.car.shell.matrixWorld);this.jetDirection.copy(jet.direction).applyQuaternion(this.bodyQuaternion);
   this.activeJets.push({id:jet.port.id,strength,position:this.jetPosition.toArray(),direction:this.jetDirection.toArray()});
   jet.accumulator+=dt*(this.low?22:42)*strength;
   while(jet.accumulator>=1){jet.accumulator--;const d=this.jetDirection,p=this.jetPosition;const distance=.22+Math.random()*.35;
    this.particles.emit(p.x+d.x*distance,p.y+d.y*distance,p.z+d.z*distance,d.x*11+(car.vx||0)*.25+(Math.random()-.5),d.y*11+(car.vy||0)*.25+(Math.random()-.5),d.z*11+(car.vz||0)*.25+(Math.random()-.5),.45+Math.random()*.35,.35+Math.random()*.25,0xc9e6f4);
   }
  }
 }
 event(event,snapshot){if(event.type==='crash'||event.type==='bank'){const c=snapshot.car;const n=event.type==='crash'?40:18;for(let i=0;i<n;i++)this.particles.emit(c.x,c.y+.6,c.z,(Math.random()-.5)*12,Math.random()*7,(Math.random()-.5)*12,.8,.7,event.type==='crash'?0xff9564:C.lime);}}
 stats(){return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,pixelRatio:this.renderer.getPixelRatio(),cameraWallOccluded:this.cameraWallOccluded,activeJets:this.activeJets.map(j=>({...j,position:[...j.position],direction:[...j.direction]}))};}
}

class ParticleSystem{
 constructor(scene,count){this.count=count;this.cursor=0;this.data=Array.from({length:count},()=>({life:0,max:1,x:0,y:-100,z:0,vx:0,vy:0,vz:0,size:1}));this.positions=new Float32Array(count*3);this.colors=new Float32Array(count*3);this.sizes=new Float32Array(count);this.alpha=new Float32Array(count);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.positions,3));g.setAttribute('aColor',new THREE.BufferAttribute(this.colors,3));g.setAttribute('aSize',new THREE.BufferAttribute(this.sizes,1));g.setAttribute('aAlpha',new THREE.BufferAttribute(this.alpha,1));
  const tex=canvasTexture(64,64,(ctx)=>{const gr=ctx.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,.5)');gr.addColorStop(.25,'rgba(255,255,255,.3)');gr.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);});
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{map:{value:tex}},vertexShader:'attribute vec3 aColor;attribute float aSize;attribute float aAlpha;varying vec3 vColor;varying float vAlpha;void main(){vColor=aColor;vAlpha=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(190.,aSize*270./max(1.,-mv.z));gl_Position=projectionMatrix*mv;}',fragmentShader:'uniform sampler2D map;varying vec3 vColor;varying float vAlpha;void main(){gl_FragColor=texture2D(map,gl_PointCoord)*vec4(vColor,vAlpha);}'});this.mesh=new THREE.Points(g,m);this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 emit(x,y,z,vx,vy,vz,size,life,color){const d=this.data[this.cursor];Object.assign(d,{x,y,z,vx,vy,vz,size,life,max:life});const c=new THREE.Color(color);c.toArray(this.colors,this.cursor*3);this.cursor=(this.cursor+1)%this.count;}
 update(dt){for(let i=0;i<this.count;i++){const d=this.data[i];if(d.life>0){d.life-=dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;d.vy+=dt*.5;d.vx*=1-dt;d.vz*=1-dt;this.positions.set([d.x,d.y,d.z],i*3);this.sizes[i]=d.size*(2-d.life/d.max);this.alpha[i]=Math.max(0,d.life/d.max)*.45;}else{this.positions[i*3+1]=-100;this.alpha[i]=0;}}
  for(const a of Object.values(this.mesh.geometry.attributes))a.needsUpdate=true;
 }
}
class SkidTrails{
 constructor(scene){this.next=0;this.count=550;this.life=new Float32Array(this.count);this.mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(.18,.65),new THREE.MeshBasicMaterial({color:0x080b0d,transparent:true,opacity:.62,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),this.count);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.o=new THREE.Object3D();for(let i=0;i<this.count;i++){this.o.position.y=-10;this.o.updateMatrix();this.mesh.setMatrixAt(i,this.o.matrix);}this.mesh.frustumCulled=false;scene.add(this.mesh);}
 add(x,z,yaw){this.o.position.set(x,.085,z);this.o.rotation.set(-PI/2,0,yaw);this.o.updateMatrix();this.mesh.setMatrixAt(this.next,this.o.matrix);this.life[this.next]=18;this.next=(this.next+1)%this.count;this.mesh.instanceMatrix.needsUpdate=true;}
 update(dt){for(let i=0;i<this.count;i++){if(this.life[i]>0){this.life[i]-=dt;if(this.life[i]<=0){this.o.position.set(0,-10,0);this.o.updateMatrix();this.mesh.setMatrixAt(i,this.o.matrix);this.mesh.instanceMatrix.needsUpdate=true;}}}}
}
