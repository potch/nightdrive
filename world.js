import { Quadtree, mul, proj, lerp } from "./geo.js";

let lastBreath = Date.now();
const breathe = (text) => {
  document.querySelector("#debug").innerText = "loading: " + text;
  if (Date.now() - lastBreath > 50) {
    lastBreath = Date.now();
    return new Promise((done) => setTimeout(done, 0));
  }
};

export default async function buildWorld(bounds) {
  const q = new Quadtree(bounds, {
    maxDepth: 64,
    capacity: 8,
    getPos: (o) => o.pos,
  });

  await breathe("trees");

  const count = 100000;
  for (let i = 0; i < count; i++) {
    let pos;
    let tries = 0;
    do {
      tries++;
      pos = bounds.random();
    } while (
      tries < 10 &&
      (Math.abs(Math.hypot(...pos) - 2048) < 70 ||
        Math.abs(Math.hypot(...pos) - 4096) < 70 ||
        Math.abs(pos[0]) < 60)
    );
    if (tries >= 9) console.log("failed to place tree");
    const lx = Math.random() * 4 - 2;
    const lz = Math.random() * 4 - 2;
    const a = Math.random() * 6.28;

    const rot = [Math.cos(-a), Math.sin(-a)];
    const height = Math.random() * 40 + 20;
    const width = 8;
    q.insert({
      pos,
      lx,
      lz,
      fill: [16, 8, 0],
      stroke: false,
      model: [
        [-2, -2, 0],
        [2, 2, 0],
        [2, 2, height],
        [-2, -2, height],
      ].map(([x, y, z]) => [...mul([x, y], rot), z]),
    });
    q.insert({
      pos,
      lx,
      lz,
      fill: [0, 24, 12],
      stroke: false,
      model: [
        [-width - 2, -width + 2, height / 2],
        [width - 2, width + 2, height / 2],
        [0, 0, height * 1.5],
      ].map(([x, y, z]) => [...mul([x, y], rot), z]),
    });
    q.insert({
      pos,
      lx,
      lz,
      fill: [0, 18, 12],
      stroke: false,

      model: [
        [-width + 2, -width - 2, height / 2],
        [width + 2, width - 2, height / 2],
        [0, 0, height * 1.5],
      ].map(([x, y, z]) => [...mul([x, y], rot), z]),
    });
    if (i % 5000 === 0) {
      await breathe("trees " + (((i / count) * 100) | 0));
    }
  }

  // await breathe("sprites");

  // // sprites
  // for (let i = 0; i < 500000; i++) {
  //   const x = Math.random() * 16384 - 8192;
  //   const y = Math.random() * 16384 - 8192;
  //   const z = Math.random() * 200 + 100;
  //   const speed = Math.random() * 10 + 5;
  //   q.insert({
  //     pos: [x, y],
  //     anim: (t) => lerp(z, 0, (t % speed) / speed),
  //     model: [
  //       [0, 0, z],
  //       [0 + Math.random(), 0 + Math.random(), z + Math.random()],
  //     ],
  //   });
  //   if (i % 50000 === 0) {
  //     await breathe("sprites " + (((i / 500000) * 100) | 0));
  //   }
  // }

  await breathe("roads");

  let roadRad = 2048;
  let roadDash = 400;
  let roadWidth = 40;
  for (let i = 0; i < roadDash; i += 1) {
    const a = (i / roadDash) * (Math.PI * 2);
    if (i > 97 && i < 103) continue;
    const rot = [Math.cos(-a), Math.sin(-a)];
    const z = 0;
    if (i % 2) {
      q.insert({
        pos: [roadRad * Math.cos(a), roadRad * Math.sin(a)],
        fill: [100, 75, 0],
        stroke: false,
        model: [
          [-5, 1, z],
          [5, 1, z],
          [5, -1, z],
          [-5, -1, z],
        ].map(([x, y, z]) => [...mul([x, y], rot), z]),
      });
    }
    const il = (2 * Math.PI * (roadRad - roadWidth)) / roadDash / 2;
    const ol = (2 * Math.PI * (roadRad + roadWidth)) / roadDash / 2;
    q.insert({
      pos: [
        (roadRad - roadWidth) * Math.cos(a),
        (roadRad - roadWidth) * Math.sin(a),
      ],
      fill: [20, 20, 20],
      stroke: false,
      model: [
        [-il, 0, z],
        [il, 0, z],
        [il - 0.5, 0, z + 7],
        [-il + 0.5, 0, z + 7],
      ].map(([x, y, z]) => [...mul([x, y], rot), z]),
    });
    q.insert({
      pos: [
        (roadRad + roadWidth) * Math.cos(a),
        (roadRad + roadWidth) * Math.sin(a),
      ],
      fill: [64, 64, 64],
      stroke: false,
      model: [
        [-ol, -1, z],
        [ol, -1, z],
        [ol, 1, z],
        [-ol, 1, z],
      ].map(([x, y, z]) => [...mul([x, y], rot), z]),
    });
  }

  await breathe("roads");

  roadRad = 4086;
  roadDash = 800;
  roadWidth = 40;
  for (let i = 0; i < roadDash; i += 1) {
    const a = (i / roadDash) * (Math.PI * 2);
    if (i > 197 && i < 203) continue;
    const rot = [Math.cos(-a), Math.sin(-a)];
    const z = 0;
    if (i % 2) {
      q.insert({
        pos: [roadRad * Math.cos(a), roadRad * Math.sin(a)],
        fill: [100, 75, 0],
        stroke: false,
        model: [
          [-5, 1, z],
          [5, 1, z],
          [5, -1, z],
          [-5, -1, z],
        ].map(([x, y, z]) => [...mul([x, y], rot), z]),
      });
    }
    const il = (2 * Math.PI * (roadRad - roadWidth)) / roadDash / 2;
    const ol = (2 * Math.PI * (roadRad + roadWidth)) / roadDash / 2;
    q.insert({
      pos: [
        (roadRad - roadWidth) * Math.cos(a),
        (roadRad - roadWidth) * Math.sin(a),
      ],
      fill: [20, 20, 20],
      stroke: false,
      model: [
        [-il, 0, z],
        [il, 0, z],
        [il - 0.5, 0, z + 7],
        [-il + 0.5, 0, z + 7],
      ].map(([x, y, z]) => [...mul([x, y], rot), z]),
    });
    q.insert({
      pos: [
        (roadRad + roadWidth) * Math.cos(a),
        (roadRad + roadWidth) * Math.sin(a),
      ],
      fill: [64, 64, 64],
      stroke: false,
      model: [
        [-ol, -1, z],
        [ol, -1, z],
        [ol, 1, z],
        [-ol, 1, z],
      ].map(([x, y, z]) => [...mul([x, y], rot), z]),
    });
  }

  await breathe("roads");

  const roadL = 200;
  for (let i = 0; i < roadL; i++) {
    const pr = (i) => proj(0, roadL, -50, 8192 - 60, i);
    const p = pr(i);
    if (p > 2048 - 80 && p < 2048 + 80) continue;
    if (p > 4096 - 80 && p < 4096 + 80) continue;
    const l = (pr(roadL) - pr(0)) / roadL / 2 + 1;
    const rot = [1, 0];
    const z = 0;
    // q.insert({
    //   pos: [0, p],
    //   fill: [8, 8, 8],
    //   model: [
    //     [-l, -40, -1],
    //     [-l, 40, -1],
    //     [l, 40, -1],
    //     [l, -40, -1],
    //     [-l, -40, -1],
    //   ],
    // });
    if (true) {
      q.insert({
        pos: [0, p],
        fill: [100, 75, 0],
        stroke: false,
        model: [
          [-5, 1, z],
          [5, 1, z],
          [5, -1, z],
          [-5, -1, z],
        ].map(([x, y, z]) => [...mul([x, y], rot), z]),
      });
    }
    q.insert({
      pos: [-40, p],
      fill: [64, 64, 64],
      stroke: false,
      model: [
        [-l, -1, z],
        [l, -1, z],
        [l, 1, z],
        [-l, 1, z],
      ].map(([x, y, z]) => [...mul([x, y], rot), z]),
    });
    q.insert({
      pos: [40, p],
      fill: [64, 64, 64],
      stroke: false,
      model: [
        [-l, -1, z],
        [l, -1, z],
        [l, 1, z],
        [-l, 1, z],
      ].map(([x, y, z]) => [...mul([x, y], rot), z]),
    });
  }

  return q;
}
