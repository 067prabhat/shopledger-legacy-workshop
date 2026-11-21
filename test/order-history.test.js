const assert = require('node:assert/strict');
const test = require('node:test');
const orders = require('../lib/orders');

function history() {
  return {
    orders: [
      { id: 1001, date: '28/12/2021', customer: 'Corner shop', status: 'completed' },
      { id: 1002, date: '01/01/2022', customer: 'Corner shop', status: 'completed' },
      { id: 1003, date: '31/01/2022', customer: 'Corner shop', status: 'completed' },
      { id: 1004, date: '30/01/2022', customer: 'Other shop', status: 'completed' },
      { id: 1005, date: '2022-01-31', customer: 'Corner shop', status: 'pending' },
      { id: 1006, date: '01/02/2022', customer: 'Corner shop', status: 'completed' },
      { id: 1009, date: '04/03/2022', customer: 'Other shop', status: 'completed' },
      { id: 1007, date: '2022-03-04', customer: 'Other shop', status: 'completed' },
      { id: 1008, date: '15/03/2022', customer: 'Corner shop', status: 'completed' }
    ]
  };
}

function ids(db, filters) {
  return orders.list(db, filters).map(({ id }) => id);
}

test('order history combines status and customer search', () => {
  assert.deepEqual(ids(history(), { status: 'pending', search: 'CORNER' }), [1005]);
});

test('order history sorts across months and years, with higher IDs first on the same day', () => {
  const db = history();

  assert.deepEqual(ids(db), [1008, 1009, 1007, 1006, 1005, 1003, 1004, 1002, 1001]);
  assert.deepEqual(db.orders.map(({ id }) => id), [1001, 1002, 1003, 1004, 1005, 1006, 1009, 1007, 1008]);
});

test('order history includes both January bounds and excludes neighbouring months', () => {
  assert.deepEqual(ids(history(), { from: '2022-01-01', to: '2022-01-31' }), [1005, 1003, 1004, 1002]);
  assert.deepEqual(ids(history(), { from: '28/12/2021', to: '2022-01-01' }), [1002, 1001]);
});

test('inclusive date bounds compose with search, status, and one-sided ranges', () => {
  assert.deepEqual(ids(history(), {
    from: '2022-01-01', to: '2022-01-31', search: 'corner', status: 'completed'
  }), [1003, 1002]);
  assert.deepEqual(ids(history(), { from: '2022-03-04' }), [1008, 1009, 1007]);
  assert.deepEqual(ids(history(), { to: '2022-01-01' }), [1002, 1001]);
});
