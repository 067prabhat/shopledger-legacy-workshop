const assert = require('node:assert/strict');
const test = require('node:test');
const ledger = require('../lib/ledger');

function account(fields = {}) {
  return {
    customers: [{ id: 1, name: 'Test customer', ...fields }],
    settlements: [],
    nextSettlementId: 501
  };
}

test('a numeric Khata payment lowers the balance and records its details', () => {
  const db = account({ openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200 });
  const result = ledger.recordSettlement(db, 1, 500, 'cash', 'February payment');

  assert.equal(result.ok, true);
  assert.equal(result.customer.balance, 732.01);
  assert.deepEqual(db.settlements.map(({ id, amount, mode, note }) => ({ id, amount, mode, note })), [
    { id: 501, amount: 500, mode: 'cash', note: 'February payment' }
  ]);
});

test('a payment entered as text adds to the existing Khata settlement total', () => {
  const db = account({ openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200 });
  const result = ledger.recordSettlement(db, '1', '500');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
  assert.equal(ledger.listCustomers(db)[0].balance, 732.01);
});

test('the first settlement and repeated fractional payments keep numeric balances', () => {
  const db = account({ openingBalance: '10.50', totalBilled: '1.00' });
  for (const amount of ['0.10', 0.2, '0.03']) {
    assert.equal(ledger.recordSettlement(db, 1, amount).ok, true);
  }

  assert.equal(db.customers[0].totalSettled, 0.33);
  assert.equal(db.customers[0].balance, 11.17);
  assert.equal(ledger.listCustomers(db)[0].balance, 11.17);
  assert.deepEqual(db.settlements.map(({ amount }) => amount), [0.03, 0.2, 0.1]);
});

test('invalid or unrepresentable settlement amounts leave the account and journal untouched', () => {
  for (const amount of ['letters', '', ' ', 0, -1, '0.001', 1.234, Infinity, 'Infinity', NaN, true, [500], 1e20]) {
    const db = account({ openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200 });
    const before = structuredClone(db);

    assert.equal(ledger.recordSettlement(db, 1, amount).ok, false, String(amount));
    assert.deepEqual(db, before, String(amount));
  }
});
