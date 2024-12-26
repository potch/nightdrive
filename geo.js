// value mapping
export const ilerp = (a, b, n) => (n - a) / (b - a);
export const lerp = (a, b, t) => a + (b - a) * t;
export const proj = (a, b, c, d, n) => ((n - a) / (b - a)) * (d - c) + c;

// 2d vectors
export const vec = (x, y) => [x, y];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const scale = ([a, b], s, t = s) => [a * s, b * t];
export const mul = (a, b) => [
  a[0] * b[0] - a[1] * b[1],
  a[0] * b[1] + a[1] * b[0],
];
export const norm = (p) => scale(p, 1 / Math.hypot(...p));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

export const plerp = ([a, b], [c, d], t) => [lerp(a, c, t), lerp(b, d, t)];

export const affine = ([rx, ry], [tx, ty]) => [rx, -ry, tx, ry, rx, ty];
export const affineMul = ([x, y], [a, b, c, d, e, f]) => [
  a * x + b * y + c,
  d * x + e * y + f,
];
export const invertAffine = ([a, b, c, d, e, f]) => {
  const det = a * e - b * d;

  if (det === 0) {
    throw new Error("Matrix is singular and cannot be inverted");
  }

  return [
    e / det,
    -b / det,
    (b * f - c * e) / det,
    -d / det,
    a / det,
    (c * d - a * f) / det,
  ];
};

// 3d vectors
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm3 = (a) => {
  const len = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / len, a[1] / len, a[2] / len];
};
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// data structures
const BEZIER_LUT_RES = 128;
export class Bezier {
  constructor(p0, p1, p2, p3) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
  }

  pos(t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const w0 = -t3 + 3 * t2 - 3 * t + 1;
    const w1 = 3 * t3 - 6 * t2 + 3 * t;
    const w2 = -3 * t3 + 3 * t2;
    const w3 = t3;
    return add(
      add(scale(this.p0, w0), scale(this.p1, w1)),
      add(scale(this.p2, w2), scale(this.p3, w3))
    );
  }

  derivative(t) {
    const t2 = t * t;
    const w0 = -3 * t2 + 6 * t - 3;
    const w1 = 9 * t2 - 12 * t + 3;
    const w2 = -9 * t2 + 6 * t;
    const w3 = 3 * t2;
    return add(
      add(scale(this.p0, w0), scale(this.p1, w1)),
      add(scale(this.p2, w2), scale(this.p3, w3))
    );
  }

  get LUT() {
    if (this._LUT) return this._LUT;
    const lut = [];
    let len = 0;
    let last = this.pos(0);
    let pos;
    for (let i = 0; i <= BEZIER_LUT_RES; i++) {
      const t = i / BEZIER_LUT_RES;
      pos = this.pos(t);
      len += Math.hypot(...sub(pos, last));
      lut.push(len);
      last = pos;
    }
    this._LUT = lut;
    return lut;
  }

  get length() {
    return this.LUT.at(-1);
  }

  evenT(t) {
    const distance = t * this.length;
    const LUT = this.LUT;
    for (let i = 0; i < LUT.length; i++) {
      if (distance >= LUT[i] && distance < LUT[i + 1]) {
        return proj(
          LUT[i],
          LUT[i + 1],
          i / BEZIER_LUT_RES,
          (i + 1) / BEZIER_LUT_RES,
          distance
        );
      }
    }
    return 1;
  }

  evenPos(t) {
    return this.pos(this.evenT(t));
  }
}

export const generatePath = (bez, segments, width) => {
  let step = 1 / segments;
  let step2 = step / 2;
  const seg = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments + step2;

    const centerT = bez.evenT(t);
    const center = bez.pos(centerT);
    const centerVel = bez.derivative(centerT);
    const centerNorm = norm(centerVel);
    const centerSpan = scale(centerNorm, width);
    const centerLeft = add(center, mul(centerSpan, [0, -1]));
    const centerRight = add(center, mul(centerSpan, [0, 1]));

    const backT = bez.evenT(t - step2);
    const back = bez.pos(backT);
    const backVel = bez.derivative(backT);
    const backSpan = scale(norm(backVel), width);
    const backLeft = add(back, mul(backSpan, [0, -1]));
    const backRight = add(back, mul(backSpan, [0, 1]));

    const frontT = bez.evenT(t + step2);
    const front = bez.pos(frontT);
    const frontVel = bez.derivative(frontT);
    const frontSpan = scale(norm(frontVel), width);
    const frontLeft = add(front, mul(frontSpan, [0, -1]));
    const frontRight = add(front, mul(frontSpan, [0, 1]));

    seg.push({
      back,
      backLeft,
      backRight,
      center,
      centerNorm,
      centerLeft,
      centerRight,
      front,
      frontLeft,
      frontRight,
      poly: [
        sub(backLeft, center),
        sub(backRight, center),
        sub(frontRight, center),
        sub(frontLeft, center),
      ],
    });
  }
  return seg;
};

