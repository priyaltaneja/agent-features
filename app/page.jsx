"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export default function Home() {
  // Data
  const [features, setFeatures] = useState([]);
  const [clusters, setClusters] = useState([]);

  // Async status
  const [clustering, setClustering] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // View toggle
  const [activeView, setActiveView] = useState("features");

  // Add Feature panel
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  // Form state (persists across panel open/close, only clears on submit)
  const [agentName, setAgentName] = useState("");
  const [featureName, setFeatureName] = useState("");
  const [description, setDescription] = useState("");
  // Agent filter
  const [agentFilter, setAgentFilter] = useState(null);

  // Modals
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);

  // Toast: { message, type } | null
  const [toast, setToast] = useState(null);

  const toastTimer = useRef(null);
  const agentInputRef = useRef(null);

  // ---- Helpers ----

  const showToast = useCallback((message, type = "error") => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchFeatures = useCallback(async () => {
    try {
      const res = await fetch("/api/features");
      if (res.ok) setFeatures(await res.json());
    } catch {
      /* silent */
    }
  }, []);

  const fetchClusters = useCallback(async () => {
    try {
      const res = await fetch("/api/cluster");
      if (res.ok) setClusters(await res.json());
    } catch {
      /* silent */
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchFeatures();
    fetchClusters();
  }, [fetchFeatures, fetchClusters]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFeatures();
      fetchClusters();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchFeatures, fetchClusters]);

  // Escape key handler (priority: feature modal > cluster modal > panel)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (selectedFeature) {
          setSelectedFeature(null);
        } else if (selectedCluster) {
          setSelectedCluster(null);
        } else if (addPanelOpen) {
          setAddPanelOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFeature, selectedCluster, addPanelOpen]);

  // Auto-focus agent input when panel opens
  useEffect(() => {
    if (addPanelOpen && agentInputRef.current) {
      setTimeout(() => agentInputRef.current.focus(), 100);
    }
  }, [addPanelOpen]);

  // ---- Handlers ----

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agentName.trim() || !featureName.trim() || !description.trim()) return;

    const optimisticFeature = {
      id: Date.now(),
      agent_name: agentName.trim(),
      feature_name: featureName.trim(),
      description: description.trim(),
      added_by: "anonymous",
      created_at: new Date().toISOString(),
      cluster_label: null,
      cluster_color: null,
      cluster_id: null,
    };

    setFeatures((prev) => [optimisticFeature, ...prev]);
    setSubmitting(true);

    try {
      const res = await fetch("/api/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: optimisticFeature.agent_name,
          feature_name: optimisticFeature.feature_name,
          description: optimisticFeature.description,
        }),
      });
      if (!res.ok) throw new Error("Failed to add feature");
      await fetchFeatures();
      // Clear form and close panel only on success
      setAgentName("");
      setFeatureName("");
      setDescription("");
      setAddPanelOpen(false);
      showToast("Feature added", "success");
    } catch (err) {
      setFeatures((prev) => prev.filter((f) => f.id !== optimisticFeature.id));
      showToast(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const prev = features;
    setFeatures((f) => f.filter((x) => x.id !== id));
    if (selectedFeature?.id === id) setSelectedFeature(null);
    try {
      const res = await fetch(`/api/features/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      showToast("Feature deleted", "success");
      fetchClusters();
    } catch (err) {
      setFeatures(prev);
      showToast(err.message);
    }
  };

  const handleCluster = async () => {
    setClustering(true);
    try {
      const res = await fetch("/api/cluster", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Clustering failed");
      }
      const data = await res.json();
      setClusters(data);
      await fetchFeatures();
      setActiveView("clusters");
      showToast("Clustering complete", "success");
    } catch (err) {
      showToast(err.message);
    } finally {
      setClustering(false);
    }
  };

  // ---- Derived data ----

  const featureMap = {};
  for (const f of features) {
    featureMap[f.id] = f;
  }
  const uniqueFeatureCount = new Set(features.map((f) => f.id)).size;
  const unclusteredCount = features.filter((f) => !f.cluster_label).length;
  const hasNewFeatures = unclusteredCount > 0;

  // Unique agent names sorted alphabetically
  const agentNames = [...new Set(features.map((f) => f.agent_name))].sort();

  // Filtered features for display
  const filteredFeatures = agentFilter
    ? features.filter((f) => f.agent_name === agentFilter)
    : features;

  // ---- Render ----

  return (
    <div className="app-layout">
      {/* ---- Top Bar ---- */}
      <header className="topbar">
        <div className="topbar-left">
          <h1>Encyclopedia Agentica</h1>
          <span className="topbar-tagline">a catalog of features from coding agents</span>
        </div>
        <div className="topbar-center">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${activeView === "features" ? "view-toggle-btn--active" : ""}`}
              onClick={() => setActiveView("features")}
            >
              Features ({uniqueFeatureCount})
            </button>
            <button
              className={`view-toggle-btn ${activeView === "clusters" ? "view-toggle-btn--active" : ""}`}
              onClick={() => setActiveView("clusters")}
            >
              Clusters ({clusters.length})
            </button>
          </div>
        </div>
        <div className="topbar-right">
          <button
            className="btn btn-secondary"
            onClick={handleCluster}
            disabled={clustering || features.length === 0 || !hasNewFeatures}
            title={!hasNewFeatures && features.length > 0 ? "All features are already clustered" : undefined}
          >
            {clustering ? (
              <>
                <span className="spinner" />
                Clustering...
              </>
            ) : (
              <>
                Auto-Cluster
                {hasNewFeatures && unclusteredCount < features.length && (
                  <span className="btn-badge">{unclusteredCount} new</span>
                )}
              </>
            )}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setAddPanelOpen(true)}
          >
            + Add Feature
          </button>
        </div>
      </header>

      {/* ---- Main Content ---- */}
      <main className="main-content">
        {activeView === "features" ? (
          features.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">//</div>
              <h2>No features yet</h2>
              <p>
                Click &quot;+ Add Feature&quot; to start building your agent
                feature database.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setAddPanelOpen(true)}
              >
                + Add Feature
              </button>
            </div>
          ) : (
            <>
              {agentNames.length > 1 && (
                <div className="filter-bar">
                  <button
                    className={`filter-chip ${agentFilter === null ? "filter-chip--active" : ""}`}
                    onClick={() => setAgentFilter(null)}
                  >
                    All
                  </button>
                  {agentNames.map((name) => (
                    <button
                      key={name}
                      className={`filter-chip ${agentFilter === name ? "filter-chip--active" : ""}`}
                      onClick={() => setAgentFilter(agentFilter === name ? null : name)}
                    >
                      {name}
                      <span className="filter-chip-count">
                        {features.filter((f) => f.agent_name === name).length}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="feature-grid">
              {filteredFeatures.map((f) => (
                <div
                  key={f.id}
                  className="feature-card"
                  onClick={() => setSelectedFeature(f)}
                >
                  <span className="feature-card-agent">{f.agent_name}</span>
                  <div className="feature-card-name">{f.feature_name}</div>
                  <div className="feature-card-desc">{f.description}</div>
                  <div className="feature-card-meta">
                    {f.cluster_label && (
                      <span className="feature-card-cluster">
                        <span
                          className="cluster-dot"
                          style={{ background: f.cluster_color || "#3f3f46" }}
                        />
                        {f.cluster_label}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </>
          )
        ) : clusters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">//</div>
            <h2>No clusters yet</h2>
            <p>
              Add features, then click &quot;Auto-Cluster&quot; to let the LLM
              group them semantically.
            </p>
            <button
              className="btn btn-secondary"
              onClick={handleCluster}
              disabled={clustering || features.length === 0 || !hasNewFeatures}
            >
              {clustering ? (
                <>
                  <span className="spinner" />
                  Clustering...
                </>
              ) : (
                "Auto-Cluster"
              )}
            </button>
          </div>
        ) : (
          <div className="cluster-grid">
            {clusters.map((c) => (
              <div
                key={c.id}
                className="cluster-card"
                style={{ "--cluster-color": c.color }}
                onClick={() => setSelectedCluster(c)}
              >
                <div className="cluster-card-header">
                  <div className="cluster-card-label">{c.label}</div>
                  <span className="cluster-card-count">
                    {(c.featureIds || []).length} features
                  </span>
                </div>
                {c.rationale && (
                  <div className="cluster-card-rationale">{c.rationale}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ---- Add Feature Panel + Backdrop ---- */}
      <div
        className={`panel-backdrop ${addPanelOpen ? "panel-backdrop--visible" : ""}`}
        onClick={() => setAddPanelOpen(false)}
      />
      <aside className={`add-panel ${addPanelOpen ? "add-panel--open" : ""}`}>
        <div className="add-panel-header">
          <h2>Add Feature</h2>
          <button
            className="btn-close"
            onClick={() => setAddPanelOpen(false)}
          >
            &times;
          </button>
        </div>
        <form
          className="add-panel-body"
          onSubmit={handleSubmit}
        >
          <div className="form-group">
            <label htmlFor="agent">Agent Name</label>
            <input
              ref={agentInputRef}
              id="agent"
              type="text"
              placeholder="e.g. Cline, Aider, Claude Code"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="feature">Feature Name</label>
            <input
              id="feature"
              type="text"
              placeholder="e.g. Memory Bank"
              value={featureName}
              onChange={(e) => setFeatureName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="desc">Description</label>
            <textarea
              id="desc"
              placeholder="1-3 sentence explanation of what this feature does"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner" />
                Adding...
              </>
            ) : (
              "Submit Feature"
            )}
          </button>
        </form>
        <div className="add-panel-footer">
          <span className="hint-text">Press Esc to close</span>
        </div>
      </aside>

      {/* ---- Cluster Detail Modal ---- */}
      {selectedCluster && (
        <div
          className="modal-overlay modal-overlay--cluster"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCluster(null);
          }}
        >
          <div className="modal-container" style={{ maxWidth: 600 }}>
            <div
              className="cluster-modal-color-bar"
              style={{ background: selectedCluster.color }}
            />
            <div className="modal-header">
              <h2>{selectedCluster.label}</h2>
              <button
                className="btn-close"
                onClick={() => setSelectedCluster(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {selectedCluster.rationale && (
                <p className="modal-description">
                  {selectedCluster.rationale}
                </p>
              )}
              <div className="cluster-modal-section">
                Features in this cluster ({(selectedCluster.featureIds || []).length})
              </div>
              <div className="cluster-modal-features">
                {(selectedCluster.featureIds || []).map((fid) => {
                  const feat = featureMap[fid];
                  if (!feat) return null;
                  return (
                    <div
                      key={fid}
                      className="cluster-modal-feature-row"
                      onClick={() => setSelectedFeature(feat)}
                    >
                      <div className="cluster-modal-feature-info">
                        <span className="cluster-modal-feature-agent">
                          {feat.agent_name}
                        </span>
                        <span className="cluster-modal-feature-name">
                          {feat.feature_name}
                        </span>
                      </div>
                      <span className="cluster-modal-feature-arrow">&rsaquo;</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Feature Detail Modal ---- */}
      {selectedFeature && (
        <div
          className="modal-overlay modal-overlay--feature"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedFeature(null);
          }}
        >
          <div className="modal-container" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div>
                <span className="badge">{selectedFeature.agent_name}</span>
                <h2 style={{ marginTop: 8 }}>{selectedFeature.feature_name}</h2>
              </div>
              <button
                className="btn-close"
                onClick={() => setSelectedFeature(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                {selectedFeature.description}
              </p>
              <div className="modal-meta">
                <div className="modal-meta-row">
                  <span className="modal-meta-label">Created</span>
                  <span className="modal-meta-value">
                    {new Date(
                      selectedFeature.created_at + (selectedFeature.created_at.endsWith("Z") ? "" : "Z")
                    ).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {selectedFeature.cluster_label && (
                  <div className="modal-meta-row">
                    <span className="modal-meta-label">Cluster</span>
                    <span
                      className="modal-meta-value"
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        className="cluster-dot"
                        style={{
                          background:
                            selectedFeature.cluster_color || "#3f3f46",
                        }}
                      />
                      {selectedFeature.cluster_label}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-divider" />
            <div className="modal-footer">
              <button
                className="btn btn-destructive"
                onClick={() => handleDelete(selectedFeature.id)}
              >
                Delete Feature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Toast ---- */}
      {toast && (
        <div
          className={`toast ${toast.type === "success" ? "toast--success" : ""}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
