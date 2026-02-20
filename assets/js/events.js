// assets/js/events.js
export const EVT_DATA_CHANGED = "data:changed";

export const Events = {
  _m: new Map(),
  on(name, fn) {
    if (!this._m.has(name)) this._m.set(name, new Set());
    this._m.get(name).add(fn);
  },
  off(name, fn) {
    this._m.get(name)?.delete(fn);
  },
  emit(name, payload) {
    this._m.get(name)?.forEach(fn => {
      try { fn(payload); } catch (e) { console.error(e); }
    });
  }
};
