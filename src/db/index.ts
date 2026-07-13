import { openDB, type DBSchema, type IDBPDatabase, type StoreNames } from 'idb';
import type { Budget, Category, Ledger, RecurringRule, Transaction } from '../types';

interface MintifyDB extends DBSchema {
  ledgers: {
    key: string;
    value: Ledger;
  };
  categories: {
    key: string;
    value: Category;
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: {
      'by-ledger': string;
      'by-occurred': number;
    };
  };
  budgets: {
    key: string;
    value: Budget;
    indexes: {
      'by-ledger': string;
    };
  };
  recurringRules: {
    key: string;
    value: RecurringRule;
    indexes: {
      'by-ledger': string;
    };
  };
}

const DB_NAME = 'mintify-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MintifyDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<MintifyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('ledgers', { keyPath: 'id' });
        db.createObjectStore('categories', { keyPath: 'id' });

        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('by-ledger', 'ledgerId');
        txStore.createIndex('by-occurred', 'occurredAt');

        const budgetStore = db.createObjectStore('budgets', { keyPath: 'id' });
        budgetStore.createIndex('by-ledger', 'ledgerId');

        const ruleStore = db.createObjectStore('recurringRules', { keyPath: 'id' });
        ruleStore.createIndex('by-ledger', 'ledgerId');
      },
    });
  }
  return dbPromise;
};

// Generic CRUD helpers
export async function getAll<T>(storeName: StoreNames<MintifyDB>): Promise<T[]> {
  const db = await getDB();
  return db.getAll(storeName) as Promise<T[]>;
}

export async function getById<T>(storeName: StoreNames<MintifyDB>, id: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(storeName, id) as Promise<T | undefined>;
}

export async function putItem<S extends StoreNames<MintifyDB>>(storeName: S, item: MintifyDB[S]['value']): Promise<void> {
  const db = await getDB();
  await db.put(storeName, item);
}

export async function deleteItem(storeName: StoreNames<MintifyDB>, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, id);
}

export async function clearStore(storeName: StoreNames<MintifyDB>): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}

// Specific helpers
export async function getTransactionsByLedger(ledgerId: string): Promise<Transaction[]> {
  const db = await getDB();
  const index = db.transaction('transactions').store.index('by-ledger');
  return index.getAll(ledgerId);
}

export async function getBudgetsByLedger(ledgerId: string): Promise<Budget[]> {
  const db = await getDB();
  const index = db.transaction('budgets').store.index('by-ledger');
  return index.getAll(ledgerId);
}

export async function getRecurringRulesByLedger(ledgerId: string): Promise<RecurringRule[]> {
  const db = await getDB();
  const index = db.transaction('recurringRules').store.index('by-ledger');
  return index.getAll(ledgerId);
}

export async function getCategoriesByLedger(ledgerId: string): Promise<Category[]> {
  const all = await getAll<Category>('categories');
  return all.filter((c) => c.ledgerId === ledgerId).sort((a, b) => a.sortOrder - b.sortOrder);
}
