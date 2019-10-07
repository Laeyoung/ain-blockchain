const TransactionPool = require('../db/transaction-pool');
const Transaction = require('../db/transaction');
const Blockchain = require('../blockchain/');
const {ForgedBlock} = require('../blockchain/block');
const DB = require('../db');
const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const shuffleSeed = require('shuffle-seed');

function getTransaction(db, operation) {
  const nonce = db.nonce;
  db.nonce++;
  return Transaction.newTransaction(nonce, db.keyPair.priv, operation);
}

describe('TransactionPool', () => {
  let tp; let db; let bc; let transaction;

  beforeEach(() => {
    tp = new TransactionPool();
    bc = new Blockchain('test-blockchain');
    db = new DB(bc);

    transaction = getTransaction(db, {type: 'SET_VALUE', ref: 'REF', value: 'VALUE'});
    tp.addTransaction(transaction);
  });

  it('adds a transaction to the pool', () => {
    expect(tp.transactions[db.publicKey].find((t) => t.hash === transaction.hash)).to.equal(transaction);
  });


  describe('sorting transactions by nonces', () => {
    let db2; let db3; let db4;

    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        t = getTransaction(db, {
          type: 'SET_VALUE',
          ref: 'REF',
          value: 'VALUE',
        });
        tp.addTransaction(t);
      }
      tp.transactions[db.publicKey] = shuffleSeed.shuffle(tp.transactions[db.publicKey]);

      db2 = new DB(bc);
      db3 = new DB(bc);
      db4 = new DB(bc);
      const dbs = [db2, db3, db4];
      for (let j = 0; j < dbs.length; j++) {
        for (let i = 0; i < 11; i++) {
          t = getTransaction(dbs[j], {
            type: 'SET_VALUE',
            ref: 'REF',
            value: 'VALUE',
          }, true);
          tp.addTransaction(t);
        }
        tp.transactions[dbs[j].publicKey] = shuffleSeed.shuffle(tp.transactions[dbs[j].publicKey]);
      }

      // Shuffle transactions and see if the transaction-pool can re-sort them according to them according to their proper ordering
    });

    it('transactions are correctly numbered', () => {
      const sortedNonces1 = tp.validTransactions().filter((transaction) => {
        if (transaction.address === db.publicKey) return transaction;
      }).map((transaction) => {
        return transaction.nonce;
      });
      const sortedNonces2 = tp.validTransactions().filter((transaction) => {
        if (transaction.address === db2.publicKey) return transaction;
      }).map((transaction) => {
        return transaction.nonce;
      });
      const sortedNonces3 = tp.validTransactions().filter((transaction) => {
        if (transaction.address === db3.publicKey) return transaction;
      }).map((transaction) => {
        return transaction.nonce;
      });
      const sortedNonces4 = tp.validTransactions().filter((transaction) => {
        if (transaction.address === db4.publicKey) return transaction;
      }).map((transaction) => {
        return transaction.nonce;
      });
      assert.deepEqual(sortedNonces1, [...Array(11).keys()]);
      assert.deepEqual(sortedNonces2, [...Array(11).keys()]);
      assert.deepEqual(sortedNonces3, [...Array(11).keys()]);
      assert.deepEqual(sortedNonces4, [...Array(11).keys()]);
    });

    it('removes transactions included in block', () => {
      const height = 1;
      const block = ForgedBlock.forgeBlock(tp.validTransactions(), db, height, ForgedBlock.genesis());
      const newTransactions = {};
      newTransactions[db.publicKey] = [];
      for (let i = 0; i < 10; i++) {
        newTransactions[db.publicKey].push(getTransaction(db, {
          type: 'SET_VALUE',
          ref: 'REF',
          value: 'VALUE',
        }));
        tp.addTransaction(newTransactions[db.publicKey][i]);
      }
      tp.removeCommitedTransactions(block);
      assert.deepEqual(newTransactions, tp.transactions);
    });
  });
});
