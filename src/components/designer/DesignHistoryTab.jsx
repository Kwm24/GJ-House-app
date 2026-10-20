import { useState, useEffect, useCallback } from "react";
import { Search, ChevronDown, ChevronRight, Download, FileImage, Loader2 } from "lucide-react";
import { useAuth } from "../AuthProvider.jsx";
import { listDesignHistory, listJobFiles, getJobFileSignedUrl } from "../../lib/jobFiles.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"]);

function fileExt(name) {
  return (name ?? "").split(".").pop().toLowerCase();
}

function isImage(name) {
  return IMAGE_EXTS.has(fileExt(name));
}

export function DesignHistoryTab() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Expanded row + its artwork files
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [artworkFiles, setArtworkFiles] = useState([]); // { file, url } objects
  const [artworkLoading, setArtworkLoading] = useState(false);
  const [artworkError, setArtworkError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      setHistory(await listDesignHistory(user.id));
    } catch (err) {
      setError(err.message ?? "Could not load design history.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function toggleExpand(jobId) {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      setArtworkFiles([]);
      setArtworkError("");
      return;
    }

    setExpandedJobId(jobId);
    setArtworkFiles([]);
    setArtworkError("");
    setArtworkLoading(true);

    try {
      const files = await listJobFiles(jobId, "design");
      const withUrls = await Promise.all(
        files.map(async (f) => {
          try {
            const url = await getJobFileSignedUrl(f.file_path);
            return { file: f, url };
          } catch {
            return { file: f, url: null };
          }
        })
      );
      setArtworkFiles(withUrls);
    } catch (err) {
      setArtworkError(err.message ?? "Could not load artwork files.");
    } finally {
      setArtworkLoading(false);
    }
  }

  const q = search.toLowerCase().trim();
  const visibleHistory = q
    ? history.filter((row) =>
        (row.jobs?.job_title ?? "").toLowerCase().includes(q) ||
        (row.jobs?.quote_ref ?? "").toLowerCase().includes(q) ||
        (row.jobs?.client_name ?? "").toLowerCase().includes(q) ||
        jobStatusLabel(row.jobs?.status).toLowerCase().includes(q)
      )
    : history;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--t-text1)]">Design history</h2>
            <p className="mt-1 text-sm text-[var(--t-muted)]">
              Every job you've designed. Click a row to view artwork files.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-4 py-2 text-center">
            <div className="text-xl font-bold text-[var(--t-text1)]">{history.length}</div>
            <div className="text-[11px] uppercase tracking-wide text-[var(--t-muted)]">
              designs
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
          <input
            type="text"
            placeholder="Search by job, client, ref or status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-bg)] pl-9 pr-4 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin"
              aria-label="Loading"
            />
          </div>
        ) : !error && visibleHistory.length === 0 ? (
          <p className="mt-8 text-center text-sm text-[var(--t-muted)] py-8">
            {search ? "No designs match your search." : "No designs uploaded yet."}
          </p>
        ) : visibleHistory.length > 0 ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--t-muted)] border-b border-[var(--t-border)]">
                  <th className="py-2 pr-4 w-6" />
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Status now</th>
                  <th className="py-2 pr-4">Last upload</th>
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((row) => {
                  const isExpanded = expandedJobId === row.job_id;
                  return (
                    <>
                      <tr
                        key={row.job_id}
                        className="border-b border-[var(--t-border)] hover:bg-gray-50 dark:hover:bg-white/3 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(row.job_id)}
                      >
                        <td className="py-2.5 pr-2">
                          {isExpanded
                            ? <ChevronDown size={14} className="text-[var(--t-muted)]" />
                            : <ChevronRight size={14} className="text-[var(--t-muted)]" />
                          }
                        </td>
                        <td className="py-2.5 pr-4 text-[var(--t-text1)]">
                          <div className="font-medium">{row.jobs?.job_title || "Untitled job"}</div>
                          <div className="text-xs text-[var(--t-muted)] font-mono">{row.jobs?.quote_ref}</div>
                        </td>
                        <td className="py-2.5 pr-4 text-[var(--t-text2)]">{row.jobs?.client_name || "—"}</td>
                        <td className="py-2.5 pr-4">
                          <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-[var(--t-text2)]">
                            {jobStatusLabel(row.jobs?.status)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap text-[var(--t-muted)]">
                          {new Date(row.created_at).toLocaleDateString("en-GH", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${row.job_id}-expanded`} className="border-b border-[var(--t-border)]">
                          <td />
                          <td colSpan={4} className="pb-4 pr-4 pt-2">
                            {artworkLoading ? (
                              <div className="flex items-center gap-2 text-sm text-[var(--t-muted)] py-2">
                                <Loader2 size={14} className="animate-spin" />
                                Loading artwork…
                              </div>
                            ) : artworkError ? (
                              <p className="text-sm text-red-600">{artworkError}</p>
                            ) : artworkFiles.length === 0 ? (
                              <p className="text-sm text-[var(--t-muted)] italic">No artwork files found for this job.</p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-1">
                                {artworkFiles.map(({ file, url }) => (
                                  <div
                                    key={file.id}
                                    className="rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] overflow-hidden"
                                  >
                                    {isImage(file.original_name) && url ? (
                                      <img
                                        src={url}
                                        alt={file.original_name}
                                        className="w-full h-28 object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-28 flex items-center justify-center bg-gray-50 dark:bg-white/5">
                                        <FileImage size={28} className="text-[var(--t-muted)]" />
                                      </div>
                                    )}
                                    <div className="p-2 flex items-center justify-between gap-1">
                                      <span className="text-xs text-[var(--t-text2)] truncate flex-1" title={file.original_name}>
                                        {file.original_name}
                                      </span>
                                      {url && (
                                        <a
                                          href={url}
                                          download={file.original_name}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="shrink-0 text-[#6366F1] hover:text-[#4F46E5]"
                                          title="Download"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Download size={13} />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
