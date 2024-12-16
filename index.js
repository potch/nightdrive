import {
  pointInPolygon,
  bbox,
  Quadtree,
  Rect,
  scale,
  add,
  affine,
  affineMul,
  invertAffine,
  proj,
  lerp,
  ilerp,
  mul,
  norm,
  sub,
} from "./geo.js";

const bounds = new Rect([-8192, -8192], [16384, 16384]);
const q = new Quadtree(bounds, { getPos: (o) => o.pos });

const atZ = ([x, y], z) => [x, y, z];

let playerPos = [-2048 - 25, 0];
let playerAngle = 0;
let playerTurn = 0;
let playerVel = 0;
let gas = 0;
let brake = 0;
let playerWheel = 0;
let facing = [0, -1];

const WIDTH = 640;
const HEIGHT = 480;
const ASPECT = WIDTH / HEIGHT;
const WIDTH_2 = WIDTH / 2;
const HEIGHT_2 = HEIGHT / 2;
const perspective = 30;
const focal = 768;
const focalNear = -32;
const fovW = 45;
const fovH = fovW / ASPECT;
const camHeight = 10;
const toScreenSpace = ([x, y, z]) => {
  const scale = perspective / (perspective + y - focalNear);
  return [
    proj(-fovW, fovW, -WIDTH, WIDTH, x * scale),
    proj(-fovH, fovH, HEIGHT, -HEIGHT, (z - camHeight) * scale),
  ];
};

const frust = [
  [focalNear, -fovW],
  [focalNear, fovW],
  [focal, fovW / (perspective / (perspective + focal - focalNear)) / 2],
  [focal, -fovW / (perspective / (perspective + focal - focalNear)) / 2],
];

const count = 40000;
const poles = [];
for (let i = 0; i < count; i++) {
  let pos;
  do {
    pos = [Math.random() * 16384 - 8192, Math.random() * 16384 - 8192];
  } while (
    Math.abs(Math.hypot(...pos) - 2048) < 60 ||
    Math.abs(Math.hypot(...pos) - 4096) < 60
  );
  const obj = {
    pos,
    height: Math.random() * 100 + 10,
    lx: Math.random() * 10 - 5,
    lz: Math.random() * 10 - 5,
  };
  obj.model = [
    [-2, -2, 0],
    [2, -2, 0],
    [2, 2, 0],
    [-2, 2, 0],
    [-2, -2, 0],
    [0, 0, 0],
    [obj.lx, obj.lz, obj.height],
  ];
  poles.push(obj);
  q.insert(obj);
}

// const size = 64;
// const size2 = size * 0.25;
// for (let i = -4096; i < 4096; i += size) {
//   for (let j = -4096; j < 4096; j += size) {
//     const o = {
//       pos: [i + size / 2, j + size / 2],
//       model: [
//         [-size2, -size2, 0],
//         [-size2, size2, 0],
//         [size2, size2, 0],
//         [size2, -size2, 0],
//         [-size2, -size2, 0],
//       ],
//     };
//     q.insert(o);
//   }
// }

