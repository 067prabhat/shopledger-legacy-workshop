var dates = require('./dates');

function toPaise(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function balanceInPaise(customer) {
  return toPaise(customer.openingBalance) + toPaise(customer.totalBilled) - toPaise(customer.totalSettled);
}

function findCustomer(db, id) {
  if (!id || !db.customers) return null;
  for (var i = 0; i < db.customers.length; i++) {
    if (db.customers[i].id == id) return db.customers[i];
  }
  return null;
}

exports.findCustomer = findCustomer;

exports.listCustomers = function (db) {
  return (db.customers || []).map(function (c) {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      type: c.type || 'Retail',
      gstin: c.gstin || '',
      creditLimit: c.creditLimit || 5000,
      openingBalance: c.openingBalance || 0,
      totalBilled: c.totalBilled || 0,
      totalSettled: c.totalSettled || 0,
      balance: balanceInPaise(c) / 100
    };
  });
};

// Called when an order is placed with paymentMode === 'khata'
exports.chargeOrderToKhata = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer account not found for Khata billing' };

  var orderPaise = toPaise(orderTotal);
  var projected = (balanceInPaise(c) + orderPaise) / 100;

  if (c.creditLimit && projected > c.creditLimit) {
    return {
      ok: false,
      error: 'Khata credit limit exceeded for ' + c.name + ' (Limit: ₹' + c.creditLimit + ', Projected: ₹' + projected.toFixed(2) + ')'
    };
  }

  c.totalBilled = (toPaise(c.totalBilled) + orderPaise) / 100;
  c.balance = balanceInPaise(c) / 100;
  return { ok: true, customer: c };
};

exports.reverseOrderDebit = function (db, customerId, orderTotal) {
  var c = findCustomer(db, customerId);
  if (!c) return;
  c.totalBilled = Math.max(0, toPaise(c.totalBilled) - toPaise(orderTotal)) / 100;
  c.balance = balanceInPaise(c) / 100;
};

// Records a customer payment settling their outstanding Khata balance
exports.recordSettlement = function (db, customerId, amount, mode, note) {
  var c = findCustomer(db, customerId);
  if (!c) return { ok: false, error: 'Customer not found' };

  var value = amount;
  if (typeof amount === 'string' && /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(amount.trim())) {
    value = Number(amount);
  }
  var amountPaise = typeof value === 'number' ? toPaise(value) : NaN;
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise / 100 !== value) {
    return { ok: false, error: 'Settlement amount must be positive with up to two decimal places' };
  }

  var settledPaise = toPaise(c.totalSettled) + amountPaise;
  if (!Number.isSafeInteger(settledPaise)) {
    return { ok: false, error: 'Settlement total is outside the supported range' };
  }

  c.totalSettled = settledPaise / 100;
  c.balance = balanceInPaise(c) / 100;

  var entry = {
    id: db.nextSettlementId++,
    customerId: c.id,
    customerName: c.name,
    date: dates.today(),
    amount: amountPaise / 100,
    mode: mode || 'upi',
    note: note || 'Khata settlement'
  };

  if (!db.settlements) db.settlements = [];
  db.settlements.unshift(entry);

  return {
    ok: true,
    settlement: entry,
    customer: c
  };
};
