import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import {
    getSensitiveLocations,
    createSensitiveLocation,
    updateSensitiveLocation
} from '../../api/sensitiveLocations';
import { getErrorMessage } from '../../utils/helpers';
import { isDemoSession } from '../../utils/authStorage';
import { DEMO_SENSITIVE_LOCATIONS } from '../../constants/demoData';
import { buildGoogleMapsLink, parseCoordinatesFromMapLink } from '../../utils/mapLink';
import '../citizen/CitizenDashboard.css';
import './AdminZones.css';

const EMPTY_FORM = {
    name: '',
    type: '',
    priorityWeight: 1,
    description: '',
    radiusMeters: 150,
    mapLink: '',
    longitude: '',
    latitude: '',
    isActive: true
};

const TYPE_OPTIONS = [
    'school',
    'hospital',
    'police',
    'station',
    'government_building',
    'other'
];

const toOptionalNumber = (value) => {
    if (value === '' || value === null || typeof value === 'undefined') {
        return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const getCoordinates = (location) => {
    const coordinates = location?.location?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return '-';
    return `${coordinates[1]}, ${coordinates[0]}`;
};

export default function AdminZones() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';

    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void loadZones();
    }, []);

    const loadZones = async () => {
        setLoading(true);
        try {
            const { data } = await getSensitiveLocations();
            setZones(data.data || []);
        } catch {
            if (isDemoSession()) {
                setZones(DEMO_SENSITIVE_LOCATIONS);
            }
        } finally {
            setLoading(false);
        }
    };

    const sortedZones = useMemo(
        () =>
            [...zones].sort((a, b) => {
                const aWeight = Number(a.priorityWeight || 0);
                const bWeight = Number(b.priorityWeight || 0);
                return bWeight - aWeight;
            }),
        [zones]
    );

    const openNew = () => {
        if (!isSuperAdmin) return;
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError('');
        setShowModal(true);
    };

    const openEdit = (location) => {
        if (!isSuperAdmin) return;
        const longitude = location.location?.coordinates?.[0];
        const latitude = location.location?.coordinates?.[1];
        setEditingId(location._id);
        setForm({
            name: location.name || '',
            type: location.type || location.category || '',
            priorityWeight: Number(location.priorityWeight || 1),
            description: location.description || '',
            radiusMeters: Number(location.radiusMeters || 150),
            mapLink:
                location.mapLink ||
                buildGoogleMapsLink({
                    longitude,
                    latitude
                }),
            longitude: typeof longitude === 'number' ? longitude.toString() : '',
            latitude: typeof latitude === 'number' ? latitude.toString() : '',
            isActive: location.isActive !== false
        });
        setError('');
        setShowModal(true);
    };

    const handleMapLinkBlur = () => {
        const parsed = parseCoordinatesFromMapLink(form.mapLink);
        if (!parsed) return;

        setForm((prev) => ({
            ...prev,
            longitude: parsed.longitude.toString(),
            latitude: parsed.latitude.toString()
        }));
    };

    const handleMapLinkChange = (mapLinkValue) => {
        const parsed = parseCoordinatesFromMapLink(mapLinkValue);
        setForm((prev) => ({
            ...prev,
            mapLink: mapLinkValue,
            ...(parsed
                ? {
                    longitude: parsed.longitude.toString(),
                    latitude: parsed.latitude.toString()
                }
                : {})
        }));
    };

    const resolveLocation = () => {
        const latitude = toOptionalNumber(form.latitude);
        const longitude = toOptionalNumber(form.longitude);
        let mapLink = form.mapLink.trim();

        if (!mapLink && (latitude === null || longitude === null)) {
            throw new Error('Provide a Google Maps link or valid latitude/longitude.');
        }

        const fromLink = mapLink ? parseCoordinatesFromMapLink(mapLink) : null;
        const resolvedLatitude = latitude ?? fromLink?.latitude ?? null;
        const resolvedLongitude = longitude ?? fromLink?.longitude ?? null;

        if (resolvedLatitude === null || resolvedLongitude === null) {
            throw new Error('Could not resolve coordinates from map link or coordinate inputs.');
        }

        if (!mapLink) {
            mapLink = buildGoogleMapsLink({
                longitude: resolvedLongitude,
                latitude: resolvedLatitude
            });
        }

        return {
            latitude: resolvedLatitude,
            longitude: resolvedLongitude,
            mapLink
        };
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!isSuperAdmin) return;

        setSaving(true);
        setError('');
        try {
            const location = resolveLocation();
            const payload = {
                name: form.name.trim(),
                type: form.type.trim(),
                priorityWeight: Number(form.priorityWeight),
                description: form.description.trim(),
                radiusMeters: Number(form.radiusMeters),
                mapLink: location.mapLink,
                latitude: location.latitude,
                longitude: location.longitude,
                isActive: Boolean(form.isActive)
            };

            if (!payload.name || !payload.type) {
                throw new Error('Name and type are required.');
            }

            if (isDemoSession()) {
                if (editingId) {
                    setZones((prev) =>
                        prev.map((item) =>
                            item._id === editingId
                                ? {
                                    ...item,
                                    ...payload,
                                    category: payload.type,
                                    location: {
                                        type: 'Point',
                                        coordinates: [payload.longitude, payload.latitude]
                                    }
                                }
                                : item
                        )
                    );
                } else {
                    setZones((prev) => [
                        {
                            _id: `demo-sensitive-${Date.now()}`,
                            ...payload,
                            category: payload.type,
                            createdAt: new Date().toISOString(),
                            location: {
                                type: 'Point',
                                coordinates: [payload.longitude, payload.latitude]
                            }
                        },
                        ...prev
                    ]);
                }
                setShowModal(false);
                return;
            }

            if (editingId) {
                await updateSensitiveLocation(editingId, payload);
            } else {
                await createSensitiveLocation(payload);
            }

            setShowModal(false);
            await loadZones();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleFieldChange = (event) => {
        const { name, value, type, checked } = event.target;
        if (name === 'mapLink') {
            handleMapLinkChange(value);
            return;
        }
        setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>Sensitive Zones</h1>
                    <p>Maintain protected locations with map links, priority weight, and status controls.</p>
                </div>
                {isSuperAdmin ? (
                    <button type="button" className="btn btn-primary" onClick={openNew}>
                        + Add Zone
                    </button>
                ) : (
                    <span className="admin-zones__view-badge">View Only (Super Admin Required)</span>
                )}
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : (
                <>
                    {error && <div className="auth-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}
                    {sortedZones.length === 0 ? (
                        <EmptyState title="No zones configured" message="No sensitive zones available." />
                    ) : (
                        <div className="sensitive-grid">
                            {sortedZones.map((location) => (
                                <div key={location._id} className="sensitive-card card">
                                    <div className="sensitive-card__head">
                                        <h3>{location.name}</h3>
                                        <span className={`sensitive-pill ${location.isActive ? 'active' : 'inactive'}`}>
                                            {location.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="sensitive-card__meta">
                                        <div><span>Type:</span> {location.type || location.category || '-'}</div>
                                        <div><span>Priority Weight:</span> {location.priorityWeight || 1}</div>
                                        <div><span>Radius:</span> {location.radiusMeters || 150}m</div>
                                        <div><span>Coordinates:</span> {getCoordinates(location)}</div>
                                        <div>
                                            <span>Map Link:</span>{' '}
                                            {location.mapLink ? (
                                                <a href={location.mapLink} target="_blank" rel="noreferrer">
                                                    Open in Google Maps
                                                </a>
                                            ) : (
                                                '-'
                                            )}
                                        </div>
                                        {location.description ? (
                                            <div><span>Description:</span> {location.description}</div>
                                        ) : null}
                                    </div>
                                    {isSuperAdmin ? (
                                        <div className="sensitive-card__actions">
                                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(location)}>
                                                Edit
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => !saving && setShowModal(false)}
                title={editingId ? 'Edit Sensitive Zone' : 'Create Sensitive Zone'}
                subtitle="Store zone location via Google Maps URL with parsed coordinates."
                size="xl"
                className="modal--compact"
                bodyScrollable={false}
            >
                {error && <div className="auth-error">{error}</div>}
                <form onSubmit={handleSubmit} className="modal-form modal-form--single-card">
                    <div className="input-group">
                        <label>Name *</label>
                        <input className="input" name="name" value={form.name} onChange={handleFieldChange} required />
                    </div>
                    <div className="input-group">
                        <label>Priority Weight *</label>
                        <input
                            className="input"
                            name="priorityWeight"
                            type="number"
                            min="1"
                            max="10"
                            value={form.priorityWeight}
                            onChange={handleFieldChange}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Type *</label>
                        <select className="input" name="type" value={form.type} onChange={handleFieldChange} required>
                            <option value="" disabled>Select type</option>
                            {TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Radius (meters) *</label>
                        <input
                            className="input"
                            name="radiusMeters"
                            type="number"
                            min="10"
                            max="10000"
                            value={form.radiusMeters}
                            onChange={handleFieldChange}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Latitude (optional)</label>
                        <input className="input" name="latitude" type="number" step="any" value={form.latitude} onChange={handleFieldChange} />
                    </div>
                    <div className="input-group">
                        <label>Longitude (optional)</label>
                        <input className="input" name="longitude" type="number" step="any" value={form.longitude} onChange={handleFieldChange} />
                    </div>
                    <div className="input-group input-group--span-3">
                        <label>Google Maps Link *</label>
                        <input
                            className="input"
                            name="mapLink"
                            value={form.mapLink}
                            onChange={handleFieldChange}
                            onBlur={handleMapLinkBlur}
                            placeholder="https://www.google.com/maps?q=13.0827,80.2707"
                        />
                        <small className="form-help-text">Paste any maps URL containing coordinates.</small>
                    </div>
                    <div className="input-group input-group--span-3">
                        <label>Description</label>
                        <textarea className="input" rows={3} name="description" value={form.description} onChange={handleFieldChange} />
                    </div>
                    <div className="modal-form__footer modal-field--span-3">
                        <label className="sensitive-form__toggle">
                            <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleFieldChange} />
                            Active
                        </label>
                        <div className="form-actions">
                            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Saving...' : editingId ? 'Update Zone' : 'Create Zone'}
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
