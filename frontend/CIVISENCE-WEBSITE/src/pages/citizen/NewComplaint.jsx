import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { createComplaint } from '../../api/complaints';
import { getPublicSensitiveLocations } from '../../api/public';
import { getErrorMessage } from '../../utils/helpers';
import './NewComplaint.css';

const CATEGORIES = [
    'Road Damage', 'Water Supply', 'Sewage', 'Electricity', 'Garbage',
    'Street Light', 'Public Safety', 'Noise Pollution', 'Illegal Construction', 'Other'
];

const CITY_OPTIONS = ['Chennai'];

const getSensitiveLocationCoordinates = (item) => {
    const coordinates = item?.location?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
    return {
        longitude: Number(coordinates[0]),
        latitude: Number(coordinates[1])
    };
};

export default function NewComplaint() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: '', description: '', category: '', city: 'Chennai', sensitiveLocationId: '', longitude: '', latitude: ''
    });
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [sensitiveLocations, setSensitiveLocations] = useState([]);
    const [loadingSensitiveLocations, setLoadingSensitiveLocations] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);

    useEffect(() => {
        void loadSensitiveLocations();
    }, []);

    const selectedSensitiveLocation = useMemo(
        () => sensitiveLocations.find((item) => item._id === form.sensitiveLocationId) || null,
        [form.sensitiveLocationId, sensitiveLocations]
    );

    const loadSensitiveLocations = async () => {
        setLoadingSensitiveLocations(true);
        try {
            const { data } = await getPublicSensitiveLocations({ limit: 500 });
            setSensitiveLocations(Array.isArray(data?.data) ? data.data : []);
        } catch {
            setSensitiveLocations([]);
        } finally {
            setLoadingSensitiveLocations(false);
        }
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSensitiveLocationChange = (event) => {
        const nextId = event.target.value;
        const selected = sensitiveLocations.find((item) => item._id === nextId);
        const coordinates = getSensitiveLocationCoordinates(selected);

        setForm((prev) => ({
            ...prev,
            sensitiveLocationId: nextId,
            latitude:
                coordinates && Number.isFinite(coordinates.latitude)
                    ? coordinates.latitude.toString()
                    : prev.latitude,
            longitude:
                coordinates && Number.isFinite(coordinates.longitude)
                    ? coordinates.longitude.toString()
                    : prev.longitude
        }));
    };

    const handleImage = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const getLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm({
                    ...form,
                    longitude: pos.coords.longitude.toString(),
                    latitude: pos.coords.latitude.toString()
                });
                setGettingLocation(false);
            },
            () => {
                setError('Unable to retrieve your location');
                setGettingLocation(false);
            }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.city) {
            setError('Please select a city.');
            return;
        }

        if (!form.longitude || !form.latitude) {
            setError('Location is required. Use "Get My Location" or enter coordinates manually.');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', form.title);
            formData.append('description', form.description);
            formData.append('category', form.category);
            formData.append('city', form.city);
            formData.append('longitude', form.longitude);
            formData.append('latitude', form.latitude);
            if (form.sensitiveLocationId) {
                formData.append('sensitiveLocationId', form.sensitiveLocationId);
            }
            if (image) formData.append('image', image);

            await createComplaint(formData);
            navigate('/citizen', { replace: true });
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="page-header">
                <div>
                    <h1>Report a Complaint</h1>
                    <p>Provide details about the civic issue you want to report</p>
                </div>
            </div>

            <div className="new-complaint-card card">
                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="new-complaint-form">
                    <div className="new-complaint-grid">
                        <section className="new-complaint-panel">
                            <h2>Issue Details</h2>
                            <div className="input-group">
                                <label htmlFor="title">Title *</label>
                                <input
                                    id="title"
                                    name="title"
                                    className="input"
                                    placeholder="Brief title of the issue"
                                    value={form.title}
                                    onChange={handleChange}
                                    required
                                    maxLength={200}
                                />
                            </div>

                            <div className="input-group">
                                <label htmlFor="category">Category *</label>
                                <select
                                    id="category"
                                    name="category"
                                    className="input"
                                    value={form.category}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select category</option>
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label htmlFor="city">City *</label>
                                <select
                                    id="city"
                                    name="city"
                                    className="input"
                                    value={form.city}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select city</option>
                                    {CITY_OPTIONS.map((city) => (
                                        <option key={city} value={city}>
                                            {city}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label htmlFor="description">Description *</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    className="input"
                                    placeholder="Describe the issue in detail..."
                                    value={form.description}
                                    onChange={handleChange}
                                    required
                                    rows={8}
                                    maxLength={5000}
                                />
                            </div>
                        </section>

                        <section className="new-complaint-panel">
                            <h2>Media & Location</h2>
                            <div className="input-group">
                                <label>Image (optional)</label>
                                <div className="file-upload">
                                    <input type="file" accept="image/*" onChange={handleImage} id="image-upload" />
                                    <label htmlFor="image-upload" className="file-upload__label">
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Preview" className="file-upload__preview" />
                                        ) : (
                                            <span>Click to upload an image</span>
                                        )}
                                    </label>
                                </div>
                            </div>

                            <div className="location-section">
                                <label htmlFor="sensitiveLocationId">Sensitive Location (optional)</label>
                                <select
                                    id="sensitiveLocationId"
                                    name="sensitiveLocationId"
                                    className="input"
                                    value={form.sensitiveLocationId}
                                    onChange={handleSensitiveLocationChange}
                                >
                                    <option value="">
                                        {loadingSensitiveLocations ? 'Loading sensitive locations...' : 'None'}
                                    </option>
                                    {sensitiveLocations.map((location) => (
                                        <option key={location._id} value={location._id}>
                                            {location.name} ({location.type || location.category || 'zone'})
                                        </option>
                                    ))}
                                </select>
                                {selectedSensitiveLocation?.mapLink && (
                                    <a
                                        href={selectedSensitiveLocation.mapLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-muted"
                                        style={{ fontSize: 'var(--font-xs)', marginTop: 6 }}
                                    >
                                        Open selected sensitive location in Google Maps
                                    </a>
                                )}
                            </div>

                            <div className="location-section">
                                <label>Location *</label>
                                <div className="location-inputs">
                                    <input
                                        name="latitude"
                                        className="input"
                                        placeholder="Latitude"
                                        value={form.latitude}
                                        onChange={handleChange}
                                        type="number"
                                        step="any"
                                    />
                                    <input
                                        name="longitude"
                                        className="input"
                                        placeholder="Longitude"
                                        value={form.longitude}
                                        onChange={handleChange}
                                        type="number"
                                        step="any"
                                    />
                                </div>
                                <button type="button" className="btn btn-secondary" onClick={getLocation} disabled={gettingLocation}>
                                    {gettingLocation ? 'Getting...' : 'Use Current Location'}
                                </button>
                            </div>
                        </section>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                            {loading ? 'Submitting...' : 'Submit Complaint'}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
