import * as T from 'three';

/** Original, texture-free architectural miniature. Units are metres at model scale. */
export function buildCampus({ mats, mesh, box, group }) {
  const root = new T.Group(); root.name = 'CreatorFootballCampus';
  const material = (name, values) => { mats[name] = new T.MeshStandardMaterial(values); mats[name].name = name; };
  material('campusStone', { color:'#64716c', roughness:.9 });
  material('roof', { color:'#a3afad', metalness:.3, roughness:.48 });
  material('paving', { color:'#424c46', roughness:1 });
  material('lawn', { color:'#294c3b', roughness:1 });
  material('pitch', { color:'#41865a', roughness:1 });
  material('pitchStripe', { color:'#36724d', roughness:1 });
  material('foliage', { color:'#32654d', roughness:1 });
  material('window', { color:'#5f8588', metalness:.4, roughness:.25, emissive:'#ac793b', emissiveIntensity:.2 });
  material('warm', { color:'#ffe1aa', emissive:'#ffd098', emissiveIntensity:1.5, roughness:.45 });
  // Clockwise points on a rounded rectangle; matching vertex counts allow lofted roofs.
  const outline = (w,d,r) => {
    const points=[];
    for(let corner=0;corner<4;corner++) {
      const cx=(corner===0||corner===3?1:-1)*(w/2-r);
      const cz=(corner<2?1:-1)*(d/2-r);
      for(let i=0;i<=5;i++) {
        const a=corner*Math.PI/2+i*Math.PI/10;
        points.push([cx+Math.cos(a)*r,cz+Math.sin(a)*r]);
      }
    }
    return points;
  };
  function slab(parent,w,d,r,h,mat,x,y,z) {
    const points=outline(w,d,r), shape=new T.Shape(points.map(([px,pz])=>new T.Vector2(px,-pz)));
    const geometry=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:1,steps:1});
    geometry.rotateX(-Math.PI/2);
    return mesh(parent,geometry,mat,x,y,z);
  }
  function loft(parent,loops,mat,z=-2) {
    const positions=[], indices=[];
    for(const {w,d,r,y} of loops) for(const [x,pz] of outline(w,d,r)) positions.push(x,y,pz+z);
    const n=24;
    for(let row=0;row<loops.length-1;row++) for(let i=0;i<n;i++) {
      const a=row*n+i,b=row*n+(i+1)%n,c=b+n,e=a+n;
      if(loops[row+1].w>loops[row].w) indices.push(a,b,e,b,c,e);
      else indices.push(a,e,b,b,e,c);
    }
    const geometry=new T.BufferGeometry(); geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(new Array(positions.length/3*2).fill(0),2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return mesh(parent,geometry,mat);
  }
  function beam(parent,a,b,width,mat) {
    const va=new T.Vector3(...a),vb=new T.Vector3(...b), delta=vb.clone().sub(va);
    const node=mesh(parent,new T.CylinderGeometry(width,width,delta.length(),6),mat);
    node.position.copy(va.add(vb).multiplyScalar(.5)); node.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()); return node;
  }
  function pitch(parent,x,z,w,d,goals=true) {
    slab(parent,w+.24,d+.24,.13,.035,'pitch',x,.13,z);
    for(let i=0;i<10;i++) box(parent,w/10,.012,d,i%2?'pitch':'pitchStripe',x-w/2+w*(i+.5)/10,.171,z);
    const mark=(ww,dd,xx,zz)=>box(parent,ww,.014,dd,'line',xx,.184,zz);
    const stroke=w*.003;
    for(const side of [-1,1]) { mark(w,stroke,x,z+side*d/2); mark(stroke,d,x+side*w/2,z); }
    mark(stroke,d,x,z);
    const circle=mesh(parent,new T.TorusGeometry(w*.087,stroke/2,4,32),'line',x,.194,z); circle.rotation.x=-Math.PI/2;
    for(const sign of [-1,1]) {
      mark(stroke,d*.49,x+sign*w*.34,z);
      for(const side of [-1,1]) mark(w*.16,stroke,x+sign*w*.42,z+side*d*.245);
      if(goals) {
        const gx=x+sign*(w/2+.035),gw=d*.27,gh=d*.125;
        for(const side of [-1,1]) {
          beam(parent,[gx,.2,z+side*gw/2],[gx,gh+.2,z+side*gw/2],stroke*.8,'line');
          beam(parent,[gx,gh+.2,z+side*gw/2],[gx+sign*.36,.2,z+side*gw/2],stroke*.5,'roof');
        }
        beam(parent,[gx,gh+.2,z-gw/2],[gx,gh+.2,z+gw/2],stroke*.8,'line');
        for(let i=0;i<6;i++) beam(parent,[gx,gh+.2,z-gw/2+i*gw/5],[gx+sign*.36,.2,z-gw/2+i*gw/5],stroke*.25,'roof');
      }
    }
  }
  function tree(parent,x,z,scale=1) {
    mesh(parent,new T.CylinderGeometry(.055,.09,.68*scale,5),'edge',x,.43*scale,z);
    const crown=mesh(parent,new T.IcosahedronGeometry(.47*scale,1),'foliage',x,1.02*scale,z); crown.scale.y=1.3;
  }
  const base=group(root,'campus');
  slab(base,28,23,2,.45,'edge',0,-.47,0);
  slab(base,27.8,22.8,1.9,.1,'lawn',0,-.02,0);
  slab(base,18,15,2,.06,'paving',-2,.085,-2);
  // Promenade and arrival avenue, a constant recognizable front gate.
  box(base,25,.04,1.4,'campusStone',0,.08,7.8);
  box(base,1.8,.04,21,'campusStone',-11.5,.08,0);
  box(base,1.5,.045,4,'paving',0,.1,9.6);
  for(const x of [-1.8,1.8]) { box(base,.6,1.3,.6,'edge',x,.68,10.7); box(base,.48,.045,.48,'warm',x,1.35,10.7); }
  for(const side of [-1,1]) for(let i=0;i<5;i++) {
    const x=side*(3.3+i*1.8); tree(base,x,10.1,.72+(i%3)*.12);
    box(base,1.05,.13,.8,'paving',x,.09,10.1);
  }
  for(let i=0;i<7;i++) { tree(base,-12.8,-8.8+i*2.3,.9); tree(base,12.7,-9+i*2.2,.8); }
  // The main field never moves as the club grows.
  const field=group(root,'playing_surface'); field.position.x=-2;
  pitch(field,0,-2,9,5.65);
  slab(field,10.5,7.1,.6,.055,'lawn',0,.06,-2);
  // Stadium stages replace one another so early roofs cannot intersect later tiers.
  for(let level=0;level<=5;level++) {
    const stand=group(root,`facility_stadium_stage_${level}_${level}`); stand.position.x=-2;
    const rows=[3,5,7,9,13,16][level];
    const step=.145, rise=.17;
    if(level<2) {
      for(const side of (level===0?[-1]:[-1,1])) for(let row=0;row<rows;row++) {
        box(stand,9.4,.12,.19,'campusStone',0,.22+row*rise,-2+side*(3.35+row*.2));
        box(stand,8.9,.035,.14,'primary',0,.30+row*rise,-2+side*(3.35+row*.2));
      }
      if(level===1) for(let row=0;row<4;row++) box(stand,.17,.09,5.6,'primary',-5.25-row*.2,.3+row*rise,-2);
      const roofY=.9+rows*rise;
      box(stand,9.9,.08,1.15,'roof',0,roofY,-5.9);
      for(const x of [-4.7,-2.4,0,2.4,4.7]) beam(stand,[x,.15,-6.4],[x,roofY,-6.4],.036,'edge');
      for(const z of [-5.13,1.13]) { box(stand,9.7,.11,.035,'edge',0,.32,z); }
      for(const x of [-5,5]) box(stand,.035,.11,6.4,'edge',x,.32,-2);
      box(stand,2.7,.6,1,'edge',3,.41,3.3); box(stand,2.35,.3,.02,'window',3,.55,3.81);
    } else {
      const upper=level>=4, width=10.35+rows*step*2, depth=7.25+rows*step*2, top=.26+rows*rise+(upper?.32:0);
      loft(stand,[{w:width-.75,d:depth-.75,r:1.15,y:.16},{w:width-.35,d:depth-.35,r:1.22,y:top*.42}],'edge');
      loft(stand,[{w:width-.35,d:depth-.35,r:1.22,y:top*.42},{w:width,d:depth,r:1.3,y:top+.18}],'window');
      for(const fraction of [.43,.72]) loft(stand,[{w:width-.2,d:depth-.2,r:1.27,y:top*fraction},{w:width-.2,d:depth-.2,r:1.27,y:top*fraction+.035}],'secondary');
      // Readable continuous seat rows; aisle spokes break them into sections.
      for(let row=0;row<rows;row++) {
        const gap=upper&&row>=8?.32:0, y=.24+row*rise+gap, w=10.35+row*step*2,d=7.25+row*step*2;
        loft(stand,[{w,d,r:.6+row*.055,y},{w:w+step*1.7,d:d+step*1.7,r:.6+row*.055,y},{w:w+step*1.7,d:d+step*1.7,r:.6+row*.055,y:y+.095}],row%4===0?'campusStone':'primary');
        for(const side of [-1,1]) {
          for(let seat=0;seat<42;seat++) {
            if(seat%14===0) continue;
            const chair=mesh(stand,new T.PlaneGeometry(.14,.09),seat%14<3?'secondary':'roof',-4.1+seat*.2,y+.105,-2+side*(d/2+.10));
            chair.rotation.x=-Math.PI/2;
          }
          for(let seat=0;seat<24;seat++) {
            if(seat%12===0) continue;
            const chair=mesh(stand,new T.PlaneGeometry(.09,.14),seat%12<2?'secondary':'roof',side*(w/2+.1),y+.105,-4.3+seat*.2);
            chair.rotation.x=-Math.PI/2;
          }
        }
      }
      for(const sign of [-1,1]) for(const x of [-3.9,-1.3,1.3,3.9]) {
        const stairs=box(stand,.12,.08,(depth-7.1)/2,'roof',x,top*.55,-2+sign*(3.55+(depth-7.1)/4));
        stairs.rotation.x=sign*-.79;
      }
      // Glazed concourse, buttresses and a warm welcome beneath the stands.
      for(const side of [-1,1]) {
        box(stand,width-2,.38,.022,'window',0,top*.42,-2+side*(depth/2+.018));
        box(stand,width-2,.045,.04,'warm',0,top*.42-.2,-2+side*(depth/2+.04));
        for(let x=-width/2+1;x<width/2;x+=.85) box(stand,.09,top*.7,.14,'campusStone',x,top*.37,-2+side*depth/2);
      }
      if(level<5) {
        for(const side of [-1,1]) {
          const canopy=box(stand,width+.35,.085,1.38,'roof',0,top+.65,-2+side*(depth/2-.55)); canopy.rotation.x=side*.08;
          box(stand,width+.4,.09,.055,'secondary',0,top+.65,-2+side*(depth/2+.15));
          for(const x of [-width/2+.8,0,width/2-.8]) beam(stand,[x,.15,-2+side*(depth/2+.15)],[x,top+.69,-2+side*(depth/2+.15)],.045,'campusStone');
        }
        if(level>=3) for(const side of [-1,1]) { box(stand,1.25,.09,depth-1.8,'roof',side*(width/2-.45),top+.56,-2); }
      } else {
        // A continuous, sculpted floating canopy. The centre stays open to the pitch.
        loft(stand,[{w:width+.7,d:depth+.7,r:1.65,y:top+.63},{w:width-.2,d:depth-.2,r:1.4,y:top+1.18},{w:11.5,d:8.4,r:.8,y:top+.72}],'roof');
        loft(stand,[{w:width+.72,d:depth+.72,r:1.66,y:top+.48},{w:width+.72,d:depth+.72,r:1.66,y:top+.64}],'secondary');
        for(let i=0;i<24;i++) {
          const [x,z]=outline(width+.1,depth+.1,1.4)[i];
          beam(stand,[x*.94,.14,z*.94-2],[x,top+.65,z-2],.045,'roof');
        }
        for(const side of [-1,1]) {
          box(stand,5.6,.66,.65,'window',0,1.02,-2+side*(depth/2+.27));
          box(stand,6,.12,.95,'roof',0,1.42,-2+side*(depth/2+.27));
        }
      }
      // Broadcast tunnel and entry stairs anchor the front elevation.
      box(stand,1.1,.65,.8,'edge',0,.46,-2+depth/2+.2);
      for(let step=0;step<3;step++) box(stand,2+step*.25,.08,.24,'campusStone',0,.25-step*.055,-2+depth/2+.6+step*.22);
      box(stand,1.05,.075,.045,'secondary',0,.82,-2+depth/2+.62);
    }
    // Four slim light masts; discreet posts at the grassroots levels.
    const height=level<2?2.2:level<4?3.9:4.8;
    for(const x of [-6.55,6.55]) for(const z of [-7.3,3.3]) {
      beam(stand,[x,.12,z],[x,height,z],.045,'campusStone');
      box(stand,level<2?.48:.8,.24,.11,'edge',x,height,z);
      box(stand,level<2?.42:.72,.16,.03,'warm',x,height,z+.07);
    }
  }
  function pavilion(id,x,z,w,d) {
    const low=group(root,`${id}_1`);
    slab(low,w+.4,d+.4,.2,.06,'roof',x,.08,z);
    box(low,w,.8,d,'edge',x,.52,z);
    box(low,w-.25,.43,.035,'window',x,.66,z+d/2+.02);
    box(low,w+.16,.10,d+.16,'roof',x,.99,z);
    box(low,w*.6,.05,.04,'warm',x,.92,z+d/2+.045);
    const expanded=group(root,`${id}_3`);
    box(expanded,w*.7,.66,d*.86,'edge',x,.99+.33,z);
    box(expanded,w*.7-.14,.38,.04,'window',x,1.37,z+d*.43+.025);
    box(expanded,w*.7+.15,.095,d*.86+.15,'roof',x,1.68,z);
  }
  pavilion('facility_academy',-7.4,6.1,4,1.9);
  pavilion('facility_medical',5.2,6.1,3.5,1.9);
  pavilion('facility_creator_studio',10.1,5.9,2.7,2.2);
  pavilion('facility_training_centre',10,-6.9,3.8,2.8);
  const training=root.getObjectByName('facility_training_centre_1'); pitch(training,10,-2.4,3.4,2.3,false);
  const trainingElite=group(root,'facility_training_centre_4'); pitch(trainingElite,10,1.2,3.4,2.3,false);
  const academy=group(root,'facility_academy_4'); pitch(academy,-8.6,-8.9,3.9,2.4,false);
  return root;
}
