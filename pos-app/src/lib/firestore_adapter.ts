import { getDatabase, ref, set, get, child, onValue, query as rtdbQuery, orderByChild, equalTo, push, remove, serverTimestamp as rtdbServerTimestamp, update, increment as rtdbIncrement } from "firebase/database";
export { db } from './firebase';

export function doc(dbInstance: any, pathStr: string, ...segments: string[]) {
  const fullPath = [pathStr, ...segments].join('/');
  return { ref: ref(dbInstance, fullPath), path: fullPath, id: fullPath.split('/').pop() };
}

export function collection(dbInstance: any, pathStr: string, ...segments: string[]) {
  const fullPath = [pathStr, ...segments].join('/');
  return { ref: ref(dbInstance, fullPath), path: fullPath };
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  if (options?.merge) {
    await update(docRef.ref, data);
  } else {
    await set(docRef.ref, data);
  }
}

export async function addDoc(collectionRef: any, data: any) {
  const newRef = push(collectionRef.ref);
  await set(newRef, data);
  return { id: newRef.key };
}

export async function updateDoc(docRef: any, data: any) {
  await update(docRef.ref, data);
}

export function increment(num: number) {
  return rtdbIncrement(num);
}

export async function getDoc(docRef: any) {
  const snapshot = await get(docRef.ref);
  return {
    exists: () => snapshot.exists(),
    data: () => snapshot.val(),
    id: docRef.id
  };
}

export async function deleteDoc(docRef: any) {
  await remove(docRef.ref);
}

export function serverTimestamp() {
  return rtdbServerTimestamp();
}

export function query(collectionRef: any, ...constraints: any[]) {
  let qRef = collectionRef.ref;
  return { ref: qRef, path: collectionRef.path, constraints };
}

export function where(fieldPath: string, opStr: string, value: any) {
  return { type: 'where', fieldPath, opStr, value };
}

export function orderBy(fieldPath: string, directionStr?: string) {
  return { type: 'orderBy', fieldPath, directionStr };
}

export function limit(num: number) {
  return { type: 'limit', value: num };
}

export async function getDocs(queryRef: any) {
  let qRef = queryRef.ref;
  if (queryRef.constraints) {
    const tenantConstraint = queryRef.constraints.find((c: any) => c.type === 'where' && c.fieldPath === 'tenant_id' && c.opStr === '==');
    if (tenantConstraint) {
      qRef = rtdbQuery(queryRef.ref, orderByChild('tenant_id'), equalTo(tenantConstraint.value));
    }
  }

  const snapshot = await get(qRef);
  let results: any[] = [];
  if (snapshot.exists()) {
    snapshot.forEach((childSnap) => {
      results.push({
        id: childSnap.key,
        data: () => childSnap.val()
      });
    });
  }
  
  if (queryRef.constraints) {
    for (const c of queryRef.constraints) {
      if (c.type === 'where') {
        results = results.filter(doc => {
          const val = doc.data()[c.fieldPath];
          if (c.opStr === '==') return val === c.value;
          if (c.opStr === '>') return val > c.value;
          if (c.opStr === '<') return val < c.value;
          if (c.opStr === '>=') return val >= c.value;
          if (c.opStr === '<=') return val <= c.value;
          if (c.opStr === '!=') return val !== c.value;
          if (c.opStr === 'in') return c.value.includes(val);
          return true;
        });
      }
    }

    const orderByConstraint = queryRef.constraints.find((c: any) => c.type === 'orderBy');
    if (orderByConstraint) {
      const field = orderByConstraint.fieldPath;
      const dir = orderByConstraint.directionStr || 'asc';
      results.sort((a, b) => {
        const valA = a.data()[field];
        const valB = b.data()[field];
        if (valA === undefined || valB === undefined) return 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
          return dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return dir === 'asc' ? valA - valB : valB - valA;
      });
    }

    const limitConstraint = queryRef.constraints.find((c: any) => c.type === 'limit');
    if (limitConstraint) {
      results = results.slice(0, limitConstraint.value);
    }
  }

  return {
    docs: results,
    empty: results.length === 0,
    forEach: (cb: Function) => results.forEach(r => cb(r))
  };
}

export function onSnapshot(queryRef: any, callback: Function) {
  let qRef = queryRef.ref;
  if (queryRef.constraints) {
    const tenantConstraint = queryRef.constraints.find((c: any) => c.type === 'where' && c.fieldPath === 'tenant_id' && c.opStr === '==');
    if (tenantConstraint) {
      qRef = rtdbQuery(queryRef.ref, orderByChild('tenant_id'), equalTo(tenantConstraint.value));
    }
  }

  return onValue(qRef, (snapshot) => {
    let results: any[] = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnap) => {
        results.push({
          id: childSnap.key,
          data: () => childSnap.val()
        });
      });
    }

    if (queryRef.constraints) {
      for (const c of queryRef.constraints) {
        if (c.type === 'where') {
          results = results.filter(doc => {
            const val = doc.data()[c.fieldPath];
            if (c.opStr === '==') return val === c.value;
            if (c.opStr === '>') return val > c.value;
            if (c.opStr === '<') return val < c.value;
            if (c.opStr === '>=') return val >= c.value;
            if (c.opStr === '<=') return val <= c.value;
            if (c.opStr === '!=') return val !== c.value;
            if (c.opStr === 'in') return c.value.includes(val);
            return true;
          });
        }
      }

      const orderByConstraint = queryRef.constraints.find((c: any) => c.type === 'orderBy');
      if (orderByConstraint) {
        const field = orderByConstraint.fieldPath;
        const dir = orderByConstraint.directionStr || 'asc';
        results.sort((a, b) => {
          const valA = a.data()[field];
          const valB = b.data()[field];
          if (valA === undefined || valB === undefined) return 0;
          if (typeof valA === 'string' && typeof valB === 'string') {
            return dir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return dir === 'asc' ? valA - valB : valB - valA;
        });
      }

      const limitConstraint = queryRef.constraints.find((c: any) => c.type === 'limit');
      if (limitConstraint) {
        results = results.slice(0, limitConstraint.value);
      }
    }

    callback({
      docs: results,
      empty: results.length === 0,
      forEach: (cb: Function) => results.forEach(r => cb(r))
    });
  });
}
