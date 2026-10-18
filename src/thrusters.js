// Vehicle coordinates: +X right, +Y roof, -Z nose. Exhaust is opposite thrust.
export const THRUSTER_PORTS = Object.freeze([
 ...[-1,1].flatMap(side=>[-1,1].map(end=>({id:`lift-${side}-${end}`,kind:'under',side,end,position:[side*.88,-.33,end*1.4],direction:[0,-1,0]}))),
 ...[-1,1].flatMap(side=>[-1,1].map(end=>({id:`roof-${side}-${end}`,kind:'roof',side,end,position:[side*1.01,.61,end*1.4],direction:[0,1,0]}))),
 ...[-1,1].flatMap(side=>[-1,1].map(end=>({id:`side-${side}-${end}`,kind:'side',side,end,position:[side*1.31,.10,end*1.4],direction:[side,0,0]}))),
 ...[-.78,-.27,.27,.78].map((x,index)=>({id:`rear-${index}`,kind:'rear',position:[x,.02,2.59],direction:[0,0,1]})),
 ...[-.44,.44].map((x,index)=>({id:`nose-${index}`,kind:'nose',position:[x,-.01,-2.56],direction:[0,0,-1]})),
]);
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));

export function rotateVehicleVector(vector,car){
 const [x,y,z]=vector,r=car.roll||0,p=car.pitch||0,a=car.yaw||0;
 const rx=Math.cos(r)*x-Math.sin(r)*y,ry=Math.sin(r)*x+Math.cos(r)*y;
 const py=Math.cos(p)*ry-Math.sin(p)*z,pz=Math.sin(p)*ry+Math.cos(p)*z;
 return [Math.cos(a)*rx+Math.sin(a)*pz,py,-Math.sin(a)*rx+Math.cos(a)*pz];
}

export function thrusterCommands(car){
 const lift=clamp(car.jetLift),rear=clamp(car.jetRear);
 const roll=Math.max(-1,Math.min(1,car.jetRoll||0)),pitch=Math.max(-1,Math.min(1,car.jetPitch||0));
 // World-up requested force expressed in the rotating chassis frame.
 // This selects roof jets while inverted, side jets during a quarter roll, etc.
 const p=car.pitch||0,r=car.roll||0,up=[Math.sin(r)*Math.cos(p),Math.cos(r)*Math.cos(p),-Math.sin(p)];
 return THRUSTER_PORTS.map(port=>{
  let amount=0;
  if(port.kind==='under'||port.kind==='roof'){
   const under=port.kind==='under';
   amount=lift*Math.max(0,under?up[1]:-up[1]);
   // Equal-and-opposite port pairs produce a roll/pitch moment, without adding net force.
   const rollPair=under?port.side*roll:-port.side*roll;
   const pitchPair=under?-port.end*pitch:port.end*pitch;
   amount=Math.max(amount,Math.max(0,rollPair),Math.max(0,pitchPair));
  }else if(port.kind==='side')amount=lift*Math.max(0,-port.side*up[0]);
  else if(port.kind==='rear')amount=Math.max(rear,lift*Math.max(0,-up[2]));
  else if(port.kind==='nose')amount=lift*Math.max(0,up[2]);
  return {id:port.id,strength:clamp(amount)};
 });
}
