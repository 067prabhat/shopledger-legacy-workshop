const assert = require('node:assert/strict');
const test = require('node:test');
const inventory = require('../lib/inventory');
const orders = require('../lib/orders');

test('checkout blocks sales that would consume stock held for wholesale', () => {
  const products = [{ id: 1, name: 'Chilli powder', stock: 4, reserved: 3 }];

  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }]).ok, false);
  assert.equal(inventory.check(products, [{ id: 1, qty: 5 }]).ok, false);
});

test('checkout permits the final sellable unit with or without wholesale holds', () => {
  const products = [
    { id: 1, name: 'Chilli powder', stock: 4, reserved: 3 },
    { id: 2, name: 'Ghee', stock: 1 }
  ];
  const items = [{ id: 1, qty: 1 }, { id: 2, qty: 1 }];

  assert.deepEqual(inventory.check(products, items), { ok: true });
  inventory.reserve(products, items);
  assert.deepEqual(products.map(inventory.getSellableStock), [0, 0]);
  assert.equal(products[0].reserved, 3);
});

test('checkout checks the combined quantity of repeated lines for the same product', () => {
  const products = [{ id: 1, name: 'Ghee', stock: 5, reserved: 2 }];
  const items = [{ id: 1, qty: 2 }, { id: '1', qty: 2 }];

  assert.equal(inventory.check(products, items).ok, false);
  assert.equal(inventory.check(products, [{ id: 1, qty: 2 }, { id: '1', qty: 1 }]).ok, true);
  assert.equal(products[0].stock, 5);
});

test('cancelling a pending Khata order restores each physical quantity and reverses the debit only once', () => {
  const db = {
    products: [
      { id: 1, stock: 4, reserved: 3 },
      { id: 2, stock: 8, reserved: 1 }
    ],
    customers: [{ id: 5, openingBalance: 100, totalBilled: 300, totalSettled: 50 }],
    orders: [{
      id: 1007,
      status: 'pending',
      customerId: 5,
      paymentMode: 'khata',
      total: 200,
      items: [{ id: 1, qty: 1 }, { id: 1, qty: 1 }, { id: 2, qty: 2 }]
    }]
  };

  assert.equal(orders.cancel(db, '1007').ok, true);
  assert.equal(db.orders[0].status, 'cancelled');
  assert.deepEqual(db.products.map(({ stock, reserved }) => [stock, reserved]), [[6, 3], [10, 1]]);
  assert.deepEqual(db.products.map(inventory.getSellableStock), [3, 9]);
  assert.equal(db.customers[0].balance, 150);
  const after = structuredClone(db);

  assert.equal(orders.cancel(db, '1007').ok, false);
  assert.deepEqual(db, after);
});
