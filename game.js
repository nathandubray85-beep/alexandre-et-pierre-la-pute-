import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const $ = id => document.getElementById(id);
const menu = $("menu"), play = $("play"), errorBox = $("error");

let scene, camera, renderer;
let player, bots=[], bullets=[];
let kills=0, playing=false, locked=false;
const keys={};
const zone={radius:210,min:55};

function showError(msg){
  errorBox.textContent=msg;
  errorBox.style.display="block";
}

try {
  init();
} catch(e) {
  console.error(e);
  showError("Impossible de charger le jeu 3D. Vérifie que Docker/Internet autorise le chargement de Three.js.");
}

function init(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x88b8dc);
  scene.fog=new THREE.Fog(0x88b8dc,90,430);

  camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,700);
  camera.position.set(0,2,35);

  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xbfe3ff,0x334422,2));
  const sun=new THREE.DirectionalLight(0xffffff,2.4);
  sun.position.set(-80,120,40); sun.castShadow=true;
  scene.add(sun);

  buildCity();

  player={pos:new THREE.Vector3(0,1.8,35),yaw:Math.PI,pitch:0,hp:100,cool:0};
  createBots();

  addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true});
  addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false});

  renderer.domElement.addEventListener("click",()=>{
    if(playing && !locked) renderer.domElement.requestPointerLock();
  });

  addEventListener("pointerlockchange",()=>{
    locked=document.pointerLockElement===renderer.domElement;
  });

  addEventListener("mousemove",e=>{
    if(!locked || !playing)return;
    player.yaw-=e.movementX*.0022;
    player.pitch-=e.movementY*.0018;
    player.pitch=THREE.MathUtils.clamp(player.pitch,-1.25,1.25);
  });

  addEventListener("mousedown",e=>{
    if(e.button===0 && playing) playerShoot();
  });

  play.addEventListener("click",startGame);

  addEventListener("resize",()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });

  animate();
}

function buildCity(){
  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(520,520),
    new THREE.MeshStandardMaterial({color:0x476b3b,roughness:1})
  );
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

  const roadMat=new THREE.MeshStandardMaterial({color:0x343b42});
  const lineMat=new THREE.MeshBasicMaterial({color:0xd9d9c4});
  const mats=[
    new THREE.MeshStandardMaterial({color:0x8c98a3}),
    new THREE.MeshStandardMaterial({color:0xb5a58e}),
    new THREE.MeshStandardMaterial({color:0x5e7284}),
    new THREE.MeshStandardMaterial({color:0x9a9a9a})
  ];

  function road(x,z,w,d,vertical=false){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,.04,d),roadMat);
    m.position.set(x,.02,z); scene.add(m);
    if(!vertical){
      for(let i=-w/2+5;i<w/2;i+=8){
        const l=new THREE.Mesh(new THREE.BoxGeometry(3,.045,.18),lineMat);
        l.position.set(x+i,.05,z); scene.add(l);
      }
    }
  }

  road(0,0,500,24); road(0,90,500,18);
  road(90,0,18,500,true); road(-90,0,18,500,true);
  road(0,0,24,500,true);

  function box(x,z,w,h,d,mat){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true; scene.add(m);
    const wm=new THREE.MeshBasicMaterial({color:0x9ed5e8});
    const rows=Math.max(2,Math.floor(h/5)), cols=Math.max(2,Math.floor(w/4));
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      if(Math.random()<.72){
        const p=new THREE.Mesh(new THREE.PlaneGeometry(.9,1.25),wm);
        p.position.set(x-w/2+.9+c*(w-1.8)/(cols-1),h*(r+1)/(rows+1),z-d/2-.01);
        scene.add(p);
      }
    }
  }

  for(let gx=-170;gx<=170;gx+=38){
    for(let gz=-170;gz<=170;gz+=38){
      if(Math.abs(gx)<22||Math.abs(gz)<22||Math.abs(gz-90)<15||Math.abs(gx-90)<15||Math.abs(gx+90)<15) continue;
      box(gx+(Math.random()-.5)*5,gz+(Math.random()-.5)*5,
          25+Math.random()*9,12+Math.random()*48,25+Math.random()*9,
          mats[Math.floor(Math.random()*mats.length)]);
    }
  }

  for(let i=0;i<100;i++){
    const x=(Math.random()-.5)*420,z=(Math.random()-.5)*420;
    if(Math.abs(x)<30||Math.abs(z)<30)continue;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.35,.5,3,8),new THREE.MeshStandardMaterial({color:0x654321}));
    trunk.position.set(x,1.5,z);scene.add(trunk);
    const crown=new THREE.Mesh(new THREE.SphereGeometry(2.2,8,6),new THREE.MeshStandardMaterial({color:0x315b32}));
    crown.position.set(x,4,z);scene.add(crown);
  }
}

function createBots(){
  bots=[];
  for(let i=0;i<10;i++){
    const p=new THREE.Vector3();
    do{
      p.set((Math.random()-.5)*330,1.4,(Math.random()-.5)*330);
    }while(p.distanceTo(player.pos)<55);
    bots.push({pos:p,hp:100,alive:true,cool:Math.random(),dir:new THREE.Vector3(),timer:0});
  }
}