export class Rect {
  constructor(tl, wh) {
    Object.assign(this, {
      tl,
      wh,
      br: add(tl, wh),
    });
  }

  contains([px, py]) {
    const [x, y] = this.tl;
    const [x2, y2] = this.br;
    return x <= px && px <= x2 && y <= py && py <= y2;
  }

  intersects(r) {
    const [x, y] = this.tl;
    const [x2, y2] = this.br;
    const [rx, ry] = r.tl;
    const [rx2, ry2] = r.br;
    return !(x > rx2 || x2 < rx || y > ry2 || y2 < ry);
  }

  subdivide(xslices = 2, yslices = xslices) {
    const slices = [];
    for (let y = 0; y < yslices; y++) {
      for (let x = 0; x < xslices; x++) {
        slices.push(
          new Rect(
            add(this.tl, scale(this.wh, x / xslices, y / yslices)),
            scale(this.wh, 1 / xslices, 1 / yslices)
          )
        );
      }
    }
    return slices;
  }

  poly() {
    const [x, y] = this.tl;
    const [x2, y2] = this.br;
    return [
      [x, y],
      [x2, y],
      [x2, y2],
      [x, y2],
    ];
  }

  random() {
    const [x, y] = this.tl;
    const [w, h] = this.wh;
    return [Math.random() * w + x, Math.random() * h + y];
  }

  static tlbr(tl, br) {
    return new Rect(tl, sub(br, tl));
  }
}

export class Quadtree {
  constructor(bounds, { capacity = 1, maxDepth = 32, getPos = (o) => o } = {}) {
    Object.assign(this, {
      bounds,
      capacity,
      maxDepth,
      regions: null,
      members: [],
      divided: false,
      total: 0,
      getPos,
    });
  }

  insert(o, depth = 0) {
    const p = this.getPos(o);
    if (!this.bounds.contains(p)) {
      return false;
    }
    const members = this.members;
    if (!this.divided) {
      if (members.length < this.capacity || depth >= this.maxDepth) {
        members.push(o);
        this.total++;
        return true;
      }
      this.regions = this.bounds
        .subdivide(2)
        .map(
          (r) =>
            new Quadtree(r, { capacity: this.capacity, getPos: this.getPos })
        );
      this.divided = true;
      // reinsert existing members into the new subdivisions
      for (let i = 0; i < members.length; i++) {
        this.insert(members[i], depth + 1);
      }
      this.members = [];
    }
    for (let i = 0; i < this.regions.length; i++) {
      if (this.regions[i].insert(o, depth + 1)) {
        this.total++;
        return true;
      }
    }
    return false;
  }

  query(r, points = []) {
    if (!this.bounds.intersects(r)) return points;
    if (this.divided) {
      for (let i = 0; i < this.regions.length; i++) {
        this.regions[i].query(r, points);
      }
    }
    for (let i = 0; i < this.members.length; i++) {
      const o = this.members[i];
      if (r.contains(this.getPos(o))) {
        points.push(o);
      }
    }
    return points;
  }
}

export const pointInPolygon = (p, polygon) => {
  const x = p[0];
  const y = p[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    // const intersect =
    //   yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    const intersect =
      yi >= y !== yj >= y && x <= ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const bbox = (polygon) => {
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    min[0] = Math.min(min[0], p[0]);
    max[0] = Math.max(max[0], p[0]);
    min[1] = Math.min(min[1], p[1]);
    max[1] = Math.max(max[1], p[1]);
  }
  return [min, max];
};

console.log("dot", dot(norm([1, 1]), [1, 0]));
