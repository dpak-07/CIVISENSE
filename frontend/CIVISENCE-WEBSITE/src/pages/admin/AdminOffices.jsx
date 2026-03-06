import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { getOffices, createOffice, updateOffice } from '../../api/offices';
import { getSensitiveLocations } from '../../api/sensitiveLocations';
import { getErrorMessage } from '../../utils/helpers';
import { isDemoSession } from '../../utils/authStorage';
import { DEMO_OFFICES } from '../../constants/demoData';
import { buildGoogleMapsLink, parseCoordinatesFromMapLink } from '../../utils/mapLink';
import '../citizen/CitizenDashboard.css';
import './AdminOffices.css';

const EMPTY_OFFICE_FORM = {
    name: '',
    type: 'main',
    zone: '',
    maxCapacity: 100,
    mapLink: '',
    longitude: '',
    latitude: '',
    officerName: '',
    officerEmail: '',
    officerPassword: '',
    officerIsActive: true
};

const toOptionalNumber = (value) => {
    if (value === '' || value === null || typeof value === 'undefined') {
        return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const getCoordinateText = (office) => {
    const coordinates = office?.location?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return '-';
    return `${coordinates[1]}, ${coordinates[0]}`;
};

export default function AdminOffices() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';

    const [offices, setOffices] = useState([]);
    const [sensitiveLocations, setSensitiveLocations] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showOfficeModal, setShowOfficeModal] = useState(false);
    const [editingOfficeId, setEditingOfficeId] = useState(null);
    const [officeForm, setOfficeForm] = useState(EMPTY_OFFICE_FORM);
    const [officeError, setOfficeError] = useState('');
    const [officeSaving, setOfficeSaving] = useState(false);

    useEffect(() => {
        void loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [officesResult, sensitiveResult] = await Promise.allSettled([
                getOffices(),
                getSensitiveLocations({ isActive: true })
            ]);

            if (officesResult.status === 'fulfilled') {
                setOffices(officesResult.value?.data?.data || []);
            } else if (isDemoSession()) {
                setOffices(DEMO_OFFICES);
            }

            if (sensitiveResult.status === 'fulfilled') {
                setSensitiveLocations(sensitiveResult.value?.data?.data || []);
            }
        } catch {
            if (isDemoSession()) {
                setOffices(DEMO_OFFICES);
            }
        } finally {
            setLoading(false);
        }
    };

    const openNewOffice = () => {
        if (!isSuperAdmin) return;
        setEditingOfficeId(null);
        setOfficeForm(EMPTY_OFFICE_FORM);
        setOfficeError('');
        setShowOfficeModal(true);
    };

    const openEditOffice = (office) => {
        if (!isSuperAdmin) return;
        const longitude = office.location?.coordinates?.[0];
        const latitude = office.location?.coordinates?.[1];
        setEditingOfficeId(office._id);
        setOfficeForm({
            name: office.name,
            type: office.type,
            zone: office.zone || '',
            maxCapacity: office.maxCapacity || 100,
            mapLink:
                office.mapLink ||
                buildGoogleMapsLink({
                    longitude,
                    latitude
            }),
            longitude: typeof longitude === 'number' ? longitude.toString() : '',
            latitude: typeof latitude === 'number' ? latitude.toString() : '',
            officerName: office.officerCredentials?.officerName || office.officerAccount?.name || '',
            officerEmail: office.officerCredentials?.officerEmail || office.officerAccount?.email || '',
            officerPassword: office.officerCredentials?.officerPassword || '',
            officerIsActive: office.officerAccount?.isActive !== false
        });
        setOfficeError('');
        setShowOfficeModal(true);
    };

    const handleMapLinkBlur = () => {
        const parsed = parseCoordinatesFromMapLink(officeForm.mapLink);
        if (!parsed) return;

        setOfficeForm((prev) => ({
            ...prev,
            longitude: parsed.longitude.toString(),
            latitude: parsed.latitude.toString()
        }));
    };

    const handleMapLinkChange = (mapLinkValue) => {
        const parsed = parseCoordinatesFromMapLink(mapLinkValue);
        setOfficeForm((prev) => ({
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

    const resolveOfficeLocation = () => {
        const latitude = toOptionalNumber(officeForm.latitude);
        const longitude = toOptionalNumber(officeForm.longitude);
        let mapLink = officeForm.mapLink.trim();

        if (!mapLink && (latitude === null || longitude === null)) {
            throw new Error('Provide a Google Maps link or valid latitude/longitude.');
        }

        const coordinatesFromLink = mapLink ? parseCoordinatesFromMapLink(mapLink) : null;
        const resolvedLatitude = latitude ?? coordinatesFromLink?.latitude ?? null;
        const resolvedLongitude = longitude ?? coordinatesFromLink?.longitude ?? null;

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

    const handleOfficeSubmit = async (event) => {
        event.preventDefault();
        if (!isSuperAdmin) return;

        setOfficeSaving(true);
        setOfficeError('');
        try {
            const locationPayload = resolveOfficeLocation();
            const payload = {
                name: officeForm.name.trim(),
                type: officeForm.type,
                zone: officeForm.zone.trim(),
                maxCapacity: Number(officeForm.maxCapacity),
                mapLink: locationPayload.mapLink,
                latitude: locationPayload.latitude,
                longitude: locationPayload.longitude,
                officerName: officeForm.officerName.trim(),
                officerEmail: officeForm.officerEmail.trim(),
                officerIsActive: Boolean(officeForm.officerIsActive)
            };

            if (officeForm.officerPassword.trim()) {
                payload.officerPassword = officeForm.officerPassword;
            }

            if (isDemoSession()) {
                if (editingOfficeId) {
                    setOffices((prev) =>
                        prev.map((office) =>
                            office._id === editingOfficeId
                                ? {
                                    ...office,
                                    name: payload.name,
                                    type: payload.type,
                                    zone: payload.zone,
                                    maxCapacity: payload.maxCapacity,
                                    mapLink: payload.mapLink,
                                    location: {
                                        type: 'Point',
                                        coordinates: [payload.longitude, payload.latitude]
                                    },
                                    officerAccount: {
                                        id: office.officerAccount?.id || `demo-officer-${Date.now()}`,
                                        name: payload.officerName || office.name,
                                        email: payload.officerEmail || office.officerAccount?.email,
                                        isActive: payload.officerIsActive
                                    }
                                }
                                : office
                        )
                    );
                } else {
                    setOffices((prev) => [
                        {
                            _id: `demo-office-${Date.now()}`,
                            name: payload.name,
                            type: payload.type,
                            zone: payload.zone,
                            maxCapacity: payload.maxCapacity,
                            workload: 0,
                            isActive: true,
                            mapLink: payload.mapLink,
                            location: {
                                type: 'Point',
                                coordinates: [payload.longitude, payload.latitude]
                            },
                            officerAccount: {
                                id: `demo-officer-${Date.now()}`,
                                name: payload.officerName || `${payload.name} Officer`,
                                email: payload.officerEmail,
                                isActive: payload.officerIsActive
                            }
                        },
                        ...prev
                    ]);
                }
                setShowOfficeModal(false);
                return;
            }

            if (editingOfficeId) {
                await updateOffice(editingOfficeId, payload);
            } else {
                await createOffice(payload);
            }
            setShowOfficeModal(false);
            await loadAll();
        } catch (err) {
            setOfficeError(getErrorMessage(err));
        } finally {
            setOfficeSaving(false);
        }
    };

    const handleOfficeFieldChange = (event) => {
        const { name, value, type, checked } = event.target;
        if (name === 'mapLink') {
            handleMapLinkChange(value);
            return;
        }
        setOfficeForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const activeSensitiveCount = sensitiveLocations.filter((item) => item?.isActive !== false).length;

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>Municipal Offices</h1>
                    <p>
                        Create and manage office capacity, map-linked locations, and office credentials.
                        {activeSensitiveCount > 0 ? ` Active sensitive locations fetched: ${activeSensitiveCount}.` : ''}
                    </p>
                </div>
                {isSuperAdmin ? (
                    <button className="btn btn-primary" onClick={openNewOffice}>+ Add Office</button>
                ) : (
                    <span className="admin-offices__view-badge">View Only (Super Admin Required)</span>
                )}
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : (
                <>
                    {officeError && <div className="auth-error" style={{ marginBottom: 'var(--space-4)' }}>{officeError}</div>}
                    {offices.length === 0 ? (
                        <EmptyState title="No offices" message="No municipal offices available." />
                    ) : (
                        <div className="offices-grid">
                            {offices.map((office) => (
                                <div
                                    key={office._id}
                                    className={`office-card card ${isSuperAdmin ? 'office-card--editable' : ''}`}
                                    onClick={() => openEditOffice(office)}
                                >
                                    <div className="office-card__header">
                                        <h3>{office.name}</h3>
                                        <span className={`office-type office-type--${office.type}`}>{office.type}</span>
                                    </div>
                                    <div className="office-card__info">
                                        <div><span>Zone:</span> {office.zone || '-'}</div>
                                        <div><span>Workload:</span> {office.workload || 0} / {office.maxCapacity}</div>
                                        <div><span>Usage:</span> {office.maxCapacity ? `${Math.min(100, Math.round(((office.workload || 0) / office.maxCapacity) * 100))}%` : '0%'}</div>
                                        <div><span>Office Login:</span> {office.officerCredentials?.officerEmail || office.officerAccount?.email || '-'}</div>
                                        <div><span>Office Password:</span> {office.officerCredentials?.officerPassword || '-'}</div>
                                        <div>
                                            <span>Status:</span>{' '}
                                            <span className={office.isActive ? 'text-success' : 'text-danger'}>
                                                {office.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div><span>Coordinates:</span> {getCoordinateText(office)}</div>
                                        <div className="office-card__map-link">
                                            <span>Map Link:</span>{' '}
                                            {office.mapLink ? (
                                                <a href={office.mapLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                                                    Open in Google Maps
                                                </a>
                                            ) : (
                                                '-'
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <Modal
                isOpen={showOfficeModal}
                onClose={() => !officeSaving && setShowOfficeModal(false)}
                title={editingOfficeId ? 'Edit Municipal Office' : 'Create Municipal Office'}
                subtitle="Use a Google Maps link or manual coordinates to store the office location."
                size="xl"
                className="modal--compact"
                bodyScrollable={false}
            >
                {officeError && <div className="auth-error">{officeError}</div>}
                <form onSubmit={handleOfficeSubmit} className="modal-form modal-form--single-card">
                    <div className="input-group">
                        <label>Name *</label>
                        <input className="input" name="name" value={officeForm.name} onChange={handleOfficeFieldChange} required />
                    </div>
                    <div className="input-group">
                        <label>Type *</label>
                        <select className="input" name="type" value={officeForm.type} onChange={handleOfficeFieldChange}>
                            <option value="main">Main</option>
                            <option value="sub">Sub</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Zone *</label>
                        <input className="input" name="zone" value={officeForm.zone} onChange={handleOfficeFieldChange} required />
                    </div>
                    <div className="input-group">
                        <label>Max Capacity *</label>
                        <input className="input" name="maxCapacity" type="number" min="1" value={officeForm.maxCapacity} onChange={handleOfficeFieldChange} required />
                    </div>
                    <div className="input-group">
                        <label>Office Account Name *</label>
                        <input className="input" name="officerName" value={officeForm.officerName} onChange={handleOfficeFieldChange} required />
                    </div>
                    <div className="input-group">
                        <label>Office Login Email / ID *</label>
                        <input className="input" name="officerEmail" value={officeForm.officerEmail} onChange={handleOfficeFieldChange} required />
                    </div>
                    <div className="input-group">
                        <label>{editingOfficeId ? 'New Office Password (optional)' : 'Office Password *'}</label>
                        <input
                            className="input"
                            name="officerPassword"
                            type="password"
                            minLength={4}
                            value={officeForm.officerPassword}
                            onChange={handleOfficeFieldChange}
                            required={!editingOfficeId}
                        />
                    </div>
                    <div className="input-group">
                        <label>Latitude (optional)</label>
                        <input className="input" name="latitude" type="number" step="any" value={officeForm.latitude} onChange={handleOfficeFieldChange} />
                    </div>
                    <div className="input-group">
                        <label>Longitude (optional)</label>
                        <input className="input" name="longitude" type="number" step="any" value={officeForm.longitude} onChange={handleOfficeFieldChange} />
                    </div>
                    <div className="input-group input-group--span-3">
                        <label>Google Maps Link *</label>
                        <input
                            className="input"
                            name="mapLink"
                            value={officeForm.mapLink}
                            onChange={handleOfficeFieldChange}
                            onBlur={handleMapLinkBlur}
                            placeholder="https://www.google.com/maps?q=13.0827,80.2707"
                        />
                        <small className="form-help-text">You can paste any maps URL with coordinates. Coordinates below are optional fallback.</small>
                    </div>
                    <div className="modal-form__footer modal-field--span-3">
                        <label className="sensitive-form__toggle">
                            <input
                                type="checkbox"
                                name="officerIsActive"
                                checked={officeForm.officerIsActive}
                                onChange={handleOfficeFieldChange}
                            />
                            Office Account Active
                        </label>
                        <div className="form-actions">
                            <button type="button" className="btn btn-ghost" onClick={() => setShowOfficeModal(false)} disabled={officeSaving}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={officeSaving}>
                                {officeSaving ? 'Saving...' : editingOfficeId ? 'Update Office' : 'Create Office'}
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
