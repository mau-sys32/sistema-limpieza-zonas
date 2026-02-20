const KEY = "ag_limpieza_zonas_v1";

function uid() {
  return crypto?.randomUUID?.() || String(Date.now()) + "_" + Math.random().toString(16).slice(2);
}

function nowISO() {
  return new Date().toISOString();
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function seedIfEmpty() {
  const cur = read();
  if (cur && Array.isArray(cur)) return;

  write([
    { id: uid(), nombre: "Baños PB", area: "Planta baja", frecuencia: "cada 2 horas", prioridad: "Alta", estado: "Pendiente", updatedAt: nowISO() },
    { id: uid(), nombre: "Recepción", area: "Entrada", frecuencia: "diaria", prioridad: "Media", estado: "En proceso", updatedAt: nowISO() },
    { id: uid(), nombre: "Sala Juntas", area: "Piso 2", frecuencia: "diaria", prioridad: "Baja", estado: "Completada", updatedAt: nowISO() },
  ]);
}

export const Store = {
  zonas: {
    list() {
      seedIfEmpty();
      return read() || [];
    },
    create(zona) {
      const all = this.list();
      const item = {
        id: uid(),
        nombre: (zona.nombre || "").trim(),
        area: (zona.area || "").trim(),
        frecuencia: (zona.frecuencia || "").trim(),
        prioridad: zona.prioridad || "Media",
        estado: zona.estado || "Pendiente",
        updatedAt: nowISO(),
      };
      all.unshift(item);
      write(all);
      return item;
    },
    update(id, patch) {
      const all = this.list();
      const i = all.findIndex(z => z.id === id);
      if (i === -1) return null;

      all[i] = {
        ...all[i],
        ...patch,
        updatedAt: nowISO(),
      };
      write(all);
      return all[i];
    },
    remove(id) {
      const all = this.list();
      const next = all.filter(z => z.id !== id);
      write(next);
      return true;
    }
  },

tareas: {
  list() {
    const raw = localStorage.getItem("ag_limpieza_tareas_v1");
    return raw ? JSON.parse(raw) : [];
  },

  save(data) {
    localStorage.setItem("ag_limpieza_tareas_v1", JSON.stringify(data));
  },

  create(tarea) {
    const all = this.list();

const item = {
  id: crypto.randomUUID(),
  zona: tarea.zona,
  responsableId: tarea.responsableId || null,
  responsableNombre: tarea.responsableNombre || null,
  fecha: tarea.fecha || new Date().toISOString(),
  prioridad: tarea.prioridad || "Media",
  estado: "Pendiente",
  inicio: null,
  fin: null
};
    all.unshift(item);
    this.save(all);
    return item;
  },

  start(id) {
    const all = this.list();
    const t = all.find(x => x.id === id);
    if (!t) return;

    t.estado = "En proceso";
    t.inicio = Date.now();

    this.save(all);
  },

  finish(id) {
    const all = this.list();
    const t = all.find(x => x.id === id);
    if (!t) return;

    t.estado = "Completada";
    t.fin = Date.now();

    this.save(all);
  },

  delete(id) {
    const all = this.list().filter(x => x.id !== id);
    this.save(all);
  }
},

personal: {
  key: "ag_limpieza_personal_v1",

  list() {
    const raw = localStorage.getItem(this.key);
    return raw ? JSON.parse(raw) : [];
  },

  save(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  },

  create(emp) {
    const all = this.list();

    const item = {
      id: crypto.randomUUID(),
      nombre: (emp.nombre || "").trim(),
      correo: (emp.correo || "").trim().toLowerCase(),
      rol: emp.rol || "empleado",          // empleado | supervisor | admin
      activo: emp.activo ?? true,
      createdAt: new Date().toISOString()
    };

    all.unshift(item);
    this.save(all);
    return item;
  },

  update(id, patch) {
    const all = this.list();
    const i = all.findIndex(x => x.id === id);
    if (i === -1) return null;

    all[i] = { ...all[i], ...patch };
    this.save(all);
    return all[i];
  },

  remove(id) {
    const all = this.list().filter(x => x.id !== id);
    this.save(all);
    return true;
  }
},

rotacion: {
  key: "ag_limpieza_rotacion_v1",

  _todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  },

  getHoy() {
    const raw = localStorage.getItem(this.key);
    const obj = raw ? JSON.parse(raw) : {};
    const k = this._todayKey();
    return obj[k] || null;
  },

  setHoy(payload) {
    const raw = localStorage.getItem(this.key);
    const obj = raw ? JSON.parse(raw) : {};
    const k = this._todayKey();
    obj[k] = payload;
    localStorage.setItem(this.key, JSON.stringify(obj));
  },

  generarHoy() {
    const empleados = Store.personal.list().filter(e => e.activo && e.rol === "empleado");
    const zonas = Store.zonas.list();

    if (!empleados.length || !zonas.length) {
      return { ok: false, msg: "Necesitas empleados activos y zonas registradas." };
    }

    // Shuffle estable por día (para que se repita si recargas)
    const seed = this._todayKey().split("-").join("");
    const rnd = mulberry32(Number(seed));
    const emp = shuffle([...empleados], rnd);
    const zon = shuffle([...zonas], rnd);

    const asignaciones = [];
    for (let i = 0; i < emp.length; i++) {
      const z = zon[i % zon.length]; // si hay más empleados que zonas, se repite
      asignaciones.push({
        empleadoId: emp[i].id,
        empleado: emp[i].nombre,
        zona: z.nombre
      });
    }

    const payload = {
      dateKey: this._todayKey(),
      createdAt: new Date().toISOString(),
      asignaciones
    };

    this.setHoy(payload);
    return { ok: true, payload };
  }
},

session: {
  key: "ag_session_v1",

  get() {
    const raw = localStorage.getItem(this.key);
    return raw ? JSON.parse(raw) : null;
  },

  set(user) {
    localStorage.setItem(this.key, JSON.stringify(user));
  },

  clear() {
    localStorage.removeItem(this.key);
  }
}



};

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
