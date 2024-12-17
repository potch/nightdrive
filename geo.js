export const vec = (x, y) => [x, y];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const scale = ([a, b], s, t = s) => [a * s, b * t];
export const mul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
export const norm = (p) => scale(p, 1 / Math.hypot(...p));

export const ilerp = (a, b, n) => (n - a) / (b - a);
export const lerp = (a, b, t) => a + (b - a) * t;
export const proj = (a, b, c, d, n) => ((n - a) / (b - a)) * (d - c) + c;
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
      if (this.regions[i].insert(o, depth + 1)) return true;
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

export const pointInPolygon = ([x, y], polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
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
