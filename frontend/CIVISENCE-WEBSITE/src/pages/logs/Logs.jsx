import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LogsLayout from '../../components/Layout/LogsLayout';
import StatsCard from '../../components/StatsCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getAiLogsOverview, getAiRecentLogs, getLogsOverview, getRecentLogs } from '../../api/logs';
import { getErrorMessage, formatTimeAgo } from '../../utils/helpers';
import './Logs.css';
import {
    HiOutlineBolt,
    HiOutlineServer,
    HiOutlineClock,
    HiOutlineExclamationTriangle,
    HiOutlineShieldExclamation,
    HiOutlineUsers,
    HiOutlineArrowDownTray,
    HiOutlineDevicePhoneMobile,
    HiOutlineGlobeAlt,
    HiOutlineCpuChip
} from 'react-icons/hi2';

const REFRESH_INTERVAL_MS = 10000;
const AI_BACKOFF_MS = 60000;

const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(Number(value || 0));
const formatValue = (value, suffix = '') => (value === null || value === undefined || value === ''
    ? 'n/a'
    : `${value}${suffix}`);
const formatDevice = (device) => {
    const vendor = device?.vendor || '';
    const product = device?.productName || '';
    const value = `${vendor} ${product}`.trim();
    return value || 'n/a';
};

const toStatusBadge = (statusCode) => {
    if (!statusCode) return 'neutral';
    if (statusCode >= 500) return 'danger';
    if (statusCode >= 400) return 'warn';
    if (statusCode >= 300) return 'info';
    return 'success';
};

const toLevelBadge = (level = '') => {
    const normalized = String(level || '').toUpperCase();
    if (normalized === 'ERROR' || normalized === 'CRITICAL') return 'danger';
    if (normalized === 'WARNING') return 'warn';
    if (normalized === 'INFO') return 'info';
    return 'neutral';
};

