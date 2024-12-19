export const bstNode = (value, data) => ({
  value,
  data,
  lt: null,
  gt: null,
});

export const bstInsert = (tree, value, data) => {
  let cursor = tree;
  do {
    if (value <= cursor.value) {
      if (cursor.lt) {
        cursor = cursor.lt;
      } else {
        cursor.lt = bstNode(value, data);
        break;
      }
    } else {
      if (cursor.gt) {
        cursor = cursor.gt;
      } else {
        cursor.gt = bstNode(value, data);
        break;
      }
    }
  } while (true);
  return tree;
};

export const bstWalk = (tree, fn) => {
  const stack = [];
  let cursor = tree;

  while (cursor || stack.length > 0) {
    if (cursor) {
      stack.push(cursor);
      cursor = cursor.lt;
    } else {
      cursor = stack.pop();
      fn(cursor);
      cursor = cursor.gt;
    }
  }
};

export const bstToArray = (tree, array = []) => {
  const stack = [];
  let cursor = tree;

  while (cursor || stack.length > 0) {
    if (cursor) {
      stack.push(cursor);
      cursor = cursor.lt;
    } else {
      cursor = stack.pop();
      array.push(cursor.data);
      cursor = cursor.gt;
    }
  }

  return array;
};
