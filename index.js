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
  scale3,
  mul,
  lerp,
  norm,
  dot3,
  norm3,
  sub3,
  add3,
  cross3,
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

const flakes = 10000;
const snow = [];
window.snow = snow;

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

    // init screen buffer
    id.data.fill(0);

    // const moonX = proj(
    //   0,
    //   360,
    //   WIDTH * 3,
    //   -WIDTH * 2,
    //   ((playerAngle % 360) + 360) % 360
    // );
    // const moonPoly = moon.map((p) => add(p, [moonX, -HEIGHT * 0.15]));

    // plot(id, moonPoly, [
    //   [160, 160, 150],
    //   [160, 160, 150],
    //   [160, 160, 150],
    //   [160, 160, 150].map((n) => n / 2),
    // ]);

    // particles
    let userRect = Rect.tlbr(
      add(playerPos, [-focal, -focal]),
      add(playerPos, [focal, focal])
    );
    while (snow.length < flakes) {
      snow.push({
        pos: userRect.random(),
        start: t,
        startY: Math.random() * 100 + 150,
        life: Math.random() * 1 + 1,
        flake: true,
      });
    }

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
        } else {
          console.log(o);
          throw "missing model";
        }
        const drawP = affineMul(
          add(o.pos, [center[0], center[1]]),
          fromPlayerSpace
        );

        const p = affineMul(o.pos, fromPlayerSpace);
        if (toDraw) {
          bstInsert(toDraw, drawP[0], { pos: p, obj: o });
        } else {
          toDraw = bstNode(drawP[0], { pos: p, obj: o });
        }
      }
    }

    snow.forEach((flake, i) => {
      const ft = t - flake.start;
      if (ft > flake.life) {
        snow.splice(i, 1);
      } else {
        if (pointInPolygon(flake.pos, f)) {
          flake.currentY = lerp(flake.startY, 0, ft / flake.life);
          const p = affineMul(flake.pos, fromPlayerSpace);
          flake.pos3 = [p[0], flake.currentY, p[1]];
          if (toDraw) {
            bstInsert(toDraw, p[0], { pos: p, obj: flake });
          } else {
            toDraw = bstNode(p[0], { pos: p, obj: flake });
          }
        }
      }
    });

    toDraw = bstToArray(toDraw);

    // const playerZ = worldZ(playerPos);

    for (let i = 0; i < toDraw.length; i++) {
      const td = toDraw[i];
      const sp = td.pos;
      const o = td.obj;
      const x = sp[1];
      const z = sp[0];
      const d = Math.hypot(x, z);
      if (d > focal) continue;

      if (o.flake) {
        const sp = toScreenSpace([x, o.currentY, z]);

        // const ray = sub([0, camHeight, 0])

        let a = proj(focalNear, focal, 1, 0, d);

        let fill = [192, 192, 192];
        const headlight = clamp(
          0,
          1,
          proj(fovW * 0.2, fovW * 0.4, 1, 0, Math.abs(x) - 0.3 * z)
        );

        const sx = Math.round(sp[0] + WIDTH_2);
        if (sx < 0 || sx > WIDTH - 1) continue;
        const sy = Math.round(sp[1] + HEIGHT_2);
        if (sy < 0 || sy > HEIGHT - 1) continue;

        const pidx = (sy * WIDTH + sx) * 4;

        if (id.data[pidx + 3]) continue;

        id.data[pidx] = (fill[0] * a) | 0;
        id.data[pidx + 1] = (fill[1] * a) | 0;
        id.data[pidx + 2] = (fill[2] * a) | 0;
        id.data[pidx + 3] = 255;
      }
      if (o.model) {
        const cd = Math.hypot(x + o.center[1], z + o.center[0]);
        let top = null;
        let bottom = null;
        let left = null;
        let right = null;
        const shape = o.model.map((p, i) => {
          const relP = affineMul(add(o.pos, [p[0], p[2]]), fromPlayerSpace);

          const worldPoint = [relP[1], p[1], relP[0]];
          const ray = sub3(worldPoint, [0, camHeight, 0]);
          const distance = Math.hypot(...ray);

          const s = {
            pos: worldPoint,
            ray,
            screenPos: toScreenSpace(worldPoint),
            distance,
          };

          if (!left || s[0] < left[0]) {
            left = s;
          }
          if (!top || s[1] < top[1]) {
            top = s;
          }
          if (!right || s[0] > right[0]) {
            right = s;
          }
          if (!bottom || s[1] > bottom[1]) {
            left = s;
          }

          return s;
        });

        // debugger;
        const norm = norm3(
          cross3(
            sub3(shape[0].pos, shape[1].pos),
            sub3(shape[2].pos, shape[1].pos)
          )
        );
        const dot = dot3(norm, norm3(shape[0].ray));

        o.shape = shape;
        o.norm = norm;
        o.dot = dot;

        let a =
          clamp(
            0,
            1,
            z < 10
              ? proj(focalNear, -10, 0, 1, cd)
              : proj(focal * 0.5, focal, 1, 0, cd)
          ) *
          (0.5 + 0.5 * Math.abs(dot));

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
          plot(
            id,
            shape.map((s) => s.screenPos),
            fill
          );
        }
      }
    }

    ctx.putImageData(id, 0, 0);

    // DIAGNOSTICS

    ctx.save();
    ctx.translate(WIDTH_2, HEIGHT_2);
    const showMesh = false;
    if (showMesh) {
      ctx.strokeStyle = "#fff2";
      toDraw.forEach((td) => {
        ctx.beginPath();
        td.obj.shape?.forEach((p) => ctx.lineTo(...p.screenPos));
        ctx.closePath();
        ctx.stroke();
      });
    }

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
      playerVel.toFixed(2);
  };

  const plotVec3 = (v, o = [0, 0, 0]) => {
    const [x1, y1] = toScreenSpace(o);
    const [x2, y2] = toScreenSpace(add3(o, v));
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
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
      const yt = (y - top) / (bottom - top);
      if (py < 0 || py >= HEIGHT) continue;
      for (let x = left; x <= right; x += 1) {
        const px = x + WIDTH_2;
        const idx = py * WIDTH + px;
        const pidx = idx * 4;
        if (px < 0 || px >= WIDTH) continue;
        if (data[pidx + 3]) continue;
        if (pointInPolygon([x, y], pts)) {
          const dx = 100 - Math.abs(x);
          const xt = (x - left) / (right - left);
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
