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
  Bezier,
  generatePath,
} from "./geo.js";
import { bstNode, bstToArray, bstInsert } from "./bstree.js";
import buildWorld from "./world.js";

const WORLD_SIZE = 16384 * 2;
const bounds = new Rect(
  [-WORLD_SIZE / 2, -WORLD_SIZE / 2],
  [WORLD_SIZE, WORLD_SIZE]
);
let debug;

let playerPos = [-25, 0];
// playerPos = [0, -400];
let playerAngle = 0;
let playerTurn = 0;
let playerVel = 0;
let gas = 0;
let playerWheel = 0;
let facing = [0, -1];

const clamp = (a, b, n) => (n < a ? a : n > b ? b : n);

const WIDTH = 640;
const HEIGHT = 400;
const ASPECT = WIDTH / HEIGHT;
const WIDTH_2 = WIDTH / 2;
const HEIGHT_2 = HEIGHT / 2;
const perspective = 30;
const focal = 1600;
const focalNear = 0;
const fovW = 45;
const fovH = fovW / ASPECT;
const camHeight = 12;
const overscan = 1.5;

let maxScale = 0;
const toScreenSpace = ([x, y, z]) => {
  if (z < -10) z = -10;
  let trueZ = Math.max(focalNear + 1, z - focalNear);
  let scale = perspective / (perspective + trueZ);
  if (Math.abs(scale) > Math.abs(maxScale)) {
    maxScale = scale;
  }
  if (scale > 10) {
    console.log(x, y, z, focalNear, perspective, trueZ, scale);
    throw "oh no";
  }
  return [
    proj(-fovW, fovW, -WIDTH * overscan, WIDTH * overscan, x * scale),
    proj(
      -fovH,
      fovH,
      HEIGHT * overscan,
      -HEIGHT * overscan,
      (y - camHeight) * scale
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

const worldZ = ([x, y]) => 25 * (Math.cos(x / 500) * Math.sin(y / 500));
const tab = (n) => n.toFixed(2).padStart(8, " ");

const start = async () => {
  const canvas = document.createElement("canvas");
  Object.assign(canvas, { width: WIDTH, height: HEIGHT });
  debug = document.createElement("pre");
  debug.id = "debug";
  document.body.append(canvas, debug);
  const ctx = canvas.getContext("2d");

  let stime = Date.now();
  const q = await buildWorld(bounds);
  console.log(q);
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
      playerVel = Math.max(-1, Math.min(playerVel + gas * dt, 4));
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

    const tiltA = 0;
    // const tiltA = Math.atan2(
    //   worldZ(sub(playerPos, facing)) - worldZ(add(playerPos, facing)),
    //   2
    // );
    const tilt = [Math.cos(tiltA), Math.sin(tiltA)];

    // playerPos = [Math.cos(t) * 100, Math.sin(t) * 100];
    // facing = mul(norm(playerPos), [-1, 0]);
    // playerPos = [-100, 0];
    // facing = [1, 0];

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
      WIDTH * 3,
      -WIDTH * 2,
      ((playerAngle % 360) + 360) % 360
    );
    const moonPoly = moon.map((p) => add(p, [moonX, -HEIGHT * 0.15]));

    plot(id, moonPoly, [160, 160, 150]);

    const fbox = bbox(f);

    const search = Rect.tlbr(...fbox);

    const objs = q.query(search);

    let toDraw = null;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (pointInPolygon(o.pos, f)) {
        let center = [0, 0];
        if (o.model) {
          if (o.center) {
            center = o.center;
          } else {
            for (let i = 0; i < o.model.length; i++) {
              center = add(center, [
                o.model[i][0] / o.model.length,
                o.model[i][2] / o.model.length,
              ]);
            }
            o.center = center;
          }
        }
        const drawP = affineMul(add(o.pos, center), fromPlayerSpace);

        const p = affineMul(o.pos, fromPlayerSpace);
        if (toDraw) {
          bstInsert(toDraw, -drawP[0], [p, o]);
        } else {
          toDraw = bstNode(-drawP[0], [p, o]);
        }
      }
    }

    toDraw = bstToArray(toDraw);

    // const playerZ = worldZ(playerPos);

    for (let i = 0; i < toDraw.length; i++) {
      const sp = toDraw[i][0];
      const o = toDraw[i][1];
      const x = sp[1];
      const z = sp[0];
      const d = Math.hypot(x, z);
      const cd = Math.hypot(x + o.center[1], z + o.center[0]);
      if (d > focal) continue;

      o.shape = o.model.map((p) => {
        const relP = affineMul(add(o.pos, [p[0], p[2]]), fromPlayerSpace);
        return toScreenSpace([relP[1], p[1], relP[0]]);
      });

      let a = clamp(
        0,
        1,
        z < 10
          ? proj(focalNear, -10, 0, 1, cd)
          : proj(focal * 0.5, focal, 1, 0, cd)
      );

      let fill = o.fill;
      const headlight = clamp(
        0,
        1,
        proj(fovW * 0.2, fovW * 0.4, 1, 0, Math.abs(x) - 0.3 * z)
      );

      if (fill) {
        fill = [
          (fill[0] * (1 + 2 * headlight) * a) | 0,
          (fill[1] * (1 + 1.8 * headlight) * a) | 0,
          (fill[2] * (1 + 1.25 * headlight) * a) | 0,
        ];
        plot(id, o.shape, fill);
      }
    }

    ctx.putImageData(id, 0, 0);

    // DIAGNOSTICS

    const showMesh = false;
    if (showMesh) {
      ctx.save();
      ctx.translate(WIDTH_2, HEIGHT_2);
      ctx.strokeStyle = "#fff2";
      toDraw.forEach(([sp, o]) => {
        ctx.beginPath();
        o.shape?.forEach((p) => ctx.lineTo(...p));
        ctx.closePath();
        ctx.stroke();
      });
    }

    // ctx.strokeStyle = "#f004";
    // ctx.beginPath();
    // frust
    //   .map((f) => toScreenSpace([f[1], 0, f[0]]))
    //   .forEach((p) => ctx.lineTo(...p));
    // ctx.closePath();
    // ctx.stroke();

    ctx.restore();

    // debug.innerText = "";
    // toDraw.forEach(([sp, o], i) => {
    //   const [z, x] = sp;
    //   ctx.fillStyle = "#f00";
    //   ctx.fillRect(...o.pos, 2, 2);
    //   ctx.fillStyle = "#00f";
    //   ctx.fillRect(...sp, 2, 2);
    //   debug.innerText += `obj ${o.id}: \t ${sp.map(tab).join(", ")}\n`;
    //   debug.innerText += `${o.model
    //     .map((p) => p.map(tab).join(", "))
    //     .join("\n")}\n`;

    //   // debug.innerText +=
    //   //   "pr \t" + model.map((p) => p.map(tab).join(", ")).join("\n") + "\n\n";
    // });
    // ctx.fillStyle = "#fff";
    // ctx.fillRect(...playerPos, 2, 2);
    // ctx.beginPath();
    // f.forEach((p) => ctx.lineTo(...p));
    // ctx.closePath();
    // ctx.stroke();
    ctx.restore();

    requestAnimationFrame(frame);
    avg = avg * 0.999 + (Date.now() - now) * 0.001;

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

    for (let y = top; y <= bottom; y += 0.25) {
      const py = (y + HEIGHT_2) | 0;
      if (py < 0 || py >= HEIGHT) continue;
      for (let x = left; x <= right; x += 1) {
        const px = x + WIDTH_2;
        const idx = py * WIDTH + px;
        if (px < 0 || px >= WIDTH) continue;
        if (pointInPolygon([x, y], pts)) {
          const dx = 100 - Math.abs(x);
          const d = (dx * dx + y * y) / WIDTH + 1;
          const l = 1 / d + 1;
          const pidx = idx * 4;
          data[pidx] = r * l;
          data[pidx + 1] = g * l;
          data[pidx + 2] = b * l;
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
