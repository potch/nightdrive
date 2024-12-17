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
const focal = 768;
const focalNear = -32;
const fovW = 45;
const fovH = fovW / ASPECT;
const camHeight = 12;
const overscan = 1.1;
const toScreenSpace = ([x, y, z]) => {
  const scale = perspective / (perspective + y - focalNear);
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

    // ctx.fillStyle = "#000";
    // ctx.strokeStyle = "#888";

    // ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height);

    // ctx.fillStyle = "#c0c0c0";
    // const moon = proj(
    //   0,
    //   360,
    //   WIDTH * 2,
    //   -WIDTH,
    //   ((playerAngle % 360) + 360) % 360
    // );
    // ctx.beginPath();
    // ctx.arc(moon, HEIGHT * 0.4, WIDTH / 20, 0, 6.28);
    // ctx.closePath();
    // ctx.fill();

    // ctx.save();
    // ctx.translate(WIDTH_2, HEIGHT_2);

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
        if (d > focal) return;

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
          proj(fovW * 0.5, fovW * 0.6, 1, 0, Math.abs(x) - 0.4 * z)
        );
        if (fill)
          fill = [
            fill[0] * (1 + 2 * headlight),
            fill[1] * (1 + 1.8 * headlight),
            fill[2] * (1 + 1.5 * headlight),
          ];

        // ctx.strokeStyle = `rgba(128, 128, 128)`;
        if (fill) {
          const [r, g, b] = fill;
          // ctx.fillStyle = "rgb(" + r * a |0+ "," + g * a + "," + b * a + ")";
          plot(id, shape, [(r * a) | 0, (g * a) | 0, (b * a) | 0]);
        }
      });
    // ctx.restore();
    // console.log(id);
    ctx.putImageData(id, 0, 0);
    // throw "done";
    // setTimeout(frame, 16);
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

  const plot = (id, pts, fill) => {
    const box = bbox(pts);
    if (box[1][0] < -WIDTH_2) return;
    if (box[1][1] < -HEIGHT_2) return;
    if (box[0][0] > WIDTH_2) return;
    if (box[0][1] > HEIGHT_2) return;

    for (let y = box[0][1] | 0; y <= box[1][1] + 1; y += 1) {
      for (let x = box[0][0] | 0; x <= box[1][0] + 1; x += 1) {
        const px = (x + WIDTH_2) | 0;
        const py = (y + HEIGHT_2) | 0;
        if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) continue;
        if (pointInPolygon([x, y], pts)) {
          const idx = (py * WIDTH + px) * 4;
          id.data[idx] = fill[0];
          id.data[idx + 1] = fill[1];
          id.data[idx + 2] = fill[2];
          id.data[idx + 3] = 255;
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
