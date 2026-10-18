import test from 'node:test';
import assert from 'node:assert/strict';
import {THRUSTER_PORTS,thrusterCommands,rotateVehicleVector} from '../src/thrusters.js';
const active=car=>thrusterCommands(car).map((c,i)=>({...c,port:THRUSTER_PORTS[i]})).filter(c=>c.strength>.001);
const rollTorque=car=>active(car).reduce((sum,c)=>sum-c.port.position[0]*c.port.direction[1]*c.strength+c.port.position[1]*c.port.direction[0]*c.strength,0);

test('flat jump fires all underbody ports with downward exhaust and no rear plume',()=>{
 const jets=active({jetLift:1});assert.equal(jets.length,4);assert.ok(jets.every(j=>j.port.kind==='under'));
 for(const j of jets)assert.deepEqual(rotateVehicleVector(j.port.direction,{}),[0,-1,0]);
});
test('Q and E choose opposite diagonal nozzle banks and opposite physical roll torque',()=>{
 const e=active({jetRoll:1}),q=active({jetRoll:-1});
 assert.ok(e.every(j=>j.port.kind==='under'?j.port.side===1:j.port.kind==='roof'&&j.port.side===-1));
 assert.ok(q.every(j=>j.port.kind==='under'?j.port.side===-1:j.port.kind==='roof'&&j.port.side===1));
 assert.ok(rollTorque({jetRoll:1})>0);assert.ok(rollTorque({jetRoll:-1})<0);
});
test('inverted lift uses roof ports so gas still exits downward in world coordinates',()=>{
 const car={roll:Math.PI,jetLift:1};const jets=active(car);assert.ok(jets.every(j=>j.port.kind==='roof'));
 assert.ok(jets.every(j=>rotateVehicleVector(j.port.direction,car)[1]<-.999));
});
test('quarter roll lift uses side nozzles and nose-up lift uses rear nozzles',()=>{
 for(const car of [{roll:Math.PI/2,jetLift:1},{roll:-Math.PI/2,jetLift:1},{pitch:Math.PI/2,jetLift:1},{pitch:-Math.PI/2,jetLift:1}]){
  const jets=active(car);assert.ok(jets.length>0);assert.ok(jets.every(j=>rotateVehicleVector(j.port.direction,car)[1]<-.999));
 }
});
test('emission directions follow complete yaw, pitch and roll orientation; idle has no jets',()=>{
 assert.equal(active({}).length,0);const [x,y,z]=rotateVehicleVector([0,-1,0],{yaw:Math.PI/2,roll:Math.PI/2});assert.ok(Math.abs(x)<1e-10&&Math.abs(y)<1e-10&&Math.abs(z+1)<1e-10);
 for(const j of thrusterCommands({jetLift:10,jetRear:Infinity,jetRoll:2}))assert.ok(j.strength>=0&&j.strength<=1);
});
