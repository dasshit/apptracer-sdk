type Store = Record<string, string | null>;

const store: Store = {};

const AsyncStorage = {
  getItem: jest.fn(async (key: string) => {
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
  }),

  setItem: jest.fn(async (key: string, value: string) => {
    store[key] = value;
  }),

  removeItem: jest.fn(async (key: string) => {
    delete store[key];
  }),

  clear: jest.fn(async () => {
    for (const k of Object.keys(store)) delete store[k];
  }),
};

export default AsyncStorage;
