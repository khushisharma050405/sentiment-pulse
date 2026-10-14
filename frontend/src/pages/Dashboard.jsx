import { useEffect, useRef, useState } from 'react';
import Art from '../components/Art';
import Logo from '../components/Logo';
import { bubbles, hashtag } from '../lib/art';
import { SEED } from '../lib/seed';
import {
  analyzeText,
  analyzeBatch,
  history,
  stats,
  trends,
  topics,
  getUser,
  isAuthed,
  logout,
  uploadFiles,
} from '../lib/api';
import {
  EditIcon,
  FeedIcon,
  DashboardIcon,
  TimelineIcon,
  ThemesIcon,
  HistoryIcon,
  HelpIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  Arrow,
} from '../components/Icons';

const cls = l => (l === 'Positive' ? 'pos' : l === 'Negative' ? 'neg' : 'neu');
const pc = l => (l === 'Positive' ? 'p' : l === 'Negative' ? 'n' : '');
const tone = v => (v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'neu');

const SAMPLE = 'The delivery was fast and the support team was genuinely helpful, but the app keeps crashing and it is not worth the price.';
const CHIPS = [
  ['Positive', 'I absolutely love this product, it works perfectly!'],
  ['Negative', 'Terrible experience. The staff were rude and nothing worked.'],
  ['Neutral', 'The package arrived on Tuesday in a brown box.'],
];

const Err = ({ t }) => (t ? <p role="alert" style={{ color: 'var(--neg)', margin: '12px 0 0' }}>{t}</p> : null);