function startGame(){
  errorBox.style.display="none";
  resetGame();
  menu.classList.add("hidden");
  // Important: pointer lock is requested directly from the button click.
  renderer.domElement.requestPointerLock?.();
}

function shoot(owner,target,damage){
  const dir=target.clone().sub(owner.pos).normalize();
  const mesh=new THREE.Mesh(
    new THREE.SphereGeometry(.09,8,8),
    new THREE.MeshBasicMaterial({color:0xfff1a8})
  );
  mesh.position.copy(owner.pos).addScaledVector(dir,1);
  scene.add(mesh);
  bullets.push({mesh,owner,vel:dir.multiplyScalar(70),life:2,damage});
}

function playerShoot(){
  if(player.cool>0)return;
  const dir=new THREE.Vector3();
  camera.getWorldDirection(dir);
  shoot(player,player.pos.clone().add(dir.multiplyScalar(100)),25);
  player.cool=.18;
}

function resetGame(){
  for(const b of bullets)scene.remove(b.mesh);
  bullets=[];
  player.pos.set(0,1.8,35);
  player.yaw=Math.PI; player.pitch=0; player.hp=100; player.cool=0;
  kills=0; zone.radius=210;
  createBots();
  playing=true;
  $("title").textContent="BATTLE ROYALE";
  $("subtitle").textContent="Grande ville 3D · 10 bots · zone qui rétrécit";
  play.textContent="JOUER";
  $("hp").textContent="100"; $("kills").textContent="0"; $("remaining").textContent="10";
}

function update(dt){
  if(!playing)return;

  player.cool=Math.max(0,player.cool-dt);
  const forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const move=new THREE.Vector3();

  if(keys["w"]||keys["z"]||keys["arrowup"])move.add(forward);
  if(keys["s"]||keys["arrowdown"])move.sub(forward);
  if(keys["d"]||keys["arrowright"])move.add(right);
  if(keys["a"]||keys["q"]||keys["arrowleft"])move.sub(right);

  if(move.lengthSq()){
    move.normalize().multiplyScalar((keys["shift"]?18:10)*dt);
    player.pos.add(move);
  }

  player.pos.x=THREE.MathUtils.clamp(player.pos.x,-245,245);
  player.pos.z=THREE.MathUtils.clamp(player.pos.z,-245,245);

  for(const b of bots){
    if(!b.alive)continue;
    const d=b.pos.distanceTo(player.pos);
    if(d<85){
      const v=player.pos.clone().sub(b.pos);v.y=0;
      if(v.length()>15)b.pos.add(v.normalize().multiplyScalar(5*dt));
      b.cool-=dt;
      if(b.cool<=0){shoot(b,player.pos.clone(),10);b.cool=.7+Math.random()*.8}
    }else{
      b.timer-=dt;
      if(b.timer<=0){b.dir.set(Math.random()-.5,0,Math.random()-.5).normalize();b.timer=1+Math.random()*3}
      b.pos.addScaledVector(b.dir,3*dt);
    }
    if(b.pos.length()>zone.radius)b.hp-=9*dt;
    if(b.hp<=0)b.alive=false;
  }

  if(player.pos.length()>zone.radius)player.hp-=12*dt;
  if(zone.radius>zone.min)zone.radius-=2.2*dt;

  for(const b of bullets){
    b.mesh.position.addScaledVector(b.vel,dt); b.life-=dt;
    if(b.owner===player){
      for(const bot of bots) if(bot.alive&&b.mesh.position.distanceTo(bot.pos)<1.7){
        b.life=0; bot.hp-=b.damage;
        if(bot.hp<=0){bot.alive=false;kills++}
        break;
      }
    }else if(b.mesh.position.distanceTo(player.pos)<1.7){
      player.hp-=b.damage;b.life=0;
    }
  }

  for(let i=bullets.length-1;i>=0;i--){
    if(bullets[i].life<=0){scene.remove(bullets[i].mesh);bullets.splice(i,1)}
  }

  camera.position.set(player.pos.x,player.pos.y,player.pos.z);
  camera.rotation.order="YXZ";
  camera.rotation.y=player.yaw;
  camera.rotation.x=player.pitch;

  $("hp").textContent=Math.max(0,Math.round(player.hp));
  $("kills").textContent=kills;
  $("remaining").textContent=bots.filter(b=>b.alive).length;

  if(player.hp<=0||bots.every(b=>!b.alive)) end(player.hp>0);
}

function end(win){
  playing=false;
  document.exitPointerLock?.();
  $("title").textContent=win?"VICTOIRE !":"ÉLIMINÉ";
  $("subtitle").textContent=win?`Tu as gagné avec ${kills} élimination(s).`:`Tu as fait ${kills} élimination(s).`;
  play.textContent="REJOUER";
  menu.classList.remove("hidden");
}

function animate(){
  requestAnimationFrame(animate);
  const now=performance.now();
  const dt=Math.min((now-(animate.last||now))/1000,.05);
  animate.last=now;
  update(dt);
  renderer.render(scene,camera);
}
