const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

const MAX_RECENT_EVENTS = 400;
const MAX_RECENT_REQUESTS = 200;
const MAX_RECENT_ERRORS = 120;
const MAX_RECENT_CLIENT = 200;
const MAX_RECENT_RATE_LIMITS = 120;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const ACTIVE_CLIENT_WINDOW_MS = 5 * 60 * 1000;

const state = {
  startedAt: new Date(),
  activeRequests: 0,
  totalRequests: 0,
  totalErrors: 0,
  totalRateLimited: 0,
  totalClientLogs: 0,
  totalResponseTimeMs: 0,
  requestsByMethod: {},
  requestsByStatusClass: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  clientEventCounts: {},
  clientSourceCounts: {},
  requestTimestamps: [],
  rateLimitTimestamps: [],
  clientLastSeen: new Map(),
  recentEvents: [],
  recentRequests: [],
  recentErrors: [],
  recentClientLogs: [],
  recentRateLimits: []
};

const emitter = new EventEmitter();

const makeId = () => (typeof randomUUID === 'function'
  ? randomUUID()
  : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const pushBounded = (arr, item, max) => {
  arr.push(item);
  if (arr.length > max) {
    arr.splice(0, arr.length - max);
  }
};

const pruneTimestamps = (arr, cutoff) => {
  while (arr.length && arr[0] < cutoff) {
    arr.shift();
  }
};

const toStatusClass = (statusCode) => `${Math.floor(statusCode / 100)}xx`;

const sanitizeText = (value, max = 200) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const sanitizeMetadata = (value) => {
  if (!value || typeof value !== 'object') return null;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 1200) {
      return { summary: 'Metadata too large', size: serialized.length };
    }
    return value;
  } catch {
    return { summary: 'Metadata not serializable' };
  }
};

let cachedWindowsInfo = null;
let cachedWindowsInfoAt = 0;
const WINDOWS_INFO_TTL_MS = 5 * 60 * 1000;