/* -------------------------------------------------------------------------- */
/*                                1. WRITE VIEW                               */
/* -------------------------------------------------------------------------- */
function WriteView({ initialText, onReRunHandled }) {
  const [t, setT] = useState(initialText || SAMPLE);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [hist, setHist] = useState([]);

  const loadHistory = async () => {
    if (!isAuthed()) return;
    try {
      const data = await history();
      if (Array.isArray(data)) setHist(data.slice(0, 10));
    } catch {}
  };

  const run = async x => {
    if (!x.trim()) {
      setRes(null);
      setErr('');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      setRes({ t: x, a: await analyzeText(x) });
      loadHistory();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialText) {
      setT(initialText);
      run(initialText);
      if (onReRunHandled) onReRunHandled();
    } else {
      run(SAMPLE);
    }
    loadHistory();
  }, [initialText]);

  const a = res && res.a;
  const kw = a ? Object.fromEntries(a.keywords.map(k => [k.word, k.polarity])) : {};
  const pct = v => Math.round(v * 100);

  return (
    <section>
      <div className="head">
        <div>
          <h2>How does this text feel?</h2>
          <p>Paste a review, survey answer or support message. You get a verdict, a score and the words that drove it.</p>
        </div>
        <Art html={bubbles()} />
      </div>

      <div className="panel">
        <label htmlFor="inp" className="hide">Text to analyze</label>
        <textarea
          id="inp"
          value={t}
          placeholder="Paste text here…"
          onChange={e => setT(e.target.value)}
        />
        <div className="row">
          <button
            className="btn"
            type="button"
            disabled={busy}
            style={busy ? { opacity: 0.6 } : undefined}
            onClick={() => run(t)}
          >
            {busy ? 'Analyzing…' : 'Analyze text'}
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setT('');
              setRes(null);
              setErr('');
            }}
          >
            Clear
          </button>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Try:</span>
          {CHIPS.map(([l, s]) => (
            <button
              key={l}
              className="chip"
              type="button"
              onClick={() => {
                setT(s);
                run(s);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <Err t={err} />
        <div className="result">
          {!a ? (
            !err && !busy && (
              <p style={{ color: 'var(--muted)', margin: 0 }}>
                Add some text above, then press Analyze text.
              </p>
            )
          ) : (
            <>
              <div className="verdict">
                <b className={cls(a.label)}>{a.label}</b>
                <span>
                  score {a.score.toFixed(2)} on a scale of −1 to +1 · {a.keywords.length} sentiment word
                  {a.keywords.length === 1 ? '' : 's'} found
                </span>
              </div>
              <div>
                <div className="meter">
                  <i style={{ left: `${(a.score + 1) * 50}%` }} />
                </div>
                <div className="scale">
                  <span>Negative (−1.0)</span>
                  <span>Neutral (0.0)</span>
                  <span>Positive (+1.0)</span>
                </div>
              </div>
              <div className="trio">
                <div>
                  <strong className="pos">{pct(a.positive)}%</strong>
                  <small>Positive</small>
                </div>
                <div>
                  <strong className="neu">{pct(a.neutral)}%</strong>
                  <small>Neutral</small>
                </div>
                <div>
                  <strong className="neg">{pct(a.negative)}%</strong>
                  <small>Negative</small>
                </div>
              </div>
              <div className="hl">
                {res.t.split(/(\s+)/).map((p, i) => {
                  const v = kw[p.toLowerCase().replace(/[^a-z']/g, '')];
                  return v ? (
                    <mark key={i} className={v > 0 ? 'p' : 'n'}>
                      {p}
                    </mark>
                  ) : (
                    p
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3>Recent analyses</h3>
          <small style={{ color: 'var(--muted)' }}>Click an item to re-run</small>
        </div>
        {hist.length === 0 ? (
          <p style={{ color: 'var(--muted)', margin: '10px 0 0', fontSize: 13.5 }}>
            {isAuthed()
              ? 'No history yet. Analyze some text to see it recorded here.'
              : 'Sign in to record and view your analysis history.'}
          </p>
        ) : (
          <div className="hist-list">
            {hist.map(h => (
              <button
                key={h.id}
                type="button"
                className="hist-item"
                onClick={() => {
                  setT(h.text);
                  run(h.text);
                }}
                title="Click to re-run this analysis"
              >
                <span className={'tag ' + cls(h.label)}>
                  {h.label} · {h.score > 0 ? `+${h.score.toFixed(2)}` : h.score.toFixed(2)}
                </span>
                <p className="hist-text">{h.text}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                2. FEED VIEW                                */
/* -------------------------------------------------------------------------- */
function FeedView() {
  const [posts, setPosts] = useState(() => SEED.map(([platform, text]) => ({ platform, text })));
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  // Multi-file upload states
  const [fileResults, setFileResults] = useState([]);
  const [reviewedItems, setReviewedItems] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [analyzingExtracted, setAnalyzingExtracted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const multiFileRef = useRef(null);

  useEffect(() => {
    let live = true;
    setErr('');
    analyzeBatch(posts)
      .then(d => live && setData(d))
      .catch(e => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [posts]);

  const handleFiles = async fileList => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (files.length > 10) {
      setUploadErr('Maximum 10 files per upload allowed.');
      return;
    }
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        setUploadErr(`File "${f.name}" exceeds the 5 MB limit.`);
        return;
      }
    }
    setUploadErr('');
    setFilesLoading(true);

    const previews = {};
    for (const f of files) {
      if (f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name)) {
        previews[f.name] = URL.createObjectURL(f);
      }
    }

    try {
      const data = await uploadFiles(files);
      const withPreviews = data.map(res => ({
        ...res,
        previewUrl: previews[res.filename] || null,
      }));
      setFileResults(withPreviews);

      const allItems = [];
      data.forEach(f => {
        (f.items || []).forEach(it => {
          allItems.push({
            platform: it.platform || 'Other',
            text: it.text || '',
            sourceFile: f.filename,
          });
        });
      });
      setReviewedItems(allItems);
    } catch (err) {
      setUploadErr(err.message || 'File upload failed.');
    } finally {
      setFilesLoading(false);
      if (multiFileRef.current) multiFileRef.current.value = '';
    }
  };

  const updateReviewedText = (idx, newText) => {
    setReviewedItems(prev => prev.map((item, i) => (i === idx ? { ...item, text: newText } : item)));
  };

  const updateReviewedPlatform = (idx, newPlat) => {
    setReviewedItems(prev => prev.map((item, i) => (i === idx ? { ...item, platform: newPlat } : item)));
  };

  const deleteReviewedItem = idx => {
    setReviewedItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAnalyzeReviewed = async () => {
    const valid = reviewedItems.filter(it => it.text.trim());
    if (!valid.length) {
      setUploadErr('No items to analyze. Add or keep at least one non-empty post.');
      return;
    }
    setAnalyzingExtracted(true);
    setUploadErr('');
    try {
      const res = await analyzeBatch(valid);
      setData(res);
      setPosts(valid);
      setReviewedItems([]);
      setFileResults([]);
    } catch (err) {
      setUploadErr(err.message || 'Failed to score extracted posts.');
    } finally {
      setAnalyzingExtracted(false);
    }
  };

  const s = data && data.summary;
  const n = posts.length || 1;
  const c = s ? s.counts : { Positive: 0, Neutral: 0, Negative: 0 };
  const pct = k => Math.round((c[k] / n) * 100);
  const mood = !s ? '' : s.average > 0.05 ? 'Positive' : s.average < -0.05 ? 'Negative' : 'Mixed';

  return (
    <section>
      <div className="head">
        <div>
          <h2>What is the crowd saying?</h2>
          <p>Every post is scored on its own. The summary shows the overall mood, each platform and the hashtags driving it.</p>
        </div>
        <Art html={hashtag()} />
      </div>
      <Err t={err} />
      {!s ? (
        !err && <p style={{ color: 'var(--muted)' }}>Analyzing posts…</p>
      ) : (
        <>
          <div className="panel">
            <div className="verdict">
              <b className={mood === 'Mixed' ? 'neu' : cls(mood)}>{mood} overall</b>
              <span>
                {posts.length} posts · average score {s.average.toFixed(2)}
              </span>
            </div>
            <div className="stack" style={{ marginTop: 16 }}>
              <span style={{ width: pct('Positive') + '%', background: 'var(--pos)' }} />
              <span style={{ width: pct('Neutral') + '%', background: 'var(--neu)' }} />
              <span style={{ width: pct('Negative') + '%', background: 'var(--neg)' }} />
            </div>
            <div className="trio" style={{ marginTop: 14 }}>
              <div>
                <strong className="pos">{c.Positive}</strong>
                <small>Positive</small>
              </div>
              <div>
                <strong className="neu">{c.Neutral}</strong>
                <small>Neutral</small>
              </div>
              <div>
                <strong className="neg">{c.Negative}</strong>
                <small>Negative</small>
              </div>
            </div>
          </div>
          <div className="grid2">
            <div className="panel">
              <h3>By platform</h3>
              {Object.entries(s.by_platform).map(([k, x]) => (
                <div className="bar" key={k}>
                  <span>{k}</span>
                  <div className="stack" style={{ height: 10 }}>
                    <span
                      style={{
                        width: Math.abs(x) * 50 + '%',
                        marginLeft: x < 0 ? 50 - Math.abs(x) * 50 + '%' : '50%',
                        background: `var(--${tone(x)})`,
                      }}
                    />
                  </div>
                  <span>{x.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="panel">
              <h3>Hashtags</h3>
              <div className="tags">
                {s.hashtags.length ? (
                  s.hashtags.map(h => (
                    <span key={h.tag} className={tone(h.avg)}>
                      {h.tag} · {h.count}
                    </span>
                  ))
                ) : (
                  <span style={{ color: 'var(--muted)', border: 0, padding: 0 }}>No hashtags yet.</span>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* File Upload Panel */}
      <div className="panel" style={{ marginTop: 24 }}>
        <h3>Upload files</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 14px' }}>
          Images (.jpg, .jpeg, .png, .webp), Tables (.csv, .tsv, .xlsx), Text (.txt, .json, .pdf) · Max 10 files, 5 MB each
        </p>
        <div
          className={`dropzone ${isDragging ? 'dragover' : ''}`}
          tabIndex={0}
          role="button"
          aria-label="Upload files. Press Enter or Space to browse."
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              multiFileRef.current?.click();
            }
          }}
          onClick={() => multiFileRef.current?.click()}
        >
          <svg className="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div>
            <strong>Drag and drop files here</strong>
            <span style={{ color: 'var(--muted)', fontSize: 13, display: 'block', marginTop: 3 }}>
              or{' '}
              <button
                type="button"
                className="btn ghost"
                style={{ padding: '4px 12px', fontSize: 12.5, margin: '0 4px' }}
                onClick={e => {
                  e.stopPropagation();
                  multiFileRef.current?.click();
                }}
              >
                Browse files
              </button>
            </span>
          </div>
          <input
            id="multi-file-input"
            type="file"
            ref={multiFileRef}
            multiple
            accept=".jpg,.jpeg,.png,.webp,.csv,.tsv,.xlsx,.txt,.json,.pdf"
            className="hide"
            onChange={e => handleFiles(e.target.files)}
            aria-label="Upload files selector"
          />
        </div>

        {filesLoading && (
          <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '12px 0 0' }}>
            Extracting text from files… please wait.
          </p>
        )}

        {uploadErr && <p className="upload-err" role="alert">{uploadErr}</p>}

        {fileResults.length > 0 && (
          <div className="file-badges">
            {fileResults.map((f, i) => (
              <div key={i} className="file-badge">
                {f.previewUrl ? (
                  <img src={f.previewUrl} alt={f.filename} className="file-thumb" />
                ) : (
                  <span style={{ fontWeight: 600, color: 'var(--plum)' }}>[{f.type.toUpperCase()}]</span>
                )}
                <div>
                  <strong>{f.filename}</strong>
                  <small style={{ display: 'block', color: 'var(--muted)' }}>
                    {f.items?.length || 0} {f.items?.length === 1 ? 'item' : 'items'} extracted
                  </small>
                  {f.warnings?.map((w, wi) => (
                    <small key={wi} className="upload-warn" style={{ display: 'block' }}>
                      ⚠ {w}
                    </small>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {reviewedItems.length > 0 && (
          <div className="review-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h4>Review extracted posts ({reviewedItems.length})</h4>
              <small style={{ color: 'var(--muted)' }}>Edit text or change platform before analyzing</small>
            </div>
            <div className="review-list">
              {reviewedItems.map((item, idx) => (
                <div key={idx} className="review-item">
                  <select
                    value={item.platform}
                    onChange={e => updateReviewedPlatform(idx, e.target.value)}
                    aria-label={`Platform for post ${idx + 1}`}
                  >
                    {['X', 'Instagram', 'Reddit', 'Facebook', 'Other'].map(p => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <textarea
                    value={item.text}
                    onChange={e => updateReviewedText(idx, e.target.value)}
                    placeholder="Post text"
                    aria-label={`Content for post ${idx + 1}`}
                  />
                  <button
                    type="button"
                    className="btn-del"
                    onClick={() => deleteReviewedItem(idx)}
                    aria-label={`Delete post ${idx + 1}`}
                    title="Remove post"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="upload-actions" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn"
                disabled={analyzingExtracted}
                onClick={handleAnalyzeReviewed}
              >
                {analyzingExtracted ? 'Analyzing…' : `Analyze ${reviewedItems.length} post${reviewedItems.length === 1 ? '' : 's'}`}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setReviewedItems([]);
                  setFileResults([]);
                  setUploadErr('');
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {data && (
        <div className="feed">
          {data.results.map((r, i) => (
            <article key={i} className={'post ' + pc(r.label)}>
              <small>{r.platform}</small>
              <span className={'tag ' + cls(r.label)}>
                {r.label} · {r.score.toFixed(2)}
              </span>
              <p>{r.text}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                               3. STATS VIEW                                */
/* -------------------------------------------------------------------------- */
function StatsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    stats()
      .then(d => live && setData(d))
      .catch(e => live && setErr(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  if (loading) {
    return (
      <section>
        <div className="head">
          <div>
            <h2>Dashboard Overview</h2>
            <p>Loading your sentiment analytics…</p>
          </div>
        </div>
      </section>
    );
  }

  const total = data?.total || 0;
  const c = data?.counts || { Positive: 0, Neutral: 0, Negative: 0 };
  const avg = data?.average ?? 0;
  const pct = k => (total ? Math.round((c[k] / total) * 100) : 0);

  return (
    <section>
      <div className="head">
        <div>
          <h2>Analytics Dashboard</h2>
          <p>High-level summary of your sentiment performance, overall emotional valence, and historical distribution.</p>
        </div>
      </div>
      <Err t={err} />

      {total === 0 ? (
        <div className="panel empty-card">
          <div className="empty-icon">📊</div>
          <h3>No analyses yet</h3>
          <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '8px auto 20px' }}>
            You haven't recorded any sentiment analyses yet. Start by analyzing single text passages or uploading batch feedback.
          </p>
          <a href="#/app/write" className="btn">
            Analyze your first text
          </a>
        </div>
      ) : (
        <>
          <div className="stats-metric-grid">
            <div className="panel stat-card">
              <span className="stat-label">Total Analyses</span>
              <div className="stat-value">{total}</div>
              <small style={{ color: 'var(--muted)' }}>Recorded in your workspace</small>
            </div>
            <div className="panel stat-card">
              <span className="stat-label">Average Score</span>
              <div className={`stat-value ${avg > 0.05 ? 'pos' : avg < -0.05 ? 'neg' : 'neu'}`}>
                {avg > 0 ? `+${avg.toFixed(2)}` : avg.toFixed(2)}
              </div>
              <small style={{ color: 'var(--muted)' }}>
                Overall valence: <strong>{avg > 0.05 ? 'Positive' : avg < -0.05 ? 'Negative' : 'Neutral'}</strong>
              </small>
            </div>
            <div className="panel stat-card">
              <span className="stat-label">Top Sentiment</span>
              <div className="stat-value">
                {c.Positive >= c.Neutral && c.Positive >= c.Negative
                  ? 'Positive'
                  : c.Negative >= c.Neutral
                  ? 'Negative'
                  : 'Neutral'}
              </div>
              <small style={{ color: 'var(--muted)' }}>
                {Math.max(pct('Positive'), pct('Neutral'), pct('Negative'))}% of analyzed records
              </small>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 24 }}>
            <h3>Sentiment Split</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '4px 0 16px' }}>
              Proportional distribution across all processed items
            </p>
            <div className="stack" style={{ height: 18 }}>
              <span style={{ width: pct('Positive') + '%', background: 'var(--pos)' }} />
              <span style={{ width: pct('Neutral') + '%', background: 'var(--neu)' }} />
              <span style={{ width: pct('Negative') + '%', background: 'var(--neg)' }} />
            </div>
            <div className="trio" style={{ marginTop: 20 }}>
              <div>
                <strong className="pos">{c.Positive}</strong>
                <small>Positive ({pct('Positive')}%)</small>
              </div>
              <div>
                <strong className="neu">{c.Neutral}</strong>
                <small>Neutral ({pct('Neutral')}%)</small>
              </div>
              <div>
                <strong className="neg">{c.Negative}</strong>
                <small>Negative ({pct('Negative')}%)</small>
              </div>
            </div>
          </div>

          <div className="quick-links-grid" style={{ marginTop: 24 }}>
            <a href="#/app/timeline" className="panel quick-link-card">
              <div className="quick-link-head">
                <TimelineIcon />
                <h4>Mood Timeline</h4>
              </div>
              <p>Explore daily sentiment trajectory and rolling changes over the last 30 days.</p>
              <span className="quick-link-arrow">View timeline →</span>
            </a>
            <a href="#/app/themes" className="panel quick-link-card">
              <div className="quick-link-head">
                <ThemesIcon />
                <h4>Key Themes</h4>
              </div>
              <p>Uncover top keywords and recurring hashtags sorted by frequency and emotional weight.</p>
              <span className="quick-link-arrow">Explore themes →</span>
            </a>
            <a href="#/app/history" className="panel quick-link-card">
              <div className="quick-link-head">
                <HistoryIcon />
                <h4>Past Analyses</h4>
              </div>
              <p>Browse full history, search previous entries, and quickly re-run evaluations.</p>
              <span className="quick-link-arrow">Browse history →</span>
            </a>
          </div>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              4. TIMELINE VIEW                              */
/* -------------------------------------------------------------------------- */
function TimelineView() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    let live = true;
    trends(30)
      .then(d => live && setData(Array.isArray(d) ? d : []))
      .catch(e => live && setErr(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  if (loading) {
    return (
      <section>
        <div className="head">
          <div>
            <h2>Mood Timeline</h2>
            <p>Loading timeline data…</p>
          </div>
        </div>
      </section>
    );
  }

  // Construct SVG points
  const W = 760;
  const H = 220;
  const padX = 50;
  const padY = 30;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;
  const midY = padY + plotH / 2; // 0.0 baseline

  const pts = data.map((d, i) => {
    const x = data.length === 1 ? padX + plotW / 2 : padX + (i / (data.length - 1)) * plotW;
    // score is -1 to +1: y goes from midY - 80 (+1) to midY + 80 (-1)
    const y = midY - (d.avg * (plotH / 2));
    return { ...d, x, y };
  });

  const polylineStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaStr = pts.length > 0
    ? `${pts[0].x},${midY} ${polylineStr} ${pts[pts.length - 1].x},${midY}`
    : '';

  return (
    <section>
      <div className="head">
        <div>
          <h2>Mood Timeline</h2>
          <p>Average daily sentiment score tracked across the past 30 days. Baseline 0.0 denotes neutral tone.</p>
        </div>
      </div>
      <Err t={err} />

      {data.length === 0 ? (
        <div className="panel empty-card">
          <div className="empty-icon">📈</div>
          <h3>No timeline entries</h3>
          <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '8px auto 20px' }}>
            There are no recorded analyses in the last 30 days. Run your first text or feedback analysis to start tracking the timeline.
          </p>
          <a href="#/app/write" className="btn">
            Analyze text now
          </a>
        </div>
      ) : (
        <>
          <div className="panel timeline-chart-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>30-Day Sentiment Trajectory</h3>
              {hovered ? (
                <div className="chart-tooltip-badge">
                  <strong>{hovered.date}</strong>: Score{' '}
                  <span className={tone(hovered.avg)}>
                    {hovered.avg > 0 ? `+${hovered.avg.toFixed(2)}` : hovered.avg.toFixed(2)}
                  </span>{' '}
                  ({hovered.count} {hovered.count === 1 ? 'analysis' : 'analyses'})
                </div>
              ) : (
                <small style={{ color: 'var(--muted)' }}>Hover over a point to inspect details</small>
              )}
            </div>

            <div className="svg-chart-wrap">
              <svg viewBox={`0 0 ${W} ${H}`} className="timeline-svg" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A39A" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#C9A39A" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-guidelines */}
                <line x1={padX} y1={padY} x2={W - padX} y2={padY} stroke="var(--line)" strokeDasharray="4 4" />
                <text x={padX - 10} y={padY + 4} textAnchor="end" fill="var(--muted)" fontSize="11">+1.0</text>

                <line x1={padX} y1={midY} x2={W - padX} y2={midY} stroke="var(--line)" strokeWidth="1.5" />
                <text x={padX - 10} y={midY + 4} textAnchor="end" fill="var(--muted)" fontSize="11">0.0</text>

                <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="var(--line)" strokeDasharray="4 4" />
                <text x={padX - 10} y={H - padY + 4} textAnchor="end" fill="var(--muted)" fontSize="11">-1.0</text>

                {/* Shaded Area */}
                {pts.length > 1 && <polygon points={areaStr} fill="url(#timelineGrad)" />}

                {/* Trend line */}
                {pts.length > 1 ? (
                  <polyline
                    fill="none"
                    stroke="#C9A39A"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylineStr}
                  />
                ) : null}

                {/* Data points */}
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={hovered?.date === p.date ? 6.5 : 4.5}
                      fill="#FAF6F4"
                      stroke={tone(p.avg) === 'pos' ? 'var(--pos)' : tone(p.avg) === 'neg' ? 'var(--neg)' : 'var(--neu)'}
                      strokeWidth="2.5"
                      style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                      onMouseEnter={() => setHovered(p)}
                      onMouseLeave={() => setHovered(null)}
                    />
                  </g>
                ))}
              </svg>
            </div>

            <div className="chart-legend-row">
              <span className="dot-guide"><i style={{ background: 'var(--pos)' }} /> Positive</span>
              <span className="dot-guide"><i style={{ background: 'var(--neu)' }} /> Neutral</span>
              <span className="dot-guide"><i style={{ background: 'var(--neg)' }} /> Negative</span>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 24 }}>
            <h3>Daily Sentiment Log</h3>
            <div className="timeline-grid">
              {data.map(d => (
                <div key={d.date} className="timeline-day-card">
                  <div className="timeline-day-date">{d.date}</div>
                  <span className={'tag ' + (d.avg > 0.05 ? 'pos' : d.avg < -0.05 ? 'neg' : 'neu')}>
                    {d.avg > 0 ? `+${d.avg.toFixed(2)}` : d.avg.toFixed(2)} · {d.avg > 0.05 ? 'Positive' : d.avg < -0.05 ? 'Negative' : 'Neutral'}
                  </span>
                  <small style={{ color: 'var(--muted)', marginTop: 4 }}>
                    {d.count} {d.count === 1 ? 'analysis' : 'analyses'}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                               5. THEMES VIEW                               */
/* -------------------------------------------------------------------------- */
function ThemesView({ onSelectTerm }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    topics()
      .then(d => live && setItems(Array.isArray(d) ? d : []))
      .catch(e => live && setErr(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  if (loading) {
    return (
      <section>
        <div className="head">
          <div>
            <h2>Key Themes</h2>
            <p>Extracting recurring keywords and topics…</p>
          </div>
        </div>
      </section>
    );
  }

  const filtered = items.filter(it => {
    if (filter === 'hashtags') return it.term.startsWith('#');
    if (filter === 'keywords') return !it.term.startsWith('#');
    return true;
  });

  return (
    <section>
      <div className="head">
        <div>
          <h2>Key Themes & Topics</h2>
          <p>Recurring topics, hashtags, and keywords identified across your analyzed corpus with associated emotional valence.</p>
        </div>
      </div>
      <Err t={err} />

      {items.length === 0 ? (
        <div className="panel empty-card">
          <div className="empty-icon">🏷️</div>
          <h3>No recurring themes yet</h3>
          <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '8px auto 20px' }}>
            Run text analyses or social scans to extract keywords and hashtags automatically.
          </p>
          <a href="#/app/write" className="btn">
            Analyze text
          </a>
        </div>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Filter:</span>
              <button
                type="button"
                className={`chip ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                className={`chip ${filter === 'hashtags' ? 'active' : ''}`}
                onClick={() => setFilter('hashtags')}
              >
                Hashtags ({items.filter(x => x.term.startsWith('#')).length})
              </button>
              <button
                type="button"
                className={`chip ${filter === 'keywords' ? 'active' : ''}`}
                onClick={() => setFilter('keywords')}
              >
                Keywords ({items.filter(x => !x.term.startsWith('#')).length})
              </button>
            </div>
          </div>

          <div className="theme-grid">
            {filtered.map(t => (
              <div key={t.term} className="panel theme-card">
                <div className="theme-header">
                  <strong className="theme-name">{t.term}</strong>
                  <span className="theme-type-pill">{t.term.startsWith('#') ? 'Hashtag' : 'Keyword'}</span>
                </div>
                <div className="theme-body">
                  <span className={'tag ' + tone(t.avg)}>
                    {t.avg > 0 ? `+${t.avg.toFixed(2)}` : t.avg.toFixed(2)} · {t.avg > 0.05 ? 'Positive' : t.avg < -0.05 ? 'Negative' : 'Neutral'}
                  </span>
                  <small style={{ color: 'var(--muted)' }}>
                    {t.count} {t.count === 1 ? 'mention' : 'mentions'}
                  </small>
                </div>
                {onSelectTerm && (
                  <button
                    type="button"
                    className="theme-try-btn"
                    onClick={() => onSelectTerm(t.term)}
                    title={`Test "${t.term}" in Write & Score`}
                  >
                    Test in Write & Score →
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                               6. HISTORY VIEW                              */
/* -------------------------------------------------------------------------- */
function HistoryView({ onReRun }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    history(100)
      .then(d => live && setItems(Array.isArray(d) ? d : []))
      .catch(e => live && setErr(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  if (loading) {
    return (
      <section>
        <div className="head">
          <div>
            <h2>Past Analyses</h2>
            <p>Loading historical records…</p>
          </div>
        </div>
      </section>
    );
  }

  const filtered = items.filter(it => {
    const matchSearch = !search.trim() || it.text.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || it.label === filter;
    return matchSearch && matchFilter;
  });

  return (
    <section>
      <div className="head">
        <div>
          <h2>Past Analyses</h2>
          <p>Complete record of your text analyses. Click any record or choose "Re-run" to test it again in Write & Score.</p>
        </div>
      </div>
      <Err t={err} />

      {items.length === 0 ? (
        <div className="panel empty-card">
          <div className="empty-icon">📜</div>
          <h3>No past analyses recorded</h3>
          <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '8px auto 20px' }}>
            Analyses you run while signed in are recorded here automatically.
          </p>
          <a href="#/app/write" className="btn">
            Analyze text
          </a>
        </div>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="history-search-row">
              <input
                type="text"
                placeholder="Search history by keyword or phrase…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ maxWidth: 360 }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`chip ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All ({items.length})
                </button>
                <button
                  type="button"
                  className={`chip ${filter === 'Positive' ? 'active' : ''}`}
                  onClick={() => setFilter('Positive')}
                >
                  Positive ({items.filter(x => x.label === 'Positive').length})
                </button>
                <button
                  type="button"
                  className={`chip ${filter === 'Neutral' ? 'active' : ''}`}
                  onClick={() => setFilter('Neutral')}
                >
                  Neutral ({items.filter(x => x.label === 'Neutral').length})
                </button>
                <button
                  type="button"
                  className={`chip ${filter === 'Negative' ? 'active' : ''}`}
                  onClick={() => setFilter('Negative')}
                >
                  Negative ({items.filter(x => x.label === 'Negative').length})
                </button>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)' }}>
              No analyses matching "{search}".
            </div>
          ) : (
            <div className="history-full-list">
              {filtered.map(h => (
                <div key={h.id} className="panel history-full-card">
                  <div className="history-card-top">
                    <span className={'tag ' + cls(h.label)}>
                      {h.label} · {h.score > 0 ? `+${h.score.toFixed(2)}` : h.score.toFixed(2)}
                    </span>
                    <small style={{ color: 'var(--muted)' }}>
                      {h.created_at ? new Date(h.created_at).toLocaleString() : `Record #${h.id}`}
                    </small>
                  </div>
                  <p className="history-full-text">{h.text}</p>
                  <div className="history-card-footer">
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ padding: '6px 14px', fontSize: 13 }}
                      onClick={() => onReRun(h.text)}
                    >
                      Re-run in Write & Score →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                7. HELP VIEW                                */
/* -------------------------------------------------------------------------- */
function HelpView() {
  return (
    <section>
      <div className="head">
        <div>
          <h2>How Sentiment Pulse Works</h2>
          <p>A reference guide to our sentiment scoring scale, polarity algorithms, booster detection, and file extraction.</p>
        </div>
      </div>

      <div className="help-grid">
        <div className="panel help-card">
          <div className="help-icon-wrap">📏</div>
          <h3>The Compound Score Scale</h3>
          <p>
            Every text snippet receives a normalized compound score ranging between <strong>−1.00</strong> (most negative)
            and <strong>+1.00</strong> (most positive).
          </p>
          <div className="help-scale-meter">
            <div className="scale-bar" />
            <div className="scale-labels">
              <span>−1.00 Extreme Neg</span>
              <span>−0.05 Threshold</span>
              <span>0.00 Neutral</span>
              <span>+0.05 Threshold</span>
              <span>+1.00 Extreme Pos</span>
            </div>
          </div>
          <ul className="help-list">
            <li><strong>Positive</strong>: Score &gt; +0.05</li>
            <li><strong>Neutral</strong>: −0.05 ≤ Score ≤ +0.05</li>
            <li><strong>Negative</strong>: Score &lt; −0.05</li>
          </ul>
        </div>

        <div className="panel help-card">
          <div className="help-icon-wrap">⚡</div>
          <h3>Emotional Valence & Boosters</h3>
          <p>
            Individual words possess an intrinsic valence rating based on gold-standard linguistic lexicons. The engine also parses syntactic context:
          </p>
          <ul className="help-list">
            <li><strong>Punctuation Amplifiers</strong>: Exclamation marks (e.g. <code>"superb!"</code>) increase intensity.</li>
            <li><strong>Capitalization Boost</strong>: ALL-CAPS words (e.g. <code>"AMAZING"</code>) increase emotional weight.</li>
            <li><strong>Negation Handlers</strong>: Words like <em>not</em>, <em>never</em>, or <em>hardly</em> reverse the polarity of adjacent phrases.</li>
          </ul>
        </div>

        <div className="panel help-card">
          <div className="help-icon-wrap">🤖</div>
          <h3>Dual Scoring Architecture</h3>
          <p>
            Sentiment Pulse supports dual analysis backends to balance real-time responsiveness with deep semantic context:
          </p>
          <ul className="help-list">
            <li><strong>Rule-Based VADER Engine</strong>: Highly tuned for social media, emoticons, acronyms, and informal web feedback. Runs in sub-millisecond time.</li>
            <li><strong>Transformer Models</strong>: Fine-tuned multi-layer attention models for nuanced long-form essays, formal correspondence, and contextual irony.</li>
          </ul>
        </div>

        <div className="panel help-card">
          <div className="help-icon-wrap">📁</div>
          <h3>Multi-Format Document Ingestion</h3>
          <p>
            Extract text from almost any format before scoring:
          </p>
          <ul className="help-list">
            <li><strong>Screenshots & Images</strong>: High-accuracy OCR extracts review and comment texts while stripping app UI chrome.</li>
            <li><strong>Spreadsheets</strong>: CSV, TSV, and Excel files up to 1,000 rows.</li>
            <li><strong>Text & PDFs</strong>: Plain text documents, JSON feeds, and PDF reports.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              SIDEBAR COMPONENT                             */
/* -------------------------------------------------------------------------- */
const NAV_GROUPS = [
  {
    title: 'CREATE',
    items: [
      { id: 'write', label: 'Write & Score', icon: EditIcon, path: '#/app/write' },
      { id: 'feed', label: 'Feed Scanner', icon: FeedIcon, path: '#/app/feed' },
    ],
  },
  {
    title: 'DISCOVER',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, path: '#/app/dashboard' },
      { id: 'timeline', label: 'Mood Timeline', icon: TimelineIcon, path: '#/app/timeline' },
      { id: 'themes', label: 'Key Themes', icon: ThemesIcon, path: '#/app/themes' },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { id: 'history', label: 'Past Analyses', icon: HistoryIcon, path: '#/app/history' },
      { id: 'help', label: 'How It Works', icon: HelpIcon, path: '#/app/help' },
    ],
  },
];

function Sidebar({ currentSubpath, onNavigate, user, onCloseMobile }) {
  const initial = (user?.name || user?.email || 'User').charAt(0).toUpperCase();
  const displayName = (user?.name || 'USER').toUpperCase();
  const displayEmail = user?.email || 'Signed in';

  return (
    <aside className="rail">
      <div className="rail-top">
        <a href="#/app/write" className="brand-wrap" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Logo size={20} />
        </a>
        {onCloseMobile && (
          <button type="button" className="drawer-close-btn" onClick={onCloseMobile} aria-label="Close menu">
            <CloseIcon />
          </button>
        )}
      </div>

      <nav className="rail-nav">
        {NAV_GROUPS.map(grp => (
          <div key={grp.title} className="nav-group">
            <div className="nav-group-title">{grp.title}</div>
            <div className="nav-group-items">
              {grp.items.map(item => {
                const Icon = item.icon;
                const isActive = currentSubpath === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onNavigate(item.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                  >
                    <Icon className="nav-btn-icon" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="rail-footer">
        <div className="user-profile-card">
          <div className="user-avatar" title={displayName}>
            {initial}
          </div>
          <div className="user-info">
            <span className="user-name">{displayName}</span>
            <span className="user-email" title={displayEmail}>{displayEmail}</span>
          </div>
          <button
            type="button"
            className="btn-logout"
            onClick={() => logout()}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*                            MAIN DASHBOARD PAGE                             */
/* -------------------------------------------------------------------------- */
export default function Dashboard({ subpath = 'write' }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [writeSeedText, setWriteSeedText] = useState(null);
  const [user, setUser] = useState(getUser());

  useEffect(() => {
    setUser(getUser());
  }, []);

  const handleNavigate = id => {
    window.location.hash = `#/app/${id}`;
  };

  const handleReRunInWrite = text => {
    setWriteSeedText(text);
    window.location.hash = '#/app/write';
  };

  const currentView = subpath || 'write';

  return (
    <div className="pg-dashboard">
      {/* Mobile Top Header (<920px) */}
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <div className="mobile-brand">
          <Logo size={19} />
        </div>
        <div className="mobile-user-avatar">
          {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
        </div>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {mobileOpen && (
        <div
          className="drawer-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={`app ${mobileOpen ? 'mobile-drawer-open' : ''}`}>
        {/* Desktop Sidebar & Mobile Drawer */}
        <Sidebar
          currentSubpath={currentView}
          onNavigate={handleNavigate}
          user={user}
          onCloseMobile={mobileOpen ? () => setMobileOpen(false) : null}
        />

        <main>
          <div className="dash-container">
            {currentView === 'write' && (
              <WriteView
                initialText={writeSeedText}
                onReRunHandled={() => setWriteSeedText(null)}
              />
            )}
            {currentView === 'feed' && <FeedView />}
            {currentView === 'dashboard' && <StatsView />}
            {currentView === 'timeline' && <TimelineView />}
            {currentView === 'themes' && (
              <ThemesView
                onSelectTerm={term => handleReRunInWrite(`This review is regarding ${term} and customer support.`)}
              />
            )}
            {currentView === 'history' && (
              <HistoryView onReRun={handleReRunInWrite} />
            )}
            {currentView === 'help' && <HelpView />}
          </div>
        </main>
      </div>
    </div>
  );
}
