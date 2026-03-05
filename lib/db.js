import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const FEATURES_KEY = "features";
const CLUSTERS_KEY = "clusters";
const COUNTER_KEY = "feature_id_counter";

// ---- Helpers ----

async function getFeatures() {
  return (await redis.get(FEATURES_KEY)) || [];
}

async function setFeatures(features) {
  await redis.set(FEATURES_KEY, features);
}

async function getClusters() {
  return (await redis.get(CLUSTERS_KEY)) || [];
}

async function setClusters(clusters) {
  await redis.set(CLUSTERS_KEY, clusters);
}

async function nextId() {
  return await redis.incr(COUNTER_KEY);
}

// ---- Public API ----

export async function getAllFeatures() {
  const features = await getFeatures();
  const clusters = await getClusters();

  // Build cluster lookup
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
  const features = await getFeatures();
  return features
    .map((f) => ({ id: f.id, agent_name: f.agent_name, feature_name: f.feature_name, description: f.description }))
    .sort((a, b) => a.id - b.id);
}

export async function insertFeature({ agent_name, feature_name, description, added_by }) {
  const features = await getFeatures();
  const id = await nextId();
  const feature = {
    id,
    agent_name,
    feature_name,
    description,
    added_by: added_by || "anonymous",
    created_at: new Date().toISOString(),
  };
  features.push(feature);
  await setFeatures(features);
  return feature;
}

export async function deleteFeature(id) {
  const features = await getFeatures();
  const idx = features.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  features.splice(idx, 1);
  await setFeatures(features);

  // Also remove from any clusters
  const clusters = await getClusters();
  let changed = false;
  for (const c of clusters) {
    const before = c.featureIds?.length || 0;
    c.featureIds = (c.featureIds || []).filter((fid) => fid !== id);
    if (c.featureIds.length !== before) changed = true;
  }
  if (changed) await setClusters(clusters);

  return id;
}

export async function getAllClusters() {
  return await getClusters();
}

export async function saveClusters(clusters) {
  await setClusters(clusters);
}