const readWindowsRegistryValue = (key, name) => {
  try {
    const output = execSync(`reg query "${key}" /v ${name}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
    const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
    const target = lines.find((line) => line.toLowerCase().startsWith(name.toLowerCase()));
    if (!target) return null;
    const parts = target.split(/\s+/);
    if (parts.length < 3) return null;
    return parts.slice(2).join(' ').trim();
  } catch {
    return null;
  }
};

const getWindowsStaticInfo = () => {
  const now = Date.now();
  if (cachedWindowsInfo && now - cachedWindowsInfoAt < WINDOWS_INFO_TTL_MS) {
    return cachedWindowsInfo;
  }

  const productName = readWindowsRegistryValue(
    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
    'ProductName'
  );
  const displayVersion = readWindowsRegistryValue(
    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
    'DisplayVersion'
  );
  const releaseId = readWindowsRegistryValue(
    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
    'ReleaseId'
  );
  const currentBuild = readWindowsRegistryValue(
    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
    'CurrentBuild'
  );
  const ubr = readWindowsRegistryValue(
    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion',
    'UBR'
  );

  const manufacturer = readWindowsRegistryValue(
    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\SystemInformation',
    'SystemManufacturer'
  );
  const systemProduct = readWindowsRegistryValue(
    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\SystemInformation',
    'SystemProductName'
  );
  const biosVersion = readWindowsRegistryValue(
    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\SystemInformation',
    'BIOSVersion'
  );

  cachedWindowsInfo = {
    os: {
      productName,
      displayVersion: displayVersion || releaseId,
      build: currentBuild,
      ubr
    },
    device: {
      manufacturer,
      productName: systemProduct,
      biosVersion
    }
  };
  cachedWindowsInfoAt = now;
  return cachedWindowsInfo;
};

let lastCpuSample = null;

const sampleCpuUsagePct = () => {
  const cpus = os.cpus() || [];
  if (cpus.length === 0) return null;

  const totals = cpus.reduce(
    (acc, cpu) => {
      const times = cpu.times || {};
      const idle = times.idle || 0;
      const total = (times.user || 0)
        + (times.nice || 0)
        + (times.sys || 0)
        + (times.idle || 0)
        + (times.irq || 0);
      acc.idle += idle;
      acc.total += total;
      return acc;
    },
    { idle: 0, total: 0 }
  );

  if (!lastCpuSample) {
    lastCpuSample = totals;
    return null;
  }

  const idleDelta = totals.idle - lastCpuSample.idle;
  const totalDelta = totals.total - lastCpuSample.total;
  lastCpuSample = totals;

  if (totalDelta <= 0) return null;
  const usage = (1 - idleDelta / totalDelta) * 100;
  return Number(usage.toFixed(2));
};

const parseProcCpuInfo = (readFileSafe) => {
  const content = readFileSafe('/proc/cpuinfo');
  if (!content) return null;
  let model = null;
  let speedMHz = null;
  let count = 0;
  content.split('\n').forEach((line) => {
    const [rawKey, ...rest] = line.split(':');
    if (!rawKey || rest.length === 0) return;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'model name' && !model) {
      model = value;
    }
    if (key === 'cpu mhz' && speedMHz === null) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        speedMHz = Math.round(parsed);
      }
    }
    if (key === 'processor') {
      count += 1;
    }
  });

  return {
    model,
    speedMHz,
    count: count || null
  };
};

const parseProcMemInfo = (readFileSafe) => {
  const content = readFileSafe('/proc/meminfo');
  if (!content) return null;
  const info = {};
  content.split('\n').forEach((line) => {
    if (!line.includes(':')) return;
    const [rawKey, rawValue] = line.split(':', 2);
    const key = rawKey.trim();
    const value = rawValue.trim().split(/\s+/)[0];
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      info[key] = parsed;
    }
  });

  const totalKb = info.MemTotal;
  const availableKb = info.MemAvailable || info.MemFree;
  const freeKb = info.MemFree;
  if (!totalKb) return null;

  const totalMB = Number((totalKb / 1024).toFixed(2));
  const freeMB = freeKb ? Number((freeKb / 1024).toFixed(2)) : null;
  let usedMB = null;
  let usedPct = null;
  if (availableKb !== undefined) {
    const usedKb = Math.max(totalKb - availableKb, 0);
    usedMB = Number((usedKb / 1024).toFixed(2));
    usedPct = totalKb ? Number(((usedKb / totalKb) * 100).toFixed(2)) : null;
  }

  return {
    totalMB,
    freeMB,
    usedMB,
    usedPct
  };
};

const parseProcLoadAvg = (readFileSafe) => {
  const content = readFileSafe('/proc/loadavg');
  if (!content) return null;
  const parts = content.trim().split(/\s+/).slice(0, 3);
  if (parts.length < 3) return null;
  const values = parts.map((value) => Number(value));
  if (values.some((value) => Number.isNaN(value))) return null;
  return values.map((value) => Number(value.toFixed(2)));
};

const parseProcUptime = (readFileSafe) => {
  const content = readFileSafe('/proc/uptime');
  if (!content) return null;
  const value = content.trim().split(/\s+/)[0];
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  return Math.round(seconds);
};

const buildTopCounts = (items, pickKey, limit = 6) => {
  const counts = new Map();
  items.forEach((item) => {
    const key = pickKey(item);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
};

const getSystemMetrics = () => {
  const platformName = os.platform();
  const cpus = os.cpus() || [];
  let cpuCount = cpus.length;
  let cpuModel = cpus[0]?.model || null;
  let cpuSpeedMHz = cpus[0]?.speed || null;
  let loadAvg = os.loadavg ? os.loadavg().map((value) => Number(value.toFixed(2))) : [];
  if (platformName === 'win32') {
    loadAvg = [];
  }
  let totalMemMB = Number((os.totalmem() / (1024 * 1024)).toFixed(2));
  let freeMemMB = Number((os.freemem() / (1024 * 1024)).toFixed(2));
  let memUsedMB = Number((totalMemMB - freeMemMB).toFixed(2));
  let memUsedPct = totalMemMB ? Number(((memUsedMB / totalMemMB) * 100).toFixed(2)) : 0;

  const readFileSafe = (path) => {
    try {
      return fs.readFileSync(path, 'utf8').trim();
    } catch {
      return null;
    }
  };

  const parseOsRelease = () => {
    if (platformName === 'win32') {
      const winInfo = getWindowsStaticInfo();
      const prettyParts = [winInfo.os.productName, winInfo.os.displayVersion].filter(Boolean);
      return {
        id: 'windows',
        version: winInfo.os.displayVersion || null,
        prettyName: prettyParts.length ? prettyParts.join(' ') : winInfo.os.productName || null
      };
    }
    const content = readFileSafe('/etc/os-release');
    if (!content) return null;
    const lines = content.split('\n');
    const data = {};
    lines.forEach((line) => {
      const [key, ...rest] = line.split('=');
      if (!key || rest.length === 0) return;
      const value = rest.join('=').replace(/^\"|\"$/g, '');
      data[key] = value;
    });
    return {
      id: data.ID || null,
      version: data.VERSION_ID || null,
      prettyName: data.PRETTY_NAME || null
    };
  };

  let sysVendor = readFileSafe('/sys/devices/virtual/dmi/id/sys_vendor');
  let productName = readFileSafe('/sys/devices/virtual/dmi/id/product_name');
  let biosVersion = readFileSafe('/sys/devices/virtual/dmi/id/bios_version');
  const hypervisorUuid = readFileSafe('/sys/hypervisor/uuid');
  if (platformName === 'win32') {
    const winInfo = getWindowsStaticInfo();
    sysVendor = sysVendor || winInfo.device.manufacturer;
    productName = productName || winInfo.device.productName;
    biosVersion = biosVersion || winInfo.device.biosVersion;
  }
  const vendorLower = (sysVendor || '').toLowerCase();
  const cloudProvider = vendorLower.includes('amazon') || (hypervisorUuid || '').toLowerCase().startsWith('ec2')
    ? 'aws'
    : null;

  const procCpu = (cpuCount === 0 || !cpuModel || !cpuSpeedMHz)
    ? parseProcCpuInfo(readFileSafe)
    : null;
  if (procCpu) {
    cpuCount = cpuCount || procCpu.count || 0;
    cpuModel = cpuModel || procCpu.model;
    cpuSpeedMHz = cpuSpeedMHz || procCpu.speedMHz;
  }

  if (!totalMemMB || !Number.isFinite(totalMemMB)) {
    const procMem = parseProcMemInfo(readFileSafe);
    if (procMem) {
      totalMemMB = procMem.totalMB ?? totalMemMB;
      freeMemMB = procMem.freeMB ?? freeMemMB;
      memUsedMB = procMem.usedMB ?? memUsedMB;
      memUsedPct = procMem.usedPct ?? memUsedPct;
    }
  }

  if (!loadAvg || loadAvg.length === 0) {
    const procLoad = parseProcLoadAvg(readFileSafe);
    if (procLoad) {
      loadAvg = procLoad;
    }
  }

  const uptimeFallback = parseProcUptime(readFileSafe);
  const uptimeSec = Number.isFinite(os.uptime()) && os.uptime() > 0
    ? Math.round(os.uptime())
    : uptimeFallback;

  return {
    hostname: os.hostname(),
    platform: platformName,
    release: os.release(),
    arch: os.arch(),
    uptimeSec,
    cpuCount,
    cpuModel,
    cpuSpeedMHz,
    cpuUsagePct: sampleCpuUsagePct(),
    loadAvg,
    memTotalMB: totalMemMB,
    memFreeMB: freeMemMB,
    memUsedMB,
    memUsedPct,
    osRelease: parseOsRelease(),
    device: {
      vendor: sysVendor,
      productName,
      biosVersion,
      cloudProvider
    }
  };
};

const addEvent = (event) => {
  pushBounded(state.recentEvents, event, MAX_RECENT_EVENTS);
  emitter.emit('event', event);
};

const markRequestStart = () => {
  state.activeRequests += 1;
};

const markRequestEnd = () => {
  state.activeRequests = Math.max(state.activeRequests - 1, 0);
};

const recordRequest = ({ req, res, durationMs }) => {
  const statusCode = Number(res.statusCode || 0);
  const statusClass = toStatusClass(statusCode);
  const now = Date.now();

  state.totalRequests += 1;
  state.totalResponseTimeMs += Number(durationMs || 0);
  state.requestsByMethod[req.method] = (state.requestsByMethod[req.method] || 0) + 1;
  state.requestsByStatusClass[statusClass] = (state.requestsByStatusClass[statusClass] || 0) + 1;

  state.requestTimestamps.push(now);
  pruneTimestamps(state.requestTimestamps, now - REQUEST_WINDOW_MS);

  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (ip) {
    state.clientLastSeen.set(ip, now);
  }

  const entry = {
    id: makeId(),
    type: 'request',
    source: 'backend',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl?.split('?')[0] || req.url || '',
    statusCode,
    durationMs: Number(durationMs || 0).toFixed(2),
    ip,
    userAgent: req.get('user-agent') || null,
    userId: req.user?.id || null,
    role: req.user?.role || null
  };

  pushBounded(state.recentRequests, entry, MAX_RECENT_REQUESTS);
  addEvent(entry);

};

const recordError = ({ req, err, statusCode }) => {
  state.totalErrors += 1;

  const entry = {
    id: makeId(),
    type: 'error',
    source: 'backend',
    timestamp: new Date().toISOString(),
    message: sanitizeText(err?.message || 'Unhandled error', 240),
    statusCode: Number(statusCode || 500),
    path: req?.originalUrl?.split('?')[0] || req?.url || 'unknown',
    method: req?.method || 'unknown',
    ip: req?.ip || null,
    userId: req?.user?.id || null,
    role: req?.user?.role || null
  };

  pushBounded(state.recentErrors, entry, MAX_RECENT_ERRORS);
  addEvent(entry);
  return entry;
};

const recordRateLimit = ({ req, message }) => {
  state.totalRateLimited += 1;
  const now = Date.now();
  state.rateLimitTimestamps.push(now);
  pruneTimestamps(state.rateLimitTimestamps, now - RATE_LIMIT_WINDOW_MS);

  const entry = {
    id: makeId(),
    type: 'rate_limit',
    source: 'backend',
    timestamp: new Date().toISOString(),
    message: sanitizeText(message || 'Rate limit exceeded', 200),
    path: req?.originalUrl?.split('?')[0] || req?.url || 'unknown',
    method: req?.method || 'unknown',
    ip: req?.ip || null,
    userAgent: req?.get ? req.get('user-agent') : null
  };

  pushBounded(state.recentRateLimits, entry, MAX_RECENT_RATE_LIMITS);
  addEvent(entry);
  return entry;
};

const recordClientLog = ({ req, payload = {} }) => {
  const sourceRaw = sanitizeText(payload.source || payload.platform || 'unknown', 40).toLowerCase();
  const source = ['web', 'mobile', 'backend', 'unknown'].includes(sourceRaw) ? sourceRaw : 'unknown';
  const levelRaw = sanitizeText(payload.level || 'info', 12).toLowerCase();
  const level = ['info', 'warn', 'error'].includes(levelRaw) ? levelRaw : 'info';
  const event = sanitizeText(payload.event || payload.type || '', 80);
  const message = sanitizeText(payload.message || payload.title || event || 'Client log', 300);

  if (!message && !event) {
    return null;
  }

  state.totalClientLogs += 1;
  state.clientEventCounts[event || 'generic'] = (state.clientEventCounts[event || 'generic'] || 0) + 1;
  state.clientSourceCounts[source] = (state.clientSourceCounts[source] || 0) + 1;

  const entry = {
    id: makeId(),
    type: 'client',
    source,
    timestamp: new Date().toISOString(),
    level,
    event: event || 'generic',
    message,
    metadata: sanitizeMetadata(payload.metadata),
    path: sanitizeText(payload.path || req?.originalUrl || '', 140),
    userId: req?.user?.id || null,
    role: req?.user?.role || null,
    ip: req?.ip || null,
    userAgent: req?.get ? req.get('user-agent') : null
  };

  pushBounded(state.recentClientLogs, entry, MAX_RECENT_CLIENT);
  addEvent(entry);
  return entry;
};

const getRecent = ({ type = 'all', limit = 80 } = {}) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 80, 200));
  let source = state.recentEvents;

  switch (type) {
    case 'requests':
    case 'request':
      source = state.recentRequests;
      break;
    case 'errors':
    case 'error':
      source = state.recentErrors;
      break;
    case 'rate_limit':
      source = state.recentRateLimits;
      break;
    case 'client':
      source = state.recentClientLogs;
      break;
    default:
      source = state.recentEvents;
  }

  return source.slice(-safeLimit).reverse();
};

const getOverview = () => {
  const now = Date.now();
  pruneTimestamps(state.requestTimestamps, now - REQUEST_WINDOW_MS);
  pruneTimestamps(state.rateLimitTimestamps, now - RATE_LIMIT_WINDOW_MS);

  const requestsLastMinute = state.requestTimestamps.filter((ts) => ts >= now - 60 * 1000).length;
  const requestsLast5Minutes = state.requestTimestamps.filter((ts) => ts >= now - 5 * 60 * 1000).length;
  const rateLimitLast5Minutes = state.rateLimitTimestamps.filter((ts) => ts >= now - 5 * 60 * 1000).length;

  const recentRequests = state.recentRequests.slice();
  const uniquePathsRecent = new Set(recentRequests.map((entry) => entry.path).filter(Boolean)).size;
  const uniqueIpsRecent = new Set(recentRequests.map((entry) => entry.ip).filter(Boolean)).size;
  const topPaths = buildTopCounts(recentRequests, (entry) => entry.path, 6);
  const topIps = buildTopCounts(recentRequests, (entry) => entry.ip, 6);
  const topUserAgents = buildTopCounts(recentRequests, (entry) => entry.userAgent, 5);

  let activeClients = 0;
  const activeCutoff = now - ACTIVE_CLIENT_WINDOW_MS;
  state.clientLastSeen.forEach((lastSeen, ip) => {
    if (lastSeen >= activeCutoff) {
      activeClients += 1;
    } else if (lastSeen < now - REQUEST_WINDOW_MS) {
      state.clientLastSeen.delete(ip);
    }
  });

  const avgResponseMs = state.totalRequests
    ? Number(state.totalResponseTimeMs / state.totalRequests).toFixed(2)
    : 0;

  const memoryUsage = process.memoryUsage();

  return {
    generatedAt: new Date().toISOString(),
    startedAt: state.startedAt.toISOString(),
    uptimeSec: Math.round(process.uptime()),
    traffic: {
      totalRequests: state.totalRequests,
      activeRequests: state.activeRequests,
      requestsLastMinute,
      requestsLast5Minutes,
      avgResponseMs: Number(avgResponseMs),
      byMethod: state.requestsByMethod,
      byStatusClass: state.requestsByStatusClass,
      uniquePathsRecent,
      recentSampleSize: recentRequests.length,
      topPaths
    },
    errors: {
      total: state.totalErrors
    },
    rateLimit: {
      total: state.totalRateLimited,
      last5Minutes: rateLimitLast5Minutes
    },
    clients: {
      activeLast5Minutes: activeClients,
      totalTracked: state.clientLastSeen.size,
      bySource: state.clientSourceCounts,
      uniqueIpsRecent,
      topIps,
      topUserAgents
    },
    clientEvents: {
      total: state.totalClientLogs,
      counts: state.clientEventCounts
    },
    memory: {
      rssMB: Number((memoryUsage.rss / (1024 * 1024)).toFixed(2)),
      heapUsedMB: Number((memoryUsage.heapUsed / (1024 * 1024)).toFixed(2))
    },
    system: getSystemMetrics(),
    retention: {
      recentEventLimit: MAX_RECENT_EVENTS
    }
  };
};

const subscribe = (handler) => {
  emitter.on('event', handler);
  return () => emitter.off('event', handler);
};

module.exports = {
  markRequestStart,
  markRequestEnd,
  recordRequest,
  recordError,
  recordRateLimit,
  recordClientLog,
  getRecent,
  getOverview,
  getSystemMetrics,
  subscribe
};
