import {
  Quadtree,
  mul,
  proj,
  lerp,
  norm,
  scale,
  plerp,
  sub,
  Bezier,
  generatePath,
} from "./geo.js";

let lastBreath = Date.now();
const breathe = (text) => {
  document.querySelector("#debug").innerText = "loading: " + text;
  if (Date.now() - lastBreath > 50) {
    lastBreath = Date.now();
    return new Promise((done) => setTimeout(done, 0));
  }
};

const rotY =
  (r) =>
  ([x, y, z]) => {
    const [rx, rz] = mul([x, z], r);
    return [rx, y, rz];
  };

export default async function buildWorld(bounds) {
  const q = new Quadtree(bounds, {
    maxDepth: 64,
    capacity: 8,
    getPos: (o) => o.pos,
  });

  // const height = 40;
  // const width = 8;
  // const pos = [0, 0];
  // q.insert({
  //   pos,
  //   id: "trunk",
  //   fill: [16, 8, 0],
  //   model: [
  //     [-2, 0, 0],
  //     [2, 0, 0],
  //     [2, height, 0],
  //     [-2, height, 0],
  //   ],
  // });
  // q.insert({
  //   id: "leaf1",
  //   pos,
  //   fill: [0, 24, 12],
  //   model: [
  //     [-width, height / 2, 8],
  //     [width, height / 2, 8],
  //     [0, height * 1.5, 0],
  //   ],
  // });
  // q.insert({
  //   id: "leaf2",
  //   pos,
  //   fill: [0, 18, 12],
  //   model: [
  //     [-width, height / 2, -8],
  //     [width, height / 2, -8],
  //     [0, height * 1.5, 0],
  //   ],
  // });

  // q.insert({
  //   id: "red",
  //   pos: [0, 0],
  //   fill: [64, 0, 0],
  //   model: [
  //     [-4, 8, 4],
  //     [0, 4, 4],
  //     [4, 8, 4],
  //     [0, 12, 4],
  //   ],
  // });

  // q.insert({
  //   id: "blue",
  //   pos: [0, 4],
  //   fill: [0, 0, 64],
  //   model: [
  //     [-4, 8, 0],
  //     [0, 4, 0],
  //     [4, 8, 0],
  //     [0, 12, 0],
  //   ],
  // });

  // q.insert({
  //   id: "square",
  //   pos: [0, 20],
  //   fill: [64, 0, 0],
  //   model: [
  //     [-5, -5, 0],
  //     [-5, 5, 0],
  //     [5, 5, 0],
  //     [5, -5, 0],
  //   ],
  // });

  // //north
  // q.insert({
  //   id: "arrow",
  //   pos: [0, 0],
  //   fill: [64, 64, 64],
  //   model: [
  //     [-4, 0, 0],
  //     [4, 0, 0],
  //     [0, 0, -16],
  //   ],
  // });

  // return q;

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
        Math.abs(pos[0]) < 60 ||
        Math.hypot(...pos) < 200)
    );
    if (tries >= 9) console.log("failed to place tree");
    const a = Math.random() * 6.28;

    const rot = [Math.cos(-a), Math.sin(-a)];
    const height = Math.random() * 40 + 20;
    const width = 8;
    q.insert({
      pos,
      fill: [16, 8, 0],
      model: [
        [-2, 0, -2],
        [2, 0, 2],
        [2, height, 2],
        [-2, height, -2],
      ].map(rotY(rot)),
    });
    q.insert({
      pos,
      fill: [0, 24, 12],
      model: [
        [-width - 2, height / 2, -width + 2],
        [width - 2, height / 2, width + 2],
        [0, height * 1.5, 0],
      ].map(rotY(rot)),
    });
    q.insert({
      pos,
      fill: [0, 18, 12],

      model: [
        [-width + 2, height / 2, -width - 2],
        [width + 2, height / 2, width - 2],
        [0, height * 1.5, 0],
      ].map(rotY(rot)),
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
  //       [0,  z,  0],
  //       [0 + Math.random(),  z + Math.random(),  0 + Math.random()],
  //     ],
  //   });
  //   if (i % 50000 === 0) {
  //     await breathe("sprites " + (((i / 500000) * 100) | 0));
  //   }
  // }

  await breathe("roads");

  const basicRoad = (s) => {
    q.insert({
      pos: s.center,
      fill: [100, 75, 0],
      model: [
        [5, 0, -1],
        [5, 0, 1],
        [-5, 0, 1],
        [-5, 0, -1],
      ].map(rotY(s.centerNorm)),
    });
    let ll = Math.hypot(...sub(s.frontLeft, s.backLeft)) / 2;
    q.insert({
      pos: s.centerLeft,
      fill: [64, 64, 64],
      model: [
        [ll, 0, -1],
        [ll, 0, 1],
        [-ll, 0, 1],
        [-ll, 0, -1],
      ].map(rotY(s.centerNorm)),
    });
    let rl = Math.hypot(...sub(s.frontRight, s.backRight)) / 2;
    q.insert({
      pos: s.centerRight,
      fill: [64, 64, 64],
      model: [
        [rl, 0, -1],
        [rl, 0, 1],
        [-rl, 0, 1],
        [-rl, 0, -1],
      ].map(rotY(s.centerNorm)),
    });
  };

  const makeBasicRoad = (bez) => {
    generatePath(bez, (bez.length / 40) | 0, 40).forEach(basicRoad);
  };

  // cross
  makeBasicRoad(new Bezier([0, 40], [0, 2048], [0, 6144], [0, 7960]));
  makeBasicRoad(new Bezier([0, -40], [0, -2048], [0, -6144], [0, -7960]));
  makeBasicRoad(new Bezier([40, 0], [2048, 0], [6144, 0], [7960, 0]));
  makeBasicRoad(new Bezier([-40, 0], [-2048, 0], [-6144, 0], [-7960, 0]));

  // ring
  makeBasicRoad(new Bezier([40, 8000], [8000, 8000], [8000, 8000], [8000, 40]));
  makeBasicRoad(
    new Bezier([8000, -40], [8000, -8000], [8000, -8000], [40, -8000])
  );
  makeBasicRoad(
    new Bezier([-40, -8000], [-8000, -8000], [-8000, -8000], [-8000, -40])
  );
  makeBasicRoad(
    new Bezier([-8000, 40], [-8000, 8000], [-8000, 8000], [-40, 8000])
  );

  const silofill = [20, 20, 20];
  const silopos = [120, 120];
  const silowidth = 50;
  const siloheight = 30;
  const eave = 50 - 54 * (20 / silowidth);
  q.insert({
    pos: silopos,
    fill: silofill,
    model: [
      [-silowidth, 0, -silowidth],
      [-silowidth, 0, silowidth],
      [-silowidth, siloheight, silowidth],
      [-silowidth, siloheight, -silowidth],
    ],
  });

  q.insert({
    pos: silopos,
    fill: silofill,
    model: [
      [silowidth, 0, -silowidth],
      [silowidth, 0, silowidth],
      [silowidth, siloheight, silowidth],
      [silowidth, siloheight, -silowidth],
    ],
  });

  q.insert({
    pos: silopos,
    fill: silofill,
    model: [
      [-silowidth, 0, -silowidth],
      [silowidth, 0, -silowidth],
      [silowidth, siloheight, -silowidth],
      [0, siloheight + 20, -silowidth],

      [-silowidth, siloheight, -silowidth],
    ],
  });

  q.insert({
    pos: silopos,
    fill: silofill,
    model: [
      [-silowidth, 0, silowidth],
      [silowidth, 0, silowidth],
      [silowidth, siloheight, silowidth],
      [0, siloheight + 20, silowidth],
      [-silowidth, siloheight, silowidth],
    ],
  });

  q.insert({
    pos: silopos,
    fill: [10, 10, 10],
    model: [
      [-silowidth - 4, eave, silowidth + 4],
      [-silowidth - 4, eave, -silowidth - 4],
      [0, siloheight + 20, -silowidth - 4],
      [0, siloheight + 20, silowidth + 4],
    ],
  });
  q.insert({
    pos: silopos,
    fill: [10, 10, 10],
    model: [
      [silowidth + 4, eave, silowidth + 4],
      [silowidth + 4, eave, -silowidth - 4],
      [0, siloheight + 20, -silowidth - 4],
      [0, siloheight + 20, silowidth + 4],
    ],
  });

  return q;
}
