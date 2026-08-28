/**
 * BRIDGE: Central de Motoboys → Loja (escrita reversa)
 * ======================================================
 * Quando a Central aprova, suspende ou muda status de um motoboy,
 * replica a mudanca para o Firestore da loja (luk123-b1986).
 * Assim a loja ve a mudanca em tempo real via onSnapshot.
 *
 * Tambem replica corridas (rides) para a loja, para que ela veja
 * o status das entregas gerenciadas pela Central.
 *
 * Tudo via REST API — mesmo padrao das outras bridges.
 */

const STORE_CFG = SUPREMO_BRIDGE_CONFIG.store;

/**
 * Replica uma mudanca de motoboy da Central para a loja.
 * @param {string} motoboyId - ID do motoboy
 * @param {Object} patch - campos alterados
 */
async function syncCourierToStore(motoboyId, patch) {
  if (!motoboyId || !STORE_CFG?.apiKey) return { ok: false };

  const payload = {
    id: motoboyId,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  try {
    await supremoRestWrite(STORE_CFG.projectId, STORE_CFG.apiKey, "motoboys", motoboyId, payload);
    console.log("[Central→Loja] Motoboy replicado:", motoboyId, Object.keys(patch).join(", "));
    return { ok: true };
  } catch (e) {
    console.warn("[Central→Loja] Falha ao replicar motoboy:", e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Replica uma corrida da Central para a loja.
 * A loja pode ter um listener para mostrar status de entregas.
 * @param {Object} ride - documento da corrida
 */
async function syncRideToStore(ride) {
  if (!ride?.id || !ride?.orderId || !STORE_CFG?.apiKey) return { ok: false };

  const payload = {
    id: ride.id,
    orderId: ride.orderId,
    status: ride.status || "",
    selectedCourierId: ride.selectedCourierId || null,
    selectedCourierName: ride.selectedCourierName || null,
    storeId: ride.storeId || "",
    updatedAt: ride.updatedAt || new Date().toISOString(),
  };

  try {
    await supremoRestWrite(STORE_CFG.projectId, STORE_CFG.apiKey, "rides", ride.id, payload);
    return { ok: true };
  } catch (e) {
    console.warn("[Central→Loja] Falha ao replicar corrida:", e.message);
    return { ok: false, error: e.message };
  }
}

if (typeof window !== "undefined") {
  window.syncCourierToStore = syncCourierToStore;
  window.syncRideToStore = syncRideToStore;
}
