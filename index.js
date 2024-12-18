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
import buildWorld from "./world.js";

const bounds = new Rect([-8192, -8192], [16384, 16384]);
let debug;

let playerPos = [-25, 0];
// playerPos = [0, -400];
let playerAngle = 0;
let playerTurn = 0;
let playerVel = 0;
let gas = 0;
let brake = 0;
let playerWheel = 0;
let facing = [0, -1];

const clamp = (a, b, n) => (n < a ? a : n > b ? b : n);

const WIDTH = 640;
const HEIGHT = 480;
const ASPECT = WIDTH / HEIGHT;
const WIDTH_2 = WIDTH / 2;
const HEIGHT_2 = HEIGHT / 2;
const perspective = 30;
const focal = 512;
const focalNear = 0;
const fovW = 45;
const fovH = fovW / ASPECT;
const camHeight = 12;
const overscan = 1.1;

let maxScale = 0;
const toScreenSpace = ([x, y, z]) => {
  if (y < -10) y = -10;
  let trueY = Math.max(focalNear + 1, y - focalNear);
  let scale = perspective / (perspective + trueY);
  if (Math.abs(scale) > Math.abs(maxScale)) {
    maxScale = scale;
  }
  if (scale > 10) {
    console.log(x, y, z, focalNear, perspective, trueY, scale);
    throw "oh no";
  }
  // if (scale < 0.001) scale = 0.001;
  return [
    proj(-fovW, fovW, -WIDTH * overscan, WIDTH * overscan, x * scale),
    proj(
      -fovH,
      fovH,
      HEIGHT * overscan,
      -HEIGHT * overscan,
      (z - camHeight) * scale
    ),
  ];
};

const frust = [
  [focalNear, -fovW],
  [focalNear, fovW],
  [focal, fovW / (perspective / (perspective + focal - focalNear)) / 2],
  [focal, -fovW / (perspective / (perspective + focal - focalNear)) / 2],
];

const highbeams = [
  [-25, 0],
  [-300, focal],
  [300, focal],
  [25, 0],
];

const lowbeams = [
  [-50, 0],
  [-350, focal],
  [350, focal],
  [50, 0],
];