const typeLabel = (type = '') =>
    String(type || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function Logs() {
    const [overview, setOverview] = useState(null);
    const [recentLogs, setRecentLogs] = useState([]);
    const [aiOverview, setAiOverview] = useState(null);
    const [aiLogs, setAiLogs] = useState([]);
    const [showBackend, setShowBackend] = useState(true);
    const [showAi, setShowAi] = useState(true);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [aiError, setAiError] = useState('');
    const isMountedRef = useRef(true);
    const refreshCountRef = useRef(0);
    const aiSkipUntilRef = useRef(0);

    const loadData = useCallback(async ({
        silent = false,
        includeAi = true,
        includeBackend = true
    } = {}) => {
        if (!silent && isMountedRef.current) {
            setLoading(true);
        }
        try {
            const shouldIncludeAi = includeAi && Date.now() >= aiSkipUntilRef.current;
            const tasks = [];

            if (includeBackend) {
                tasks.push(
                    { key: 'overview', promise: getLogsOverview() },
                    { key: 'recent', promise: getRecentLogs({ type: filter, limit: 80 }) }
                );
            }

            if (shouldIncludeAi) {
                tasks.push(
                    { key: 'aiOverview', promise: getAiLogsOverview() },
                    { key: 'aiRecent', promise: getAiRecentLogs({ limit: 80 }) }
                );
            }

            const results = await Promise.allSettled(tasks.map((task) => task.promise));
            const outcome = tasks.reduce((acc, task, index) => {
                acc[task.key] = results[index];
                return acc;
            }, {});

            if (!isMountedRef.current) return;

            if (includeBackend) {
                if (outcome.overview?.status === 'fulfilled' && outcome.recent?.status === 'fulfilled') {
                    setOverview(outcome.overview.value.data.data);
                    setRecentLogs(outcome.recent.value.data.data || []);
                    setError('');
                } else {
                    const failed = outcome.overview?.status === 'rejected'
                        ? outcome.overview.reason
                        : outcome.recent?.reason;
                    setError(getErrorMessage(failed));
                }
            } else {
                setError('');
            }

            if (shouldIncludeAi && outcome.aiOverview) {
                if (outcome.aiOverview.status === 'fulfilled') {
                    setAiOverview(outcome.aiOverview.value.data.data);
                    setAiError('');
                    aiSkipUntilRef.current = 0;
                } else {
                    setAiError(getErrorMessage(outcome.aiOverview.reason));
                    aiSkipUntilRef.current = Date.now() + AI_BACKOFF_MS;
                }
            }

            if (shouldIncludeAi && outcome.aiRecent) {
                if (outcome.aiRecent.status === 'fulfilled') {
                    setAiLogs(outcome.aiRecent.value.data.data?.items || []);
                    aiSkipUntilRef.current = 0;
                } else {
                    setAiLogs([]);
                    setAiError(getErrorMessage(outcome.aiRecent.reason));
                    aiSkipUntilRef.current = Date.now() + AI_BACKOFF_MS;
                }
            }
        } catch (err) {
            if (!isMountedRef.current) return;
            if (includeBackend) {
                setError(getErrorMessage(err));
            }
        } finally {
            if (!silent && isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [filter]);

    useEffect(() => {
        isMountedRef.current = true;
        refreshCountRef.current = 0;
        void loadData({ includeAi: showAi, includeBackend: showBackend });
        const intervalId = window.setInterval(() => {
            refreshCountRef.current += 1;
            const includeAi = showAi && refreshCountRef.current % 2 === 0;
            void loadData({ silent: true, includeAi, includeBackend: showBackend });
        }, REFRESH_INTERVAL_MS);

        const onWindowFocus = () => {
            refreshCountRef.current = 0;
            void loadData({ silent: true, includeAi: showAi, includeBackend: showBackend });
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshCountRef.current = 0;
                void loadData({ silent: true, includeAi: showAi, includeBackend: showBackend });
            }
        };

        window.addEventListener('focus', onWindowFocus);
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            isMountedRef.current = false;
            window.clearInterval(intervalId);
            window.removeEventListener('focus', onWindowFocus);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [loadData, showAi, showBackend]);

    const traffic = overview?.traffic || {};
    const users = overview?.users || {};
    const rateLimit = overview?.rateLimit || {};
    const clientEvents = overview?.clientEvents || {};
    const clients = overview?.clients || {};

    const appDownloads = clientEvents?.counts?.app_download || 0;
    const webLogs = clients?.bySource?.web || 0;
    const mobileLogs = clients?.bySource?.mobile || 0;

    const statusBreakdown = useMemo(() => {
        const map = traffic?.byStatusClass || {};
        return Object.entries(map).map(([key, value]) => ({
            label: key.toUpperCase(),
            value
        }));
    }, [traffic?.byStatusClass]);

    const topPaths = traffic?.topPaths || [];
    const topIps = clients?.topIps || [];
    const topUserAgents = clients?.topUserAgents || [];
    const backendSystem = overview?.system || null;
    const aiSystem = aiOverview?.system || null;
    const aiRuntime = aiOverview?.runtime || null;
    const aiPendingCount = aiOverview?.pendingCount ?? null;
    const aiProcessedCounts = aiOverview?.processedCounts || null;
    const backendIsWindows = backendSystem?.platform === 'win32';
    const backendLoadAvg = Array.isArray(backendSystem?.loadAvg) ? backendSystem.loadAvg : [];
    const backendUseLoad = !backendIsWindows && backendLoadAvg.length > 0;
    const backendLoadValue = backendUseLoad
        ? backendLoadAvg.join(' / ')
        : backendSystem?.cpuUsagePct != null
            ? `${backendSystem.cpuUsagePct}%`
            : 'n/a';
    const backendLoadLabel = backendUseLoad ? 'Load Avg' : 'CPU Usage';
    const aiPlatformRaw = String(aiSystem?.platform || '');
    const aiIsWindows = aiPlatformRaw.toLowerCase().startsWith('win');
    const aiLoadAvg = Array.isArray(aiSystem?.loadAvg) ? aiSystem.loadAvg : [];
    const aiUseLoad = !aiIsWindows && aiLoadAvg.length > 0;
    const aiLoadValue = aiUseLoad
        ? aiLoadAvg.join(' / ')
        : aiSystem?.cpuUsagePct != null
            ? `${aiSystem.cpuUsagePct}%`
            : 'n/a';
    const aiLoadLabel = aiUseLoad ? 'Load Avg' : 'CPU Usage';
    const backendOsLabel = backendSystem?.osRelease?.prettyName
        ? backendSystem.osRelease.prettyName
        : backendSystem
            ? `${backendSystem.platform} ${backendSystem.release}`
            : 'n/a';
    const aiOsLabel = aiSystem?.osRelease?.prettyName
        ? aiSystem.osRelease.prettyName
        : aiSystem
            ? `${aiSystem.platform} ${aiSystem.release}`
            : 'n/a';
    const backendSpecs = [
        { label: 'Host', value: backendSystem?.hostname ?? 'n/a' },
        { label: 'OS', value: backendOsLabel },
        { label: 'OS ID', value: backendSystem?.osRelease?.id ?? 'n/a' },
        { label: 'OS Version', value: backendSystem?.osRelease?.version ?? 'n/a' },
        { label: 'Kernel', value: backendSystem?.release ?? 'n/a' },
        { label: 'Arch', value: backendSystem?.arch ?? 'n/a' },
        { label: 'Cloud', value: backendSystem?.device?.cloudProvider || 'n/a' },
        { label: 'Device', value: formatDevice(backendSystem?.device) },
        { label: 'BIOS', value: backendSystem?.device?.biosVersion ?? 'n/a' },
        { label: 'CPU', value: backendSystem?.cpuModel || 'n/a' },
        { label: 'CPU Speed', value: backendSystem?.cpuSpeedMHz != null ? `${backendSystem.cpuSpeedMHz} MHz` : 'n/a' },
        { label: 'Cores', value: backendSystem?.cpuCount != null ? formatNumber(backendSystem.cpuCount) : 'n/a' },
        { label: backendLoadLabel, value: backendLoadValue },
        backendUseLoad ? { label: 'CPU Usage', value: formatValue(backendSystem?.cpuUsagePct, '%') } : null,
        { label: 'Memory Used', value: formatValue(backendSystem?.memUsedMB, ' MB') },
        { label: 'Memory Free', value: formatValue(backendSystem?.memFreeMB, ' MB') },
        { label: 'Memory Total', value: formatValue(backendSystem?.memTotalMB, ' MB') },
        { label: 'Memory Used %', value: formatValue(backendSystem?.memUsedPct, '%') },
        { label: 'Process RSS', value: formatValue(overview?.memory?.rssMB, ' MB') },
        { label: 'Uptime', value: formatValue(backendSystem?.uptimeSec, 's') }
    ].filter(Boolean);
    const aiSpecs = [
        { label: 'Host', value: aiSystem?.hostname ?? 'n/a' },
        { label: 'OS', value: aiOsLabel },
        { label: 'OS ID', value: aiSystem?.osRelease?.id ?? 'n/a' },
        { label: 'OS Version', value: aiSystem?.osRelease?.version ?? 'n/a' },
        { label: 'Kernel', value: aiSystem?.release ?? 'n/a' },
        { label: 'Arch', value: aiSystem?.machine ?? 'n/a' },
        { label: 'Cloud', value: aiSystem?.device?.cloudProvider || 'n/a' },
        { label: 'Device', value: formatDevice(aiSystem?.device) },
        { label: 'BIOS', value: aiSystem?.device?.biosVersion ?? 'n/a' },
        { label: 'CPU', value: aiSystem?.cpuModel || 'n/a' },
        { label: 'CPU Speed', value: aiSystem?.cpuSpeedMHz != null ? `${aiSystem.cpuSpeedMHz} MHz` : 'n/a' },
        { label: 'Cores', value: aiSystem?.cpuCount != null ? formatNumber(aiSystem.cpuCount) : 'n/a' },
        { label: aiLoadLabel, value: aiLoadValue },
        aiUseLoad ? { label: 'CPU Usage', value: formatValue(aiSystem?.cpuUsagePct, '%') } : null,
        { label: 'Memory Used', value: formatValue(aiSystem?.memUsedMB, ' MB') },
        { label: 'Memory Free', value: formatValue(aiSystem?.memFreeMB, ' MB') },
        { label: 'Memory Total', value: formatValue(aiSystem?.memTotalMB, ' MB') },
        { label: 'Memory Used %', value: formatValue(aiSystem?.memUsedPct, '%') },
        { label: 'Process RSS', value: formatValue(aiSystem?.processRssMB, ' MB') },
        { label: 'Uptime', value: formatValue(aiSystem?.uptimeSec, 's') }
    ].filter(Boolean);

    const aiLevelBreakdown = useMemo(() => {
        const map = aiOverview?.levelCounts || {};
        return Object.entries(map).map(([level, count]) => ({
            level,
            count
        }));
    }, [aiOverview?.levelCounts]);

    if (loading) return <LogsLayout><LoadingSpinner fullPage /></LogsLayout>;

    const lastUpdated = overview?.generatedAt ? new Date(overview.generatedAt).toLocaleString() : 'Live';
    const aiStartedAt = aiOverview?.startedAt ? new Date(aiOverview.startedAt).toLocaleString() : 'n/a';

    return (
        <LogsLayout>
            <div className="logs-page">
                <div className="logs-toggle-bar">
                    <span className="logs-toggle-bar__label">Sources</span>
                    <button
                        type="button"
                        className={`logs-toggle ${showBackend ? 'active' : ''}`}
                        onClick={() => setShowBackend((prev) => !prev)}
                    >
                        Backend
                    </button>
                    <button
                        type="button"
                        className={`logs-toggle ${showAi ? 'active' : ''}`}
                        onClick={() => setShowAi((prev) => !prev)}
                    >
                        AI Service
                    </button>
                </div>

                {!showBackend && !showAi && (
                    <div className="card logs-empty">
                        <h3>No sources selected</h3>
                        <p>Enable Backend or AI Service to view logs.</p>
                    </div>
                )}

                {showBackend && error && (
                    <div className="auth-error">{error}</div>
                )}

                {showBackend && (
                <section className="logs-hero">
                    <div className="logs-hero__content">
                        <div>
                            <span className="section-tag">Live Ops</span>
                            <h1>System Logs & Real-Time Telemetry</h1>
                            <p>
                                Unified stream of backend requests, rate limits, and client activity. Auto refreshes every 10 seconds.
                            </p>
                        </div>
                        <div className="logs-hero__meta">
                            <div className="logs-hero__pill">
                                <span className="logs-hero__dot" /> Live
                            </div>
                            <span className="logs-hero__time">Last updated: {lastUpdated}</span>
                        </div>
                    </div>
                    <div className="logs-hero__grid">
                        <StatsCard icon={<HiOutlineServer />} label="Total Requests" value={formatNumber(traffic.totalRequests)} color="primary" />
                        <StatsCard icon={<HiOutlineBolt />} label="Req / Min" value={formatNumber(traffic.requestsLastMinute)} color="info" />
                        <StatsCard icon={<HiOutlineClock />} label="Avg Response" value={`${traffic.avgResponseMs || 0} ms`} color="warning" />
                        <StatsCard icon={<HiOutlineExclamationTriangle />} label="Errors" value={formatNumber(overview?.errors?.total)} color="danger" />
                        <StatsCard icon={<HiOutlineShieldExclamation />} label="Rate Limited" value={formatNumber(rateLimit.total)} color="danger" />
                        <StatsCard icon={<HiOutlineUsers />} label="Active Clients" value={formatNumber(clients.activeLast5Minutes)} color="success" />
                    </div>
                </section>
                )}

                {showBackend && (
                <section className="logs-kpi-grid">
                    <div className="card logs-kpi">
                        <div className="logs-kpi__header">
                            <h3>Download Signals</h3>
                            <span className="logs-kpi__tag">Web + Mobile</span>
                        </div>
                        <div className="logs-kpi__value">{formatNumber(appDownloads)}</div>
                        <p>Total Android download clicks recorded.</p>
                        <div className="logs-kpi__meta">
                            <span><HiOutlineArrowDownTray /> App downloads</span>
                        </div>
                    </div>

                    <div className="card logs-kpi">
                        <div className="logs-kpi__header">
                            <h3>Client Sources</h3>
                            <span className="logs-kpi__tag">Live</span>
                        </div>
                        <div className="logs-kpi__split">
                            <div>
                                <span className="logs-kpi__label"><HiOutlineGlobeAlt /> Web</span>
                                <strong>{formatNumber(webLogs)}</strong>
                            </div>
                            <div>
                                <span className="logs-kpi__label"><HiOutlineDevicePhoneMobile /> Mobile</span>
                                <strong>{formatNumber(mobileLogs)}</strong>
                            </div>
                        </div>
                        <p>Counts of client-side log events by platform.</p>
                    </div>

                    <div className="card logs-kpi">
                        <div className="logs-kpi__header">
                            <h3>Security & Users</h3>
                            <span className="logs-kpi__tag">Accounts</span>
                        </div>
                        <div className="logs-kpi__split">
                            <div>
                                <span className="logs-kpi__label">Total Users</span>
                                <strong>{formatNumber(users.total)}</strong>
                            </div>
                            <div>
                                <span className="logs-kpi__label">Blacklisted</span>
                                <strong>{formatNumber(users.blacklisted)}</strong>
                            </div>
                        </div>
                        <p>Includes {formatNumber(users.blacklistedRecords)} active blacklist records.</p>
                    </div>

                    <div className="card logs-kpi">
                        <div className="logs-kpi__header">
                            <h3>Active Throughput</h3>
                            <span className="logs-kpi__tag">Last 5 mins</span>
                        </div>
                        <div className="logs-kpi__value">{formatNumber(traffic.requestsLast5Minutes)}</div>
                        <p>Requests observed in the last 5 minutes.</p>
                        <div className="logs-kpi__meta">
                            <span><HiOutlineCpuChip /> Active: {formatNumber(traffic.activeRequests)}</span>
                        </div>
                    </div>
                </section>
                )}

                {showBackend && (
                <section className="logs-panel-grid">
                    <div className="card logs-panel">
                        <div className="logs-panel__header">
                            <h3>Status Mix</h3>
                            <span className="logs-panel__meta">HTTP class breakdown</span>
                        </div>
                        <div className="logs-panel__rows">
                            {statusBreakdown.map((item) => (
                                <div key={item.label} className="logs-panel__row">
                                    <span>{item.label}</span>
                                    <strong>{formatNumber(item.value)}</strong>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card logs-panel">
                        <div className="logs-panel__header">
                            <h3>Rate Limit Pulse</h3>
                            <span className="logs-panel__meta">Protection layer</span>
                        </div>
                        <div className="logs-panel__rows">
                            <div className="logs-panel__row">
                                <span>Total blocked</span>
                                <strong>{formatNumber(rateLimit.total)}</strong>
                            </div>
                            <div className="logs-panel__row">
                                <span>Last 5 minutes</span>
                                <strong>{formatNumber(rateLimit.last5Minutes)}</strong>
                            </div>
                        </div>
                        <p className="logs-panel__note">Rate limits are enforced globally on the API gateway.</p>
                    </div>

                    <div className="card logs-panel">
                        <div className="logs-panel__header">
                            <h3>System Memory</h3>
                            <span className="logs-panel__meta">Node process</span>
                        </div>
                        <div className="logs-panel__rows">
                            <div className="logs-panel__row">
                                <span>Heap Used</span>
                                <strong>{overview?.memory?.heapUsedMB} MB</strong>
                            </div>
                            <div className="logs-panel__row">
                                <span>RSS</span>
                                <strong>{overview?.memory?.rssMB} MB</strong>
                            </div>
                        </div>
                    </div>
                </section>
                )}

                {showBackend && (
                <section className="logs-panel-grid logs-panel-grid--insights">
                    <div className="card logs-panel">
                        <div className="logs-panel__header">
                            <h3>Top Paths</h3>
                            <span className="logs-panel__meta">Recent {traffic?.recentSampleSize || 0} requests</span>
                        </div>
                        <div className="logs-panel__rows">
                            {topPaths.length === 0 ? (
                                <div className="logs-panel__row">
                                    <span>No data</span>
                                    <strong>--</strong>
                                </div>
                            ) : (
                                topPaths.map((item) => (
                                    <div key={item.value} className="logs-panel__row logs-panel__row--stack">
                                        <span>{item.value}</span>
                                        <strong>{formatNumber(item.count)}</strong>
                                    </div>
                                ))
                            )}
                        </div>
                        <p className="logs-panel__note">Unique paths: {formatNumber(traffic?.uniquePathsRecent)}</p>
                    </div>

                    <div className="card logs-panel">
                        <div className="logs-panel__header">
                            <h3>Top Visitors</h3>
                            <span className="logs-panel__meta">Recent IP activity</span>
                        </div>
                        <div className="logs-panel__rows">
                            {topIps.length === 0 ? (
                                <div className="logs-panel__row">
                                    <span>No data</span>
                                    <strong>--</strong>
                                </div>
                            ) : (
                                topIps.map((item) => (
                                    <div key={item.value} className="logs-panel__row logs-panel__row--stack">
                                        <span>{item.value}</span>
                                        <strong>{formatNumber(item.count)}</strong>
                                    </div>
                                ))
                            )}
                        </div>
                        <p className="logs-panel__note">
                            Unique visitors in sample: {formatNumber(clients?.uniqueIpsRecent)} | Tracked last hour: {formatNumber(clients?.totalTracked)}
                        </p>
                    </div>

                    <div className="card logs-panel">
                        <div className="logs-panel__header">
                            <h3>Top Devices</h3>
                            <span className="logs-panel__meta">User agents</span>
                        </div>
                        <div className="logs-panel__rows">
                            {topUserAgents.length === 0 ? (
                                <div className="logs-panel__row">
                                    <span>No data</span>
                                    <strong>--</strong>
                                </div>
                            ) : (
                                topUserAgents.map((item) => (
                                    <div key={item.value} className="logs-panel__row logs-panel__row--stack">
                                        <span>{item.value}</span>
                                        <strong>{formatNumber(item.count)}</strong>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>
                )}

                {(showBackend || showAi) && (
                <section className="logs-panel-grid logs-panel-grid--system">
                    {showBackend && (
                        <div className="card logs-panel">
                            <div className="logs-panel__header">
                                <h3>Backend Host Specs</h3>
                                <span className="logs-panel__meta">
                                    {backendSystem?.device?.cloudProvider === 'aws' ? 'Amazon Linux device' : 'Backend runtime device'}
                                </span>
                            </div>
                            <div className="logs-specs">
                                {backendSpecs.map((item) => (
                                    <div key={item.label} className="logs-spec">
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {showAi && (
                        <div className="card logs-panel">
                            <div className="logs-panel__header">
                                <h3>AI Host Specs</h3>
                                <span className="logs-panel__meta">AI runtime device</span>
                            </div>
                            <div className="logs-specs">
                                {aiSpecs.map((item) => (
                                    <div key={item.label} className="logs-spec">
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
                )}

                {showBackend && (
                <section className="logs-table card">
                    <div className="logs-table__header">
                        <div>
                            <h3>Live Log Stream</h3>
                            <p>Showing the most recent {overview?.retention?.recentEventLimit || 0} events.</p>
                        </div>
                        <div className="logs-table__filters">
                            {['all', 'request', 'error', 'rate_limit', 'client'].map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    className={`logs-filter ${filter === item ? 'active' : ''}`}
                                    onClick={() => setFilter(item)}
                                >
                                    {typeLabel(item)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="logs-table__body">
                        {recentLogs.length === 0 ? (
                            <p className="logs-table__empty">No log entries available yet.</p>
                        ) : (
                            recentLogs.map((log) => (
                                <div key={log.id} className={`logs-row logs-row--${log.type}`}>
                                    <div className="logs-row__time">
                                        <span>{formatTimeAgo(log.timestamp)}</span>
                                        <small>{new Date(log.timestamp).toLocaleTimeString()}</small>
                                    </div>
                                    <div className="logs-row__summary">
                                        <span className={`logs-pill logs-pill--${log.type}`}>{typeLabel(log.type)}</span>
                                        {log.type === 'request' && (
                                            <div>
                                                <strong>{log.method} {log.path}</strong>
                                                <p>IP {log.ip || 'n/a'} | {log.userAgent || 'unknown device'}</p>
                                                <p className="logs-row__detail">User {log.userId || 'anon'} | Role {log.role || 'n/a'}</p>
                                            </div>
                                        )}
                                        {log.type === 'rate_limit' && (
                                            <div>
                                                <strong>{log.method} {log.path}</strong>
                                                <p>{log.message}</p>
                                                <p className="logs-row__detail">IP {log.ip || 'n/a'} | {log.userAgent || 'unknown device'}</p>
                                            </div>
                                        )}
                                        {log.type === 'error' && (
                                            <div>
                                                <strong>{log.message}</strong>
                                                <p>{log.method} {log.path}</p>
                                                <p className="logs-row__detail">IP {log.ip || 'n/a'} | User {log.userId || 'anon'}</p>
                                            </div>
                                        )}
                                        {log.type === 'client' && (
                                            <div>
                                                <strong>{log.event}</strong>
                                                <p>{log.message}</p>
                                                {log.metadata && (
                                                    <p className="logs-row__detail">Metadata: {JSON.stringify(log.metadata)}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="logs-row__meta">
                                        <span className={`logs-status logs-status--${toStatusBadge(log.statusCode)}`}>
                                            {log.statusCode || log.level || 'ok'}
                                        </span>
                                        {log.durationMs && <span className="logs-row__meta-note">{log.durationMs} ms</span>}
                                        {log.source && <span className="logs-row__meta-note">{log.source}</span>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
                )}

                {showAi && (
                <section className="logs-panel-grid logs-panel-grid--ai">
                    <div className="card logs-panel">
                        <div className="logs-panel__header">
                            <h3>AI Service Runtime</h3>
                            <span className="logs-panel__meta">In-memory buffer</span>
                        </div>
                        <div className="logs-panel__rows">
                            <div className="logs-panel__row">
                                <span>Total log entries</span>
                                <strong>{formatNumber(aiOverview?.total)}</strong>
                            </div>
                            <div className="logs-panel__row">
                                <span>Buffer limit</span>
                                <strong>{formatNumber(aiOverview?.recentLimit)}</strong>
                            </div>
                            <div className="logs-panel__row">
                                <span>Service started</span>
                                <strong className="logs-panel__value-small">{aiStartedAt}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="card logs-panel">
                        <div className="logs-panel__header">
                            <h3>AI Processing Metrics</h3>
                            <span className="logs-panel__meta">Complaint pipeline</span>
                        </div>
                            <div className="logs-panel__rows">
                                <div className="logs-panel__row">
                                    <span>Processed total</span>
                                    <strong>{formatNumber(aiRuntime?.processedTotal)}</strong>
                                </div>
                                <div className="logs-panel__row">
                                    <span>Processed DB total</span>
                                    <strong>{aiProcessedCounts ? formatNumber(aiProcessedCounts.total) : 'n/a'}</strong>
                                </div>
                                <div className="logs-panel__row">
                                    <span>Processed success</span>
                                    <strong>{formatNumber(aiRuntime?.processedSuccess)}</strong>
                                </div>
                                <div className="logs-panel__row">
                                    <span>Processed failed</span>
                                    <strong>{formatNumber(aiRuntime?.processedFailed)}</strong>
                                </div>
                                <div className="logs-panel__row">
                                    <span>Processing now (DB)</span>
                                    <strong>{aiProcessedCounts ? formatNumber(aiProcessedCounts.processing) : 'n/a'}</strong>
                                </div>
                                <div className="logs-panel__row">
                                    <span>Failed total (DB)</span>
                                    <strong>{aiProcessedCounts ? formatNumber(aiProcessedCounts.failed) : 'n/a'}</strong>
                                </div>
                            <div className="logs-panel__row">
                                <span>Queue size</span>
                                <strong>{formatNumber(aiRuntime?.queueSize)}</strong>
                            </div>
                            <div className="logs-panel__row">
                                <span>Queue enqueued</span>
                                <strong>{formatNumber(aiRuntime?.queueEnqueued)}</strong>
                            </div>
                            <div className="logs-panel__row">
                                <span>Retried</span>
                                <strong>{formatNumber(aiRuntime?.retried)}</strong>
                            </div>
                            <div className="logs-panel__row">
                                <span>Pending DB</span>
                                <strong>{aiPendingCount !== null ? formatNumber(aiPendingCount) : 'n/a'}</strong>
                            </div>
                            <div className="logs-panel__row logs-panel__row--stack">
                                <span>In flight</span>
                                <strong>{aiRuntime?.inFlightComplaintId || 'n/a'}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="card logs-panel">
                        <div className="logs-panel__header">
                            <h3>AI Log Levels</h3>
                            <span className="logs-panel__meta">Severity mix</span>
                        </div>
                        <div className="logs-panel__rows">
                            {aiLevelBreakdown.length === 0 ? (
                                <div className="logs-panel__row">
                                    <span>No data</span>
                                    <strong>--</strong>
                                </div>
                            ) : (
                                aiLevelBreakdown.map((item) => (
                                    <div key={item.level} className="logs-panel__row">
                                        <span>{item.level}</span>
                                        <strong>{formatNumber(item.count)}</strong>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>
                )}

                {showAi && (
                <section className="logs-table card logs-table--ai">
                    <div className="logs-table__header">
                        <div>
                            <h3>AI Service Log Stream</h3>
                            <p>Latest runtime logs from the AI worker process.</p>
                        </div>
                        {aiError && (
                            <span className="logs-table__error">AI logs unavailable: {aiError}</span>
                        )}
                    </div>
                    <div className="logs-table__body">
                        {aiLogs.length === 0 ? (
                            <p className="logs-table__empty">No AI log entries available yet.</p>
                        ) : (
                            aiLogs.map((log) => (
                                <div key={log.id} className="logs-row logs-row--ai">
                                    <div className="logs-row__time">
                                        <span>{formatTimeAgo(log.timestamp)}</span>
                                        <small>{new Date(log.timestamp).toLocaleTimeString()}</small>
                                    </div>
                                    <div className="logs-row__summary">
                                        <span className="logs-pill logs-pill--ai">AI</span>
                                        <div>
                                            <strong>{log.message}</strong>
                                            <p>
                                                {log.logger || 'ai.service'}
                                                {log.path ? ` | ${log.method || 'GET'} ${log.path}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="logs-row__meta">
                                        <span className={`logs-status logs-status--${toLevelBadge(log.level)}`}>
                                            {log.level || 'INFO'}
                                        </span>
                                        {log.duration_ms && (
                                            <span className="logs-row__meta-note">{log.duration_ms} ms</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
                )}
            </div>
        </LogsLayout>
    );
}