let roadRad = 2048;
let roadDash = 400;
let roadWidth = 50;
for (let i = 0; i < roadDash; i += 1) {
  const a = (i / roadDash) * (Math.PI * 2);
  const rot = [Math.cos(-a), Math.sin(-a)];
  const z = 0;
  if (i % 2) {
    q.insert({
      pos: [roadRad * Math.cos(a), roadRad * Math.sin(a)],
      fill: [100, 75, 0],
      model: [
        [-5, 1, z],
        [5, 1, z],
        [5, -1, z],
        [-5, -1, z],
        [-5, 1, z],
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
    model: [
      [-il, 0, z],
      [il, 0, z],
      [il - 0.5, 0, z + 7],
      [-il + 0.5, 0, z + 7],
      [-il, 0, z],
    ].map(([x, y, z]) => [...mul([x, y], rot), z]),
  });
  q.insert({
    pos: [
      (roadRad + roadWidth) * Math.cos(a),
      (roadRad + roadWidth) * Math.sin(a),
    ],
    model: [
      [-ol, 0, z],
      [ol, 0, z],
    ].map(([x, y, z]) => [...mul([x, y], rot), z]),
  });
}

roadRad = 4086;
roadDash = 800;
roadWidth = 50;
for (let i = 0; i < roadDash; i += 1) {
  const a = (i / roadDash) * (Math.PI * 2);
  const rot = [Math.cos(-a), Math.sin(-a)];
  const z = 0;
  if (i % 2) {
    q.insert({
      pos: [roadRad * Math.cos(a), roadRad * Math.sin(a)],
      fill: [100, 75, 0],
      model: [
        [-5, 1, z],
        [5, 1, z],
        [5, -1, z],
        [-5, -1, z],
        [-5, 1, z],
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
    model: [
      [-il, 0, z],
      [il, 0, z],
      [il - 0.5, 0, z + 7],
      [-il + 0.5, 0, z + 7],
      [-il, 0, z],
    ].map(([x, y, z]) => [...mul([x, y], rot), z]),
  });
  q.insert({
    pos: [
      (roadRad + roadWidth) * Math.cos(a),
      (roadRad + roadWidth) * Math.sin(a),
    ],
    model: [
      [-ol, 0, z],
      [ol, 0, z],
    ].map(([x, y, z]) => [...mul([x, y], rot), z]),
  });
}

q.insert({
  pos: [0, 0],
  model: [
    [-2, -30, 0],
    [-2, -30, 20],
    [-2, 30, 20],
    [-2, 30, 0],
    [2, 30, 0],
    [2, 30, 20],
    [2, -30, 20],
    [2, -30, 0],
  ],
});

const start = () => {
  const canvas = document.createElement("canvas");
  Object.assign(canvas, { width: WIDTH, height: HEIGHT });
  const debug = document.createElement("pre");
  document.body.append(canvas, debug);
  const ctx = canvas.getContext("2d");

  let avg = 0;
  const frame = () => {
    const now = Date.now();

    // movement
    playerVel *= 0.99;
    playerTurn *= 0.9;
    if (playerWheel) {
      playerTurn = Math.min(Math.max(-2, playerTurn + playerWheel), 2);
    }
    if (gas) {
      playerVel = Math.max(-2, Math.min(playerVel + gas, 4));
    }

    playerAngle += playerTurn * playerVel;

    facing = [
      -Math.sin((playerAngle / 180) * Math.PI),
      Math.cos((playerAngle / 180) * Math.PI),
    ];
    playerPos = add(playerPos, scale(facing, playerVel));

    // drawing
    const toPlayerSpace = affine(facing, playerPos);
    const fromPlayerSpace = invertAffine(toPlayerSpace);
    const f = frust.map((p) => affineMul(p, toPlayerSpace));

    ctx.fillStyle = "#010008";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#888";

    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(WIDTH_2, HEIGHT_2);

    const fbox = bbox(f);
    // plot(f, true);
    const search = Rect.tlbr(...fbox);

    const objs = q.query(search);
    // ctx.fillStyle = "red";
    // ctx.fillRect(...playerPos, 5, 5);
    // ctx.moveTo(0, 0);
    // ctx.lineTo(...scale(facing, 100));
    // ctx.stroke();
    let toDraw = [];
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (pointInPolygon(o.pos, f)) {
        toDraw.push([affineMul(o.pos, fromPlayerSpace), o]);
      }
    }
    toDraw
      .sort((a, b) => b[0][0] - a[0][0])
      .forEach(([sp, o]) => {
        const x = sp[1];
        const z = sp[0];
        const d = Math.hypot(x, z);
        const shape = o.model.map((p) => {
          const sp = add(mul(p, facing), [x, z]);
          return toScreenSpace([sp[0], sp[1], p[2]]);
        });
        const a =
          z < 10
            ? proj(focalNear, -10, 0, 1, z)
            : proj(focal * 0.75, focal, 1, 0, z);
        ctx.strokeStyle = `rgba(128, 128, 128, ${a})`;
        if (o.fill) {
          const [r, g, b] = o.fill;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
          plot(shape, false, true);
        } else {
          plot(shape, false);
        }
      });
    ctx.restore();
    requestAnimationFrame(frame);
    avg = avg * 0.99 + (Date.now() - now) * 0.01;
    debug.innerText =
      Date.now() -
      now +
      "ms " +
      toDraw.length +
      " objs " +
      playerPos.map((n) => n | 0).join(",") +
      " tg " +
      playerTurn.toFixed(2) +
      " " +
      playerVel.toFixed(2);
  };

  const plot = (pts, close = false, fill = false) => {
    ctx.beginPath();
    pts.forEach((p) => ctx.lineTo(...p));
    close && ctx.closePath();
    fill && ctx.fill();
    ctx.stroke();
  };

  frame();
};

document.body.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") {
    gas = 0.075;
  }
  if (e.key === "ArrowDown") {
    gas = -0.1;
  }
  if (e.key === "ArrowRight") {
    playerWheel = 0.01;
  }
  if (e.key === "ArrowLeft") {
    playerWheel = -0.01;
  }
});
document.body.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    gas = 0;
  }
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    playerWheel = 0;
  }
});

start();