const start = async () => {
  const canvas = document.createElement("canvas");
  Object.assign(canvas, { width: WIDTH, height: HEIGHT });
  debug = document.createElement("pre");
  debug.id = "debug";
  document.body.append(canvas, debug);
  const ctx = canvas.getContext("2d");

  let stime = Date.now();
  const q = await buildWorld(bounds);
  console.log("built world in", Date.now() - stime, "ms");

  const id = new ImageData(WIDTH, HEIGHT);
  id.data.fill(0);

  let avg = 0;
  let lastFrame;

  const moon = Array(16)
    .fill(0)
    .map((_, i) => [
      50 * Math.sin((i / 16) * 6.28),
      50 * Math.cos((i / 16) * 6.28),
    ]);
  const frame = () => {
    if (!lastFrame) lastFrame = Date.now();
    const now = Date.now();
    const t = now / 1000;
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;

    // movement
    if (playerWheel) {
      playerTurn = Math.min(Math.max(-1, playerTurn + playerWheel), 1);
    } else {
      playerTurn *= 0.9;
    }
    if (gas) {
      playerVel = Math.max(-1, Math.min(playerVel + gas * dt, 2));
    } else {
      playerVel *= 0.99;
    }

    const fwd = playerVel * dt * 100;

    playerAngle += playerTurn * fwd;

    facing = [
      -Math.sin((playerAngle / 180) * Math.PI),
      Math.cos((playerAngle / 180) * Math.PI),
    ];
    playerPos = add(playerPos, scale(facing, fwd));

    // drawing
    const toPlayerSpace = affine(facing, playerPos);
    const fromPlayerSpace = invertAffine(toPlayerSpace);
    const f = frust.map((p) => affineMul(p, toPlayerSpace));

    for (let i = 0; i < id.data.length; i += 4) {
      id.data[i] = 4;
      id.data[i + 1] = 2;
      id.data[i + 2] = 16;
      id.data[i + 3] = 255;
    }

    const moonX = proj(
      0,
      360,
      WIDTH * 2,
      -WIDTH,
      ((playerAngle % 360) + 360) % 360
    );
    const moonPoly = moon.map((p) => add(p, [moonX, -HEIGHT * 0.15]));

    plot(id, moonPoly, [195, 195, 192]);

    // ctx.beginPath();
    // ctx.arc(moon, HEIGHT * 0.4, WIDTH / 20, 0, 6.28);
    // ctx.closePath();
    // ctx.fill();

    // ctx.save();
    // ctx.translate(WIDTH_2, HEIGHT_2);

    const fbox = bbox(f);

    const search = Rect.tlbr(...fbox);

    const objs = q.query(search);

    let toDraw = [];
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (pointInPolygon(o.pos, f)) {
        toDraw.push([affineMul(o.pos, fromPlayerSpace), o]);
      }
    }
    toDraw.sort((a, b) => b[0][0] - a[0][0]);
    for (let i = 0; i < toDraw.length; i++) {
      const sp = toDraw[i][0];
      const o = toDraw[i][1];
      const x = sp[1];
      const z = sp[0];
      const d = Math.hypot(x, z);
      if (d > focal) continue;

      const shape = o.model.map((p) => {
        const sp = add(mul(p, facing), [x, z]);
        return toScreenSpace([sp[0], sp[1], o.anim ? o.anim(t) : p[2]]);
      });

      let a = clamp(
        0,
        1,
        z < 10
          ? proj(focalNear, -10, 0, 1, d)
          : proj(focal * 0.5, focal, 1, 0, d)
      );

      let fill = o.fill;
      const headlight = clamp(
        0,
        1,
        proj(fovW * 0.2, fovW * 0.6, 1, 0, Math.abs(x) - 0.4 * z)
      );

      if (fill) {
        fill = [
          (fill[0] * (1 + 2 * headlight) * a) | 0,
          (fill[1] * (1 + 1.8 * headlight) * a) | 0,
          (fill[2] * (1 + 1.25 * headlight) * a) | 0,
        ];
        plot(id, shape, fill);
      }
    }

    ctx.putImageData(id, 0, 0);

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
      playerVel.toFixed(2) +
      " ms" +
      (maxScale | 0);
  };

  const plot = (id, pts, fill) => {
    const box = bbox(pts);
    const top = Math.max(-HEIGHT_2, Math.floor(box[0][1]));
    const left = Math.max(-WIDTH_2, Math.floor(box[0][0]));
    const bottom = Math.min(HEIGHT_2, Math.ceil(box[1][1]));
    const right = Math.min(WIDTH_2, Math.ceil(box[1][0]));
    const r = fill[0];
    const g = fill[1];
    const b = fill[2];
    if (right < -WIDTH_2) return;
    if (bottom < -HEIGHT_2) return;
    if (left > WIDTH_2) return;
    if (top > HEIGHT_2) return;
    const data = id.data;

    // for (let i = 0; i < pts.length; i++) {
    //   const px = Math.round(pts[i][0] + WIDTH_2);
    //   const py = Math.round(pts[i][1] + HEIGHT_2);
    //   const pidx = (py * WIDTH + px) * 4;

    //   if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) continue;

    //   data[pidx] = r;
    //   data[pidx + 1] = g;
    //   data[pidx + 2] = b;
    //   data[pidx + 3] = 255;
    // }
    // // return;

    for (let y = top; y <= bottom; y += 1) {
      const py = y + HEIGHT_2;
      if (py < 0 || py >= HEIGHT) continue;
      for (let x = left; x <= right; x += 1) {
        const px = x + WIDTH_2;
        const idx = py * WIDTH + px;
        if (px < 0 || px >= WIDTH) continue;
        if (pointInPolygon([x, y], pts)) {
          const pidx = idx * 4;
          data[pidx] = r;
          data[pidx + 1] = g;
          data[pidx + 2] = b;
          data[pidx + 3] = 255;
        }
      }
    }
  };

  frame();
};

document.body.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") {
    gas = 1;
  }
  if (e.key === "ArrowDown") {
    gas = -2;
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

start().catch((e) => console.error(e));
