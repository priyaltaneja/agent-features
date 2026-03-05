import Redis from "ioredis";

let _client = null;

function getClient() {
  if (_client) return _client;
  _client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  return _client;
}

const FEATURES_KEY = "features";
const CLUSTERS_KEY = "clusters";
const COUNTER_KEY = "feature_id_counter";

// ---- Helpers ----

async function getJSON(key) {
  const raw = await getClient().get(key);
  if (!raw) return [];
  return JSON.parse(raw);
}

async function setJSON(key, data) {
  await getClient().set(key, JSON.stringify(data));
}

// ---- Public API ----

export async function getAllFeatures() {
  const features = await getJSON(FEATURES_KEY);
  const clusters = await getJSON(CLUSTERS_KEY);

  const clusterMap = {};
  for (const c of clusters) {
    for (const fid of c.featureIds || []) {
      clusterMap[fid] = { cluster_label: c.label, cluster_color: c.color, cluster_id: c.id };
    }
  }

  return features
    .map((f) => ({
      ...f,
      cluster_label: clusterMap[f.id]?.cluster_label || null,
      cluster_color: clusterMap[f.id]?.cluster_color || null,
      cluster_id: clusterMap[f.id]?.cluster_id || null,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function getAllFeaturesRaw() {
  const features = await getJSON(FEATURES_KEY);
  return features
    .map((f) => ({ id: f.id, agent_name: f.agent_name, feature_name: f.feature_name, description: f.description }))
    .sort((a, b) => a.id - b.id);
}

export async function insertFeature({ agent_name, feature_name, description, added_by }) {
  const features = await getJSON(FEATURES_KEY);
  const id = await getClient().incr(COUNTER_KEY);
  const feature = {
    id,
    agent_name,
    feature_name,
    description,
    added_by: added_by || "anonymous",
    created_at: new Date().toISOString(),
  };
  features.push(feature);
  await setJSON(FEATURES_KEY, features);
  return feature;
}

export async function deleteFeature(id) {
  const features = await getJSON(FEATURES_KEY);
  const idx = features.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  features.splice(idx, 1);
  await setJSON(FEATURES_KEY, features);

  const clusters = await getJSON(CLUSTERS_KEY);
  let changed = false;
  for (const c of clusters) {
    const before = c.featureIds?.length || 0;
    c.featureIds = (c.featureIds || []).filter((fid) => fid !== id);
    if (c.featureIds.length !== before) changed = true;
  }
  if (changed) await setJSON(CLUSTERS_KEY, clusters);

  return id;
}

export async function getAllClusters() {
  return await getJSON(CLUSTERS_KEY);
}

export async function saveClusters(clusters) {
  await setJSON(CLUSTERS_KEY, clusters);
}
