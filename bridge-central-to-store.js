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
    await (window.supremoRestMergeWrite || supremoRestWrite)(STORE_CFG.projectId, STORE_CFG.apiKey, "motoboys", motoboyId, payload);
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
    offerCourierId: ride.offerCourierId || null,
    offerCourierName: ride.offerCourierName || null,
    currentOfferId: ride.currentOfferId || null,
    offerExpiresAt: ride.offerExpiresAt || null,
    storeId: ride.storeId || "",
    motoboyLocation: ride.motoboyLocation || null,
    locationSharing: ride.locationSharing || (ride.motoboyLocation ? 'active' : 'unavailable'),
    deliveryAcceptedAt: ride.deliveryAcceptedAt || null,
    deliveredAt: ride.deliveredAt || null,
    deliveryCompletedAt: ride.deliveryCompletedAt || null,
    pickup: ride.pickup || null,
    delivery: ride.delivery || null,
    timeline: Array.isArray(ride.timeline) ? ride.timeline : [],
    updatedAt: ride.updatedAt || new Date().toISOString(),
  };

  try {
    await (window.supremoRestMergeWrite || supremoRestWrite)(STORE_CFG.projectId, STORE_CFG.apiKey, "rides", ride.id, payload);
    const selectedId = String(ride.selectedCourierId || '').trim();
    const selectedName = ride.selectedCourierName || '';
    const status = String(ride.status || '').toLowerCase();
    const orderPatch = { logistics: { rideId: ride.id, status: `ride_${status || 'updated'}`, courierId: selectedId || null, courierName: selectedName || null }, updatedAt: payload.updatedAt };
    if (['accepted', 'at_pickup', 'in_transit', 'cancel_requested', 'exception'].includes(status)) {
      Object.assign(orderPatch, { status: 'out_for_delivery', motoboyId: selectedId, motoboyName: selectedName, deliveryOffer: { status: 'accepted', motoboyId: selectedId, acceptedAt: ride.deliveryAcceptedAt || payload.updatedAt }, motoboyLocation: ride.motoboyLocation || null, locationSharing: ride.motoboyLocation ? 'active' : 'unavailable', deliveryAcceptedAt: ride.deliveryAcceptedAt || payload.updatedAt });
    } else if (status === 'delivered') {
      Object.assign(orderPatch, { status: 'delivered', motoboyId: selectedId, motoboyName: selectedName, deliveryOffer: { status: 'completed', motoboyId: selectedId, completedAt: ride.deliveredAt || payload.updatedAt }, deliveredAt: ride.deliveredAt || payload.updatedAt, deliveryCompletedAt: ride.deliveryCompletedAt || payload.updatedAt, locationSharing: 'stopped' });
    } else if (['ready_for_dispatch', 'cancelled'].includes(status) && !selectedId) {
      Object.assign(orderPatch, { motoboyId: '', motoboyName: '', deliveryOffer: { status: status === 'cancelled' ? 'cancelled' : 'declined', declinedAt: payload.updatedAt }, locationSharing: 'stopped' });
    }
    await (window.supremoRestMergeWrite || supremoRestWrite)(STORE_CFG.projectId, STORE_CFG.apiKey, "orders", ride.orderId, orderPatch);
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
